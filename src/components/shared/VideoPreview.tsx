import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ContactPicker from '@/components/chat/ContactPicker';
import { 
  X, 
  Download, 
  Share, 
  ChevronLeft, 
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture,
  SkipBack,
  SkipForward,
  Settings,
  RotateCw,
  RefreshCw
} from 'lucide-react';
import { downloadFile } from '@/utils/downloadUtils';

interface VideoPreviewProps {
  src: string;
  fileName: string;
  fileSize: string;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
  videos?: Array<{ src: string; fileName: string; fileSize: string; }>;
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isBuffering: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  isPiP: boolean;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({
  src,
  fileName,
  fileSize,
  isOpen,
  onClose,
  onDownload,
  videos = [],
  currentIndex = 0,
  onNavigate
}) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeSliderRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement>(null);

  // Video state
  const [videoState, setVideoState] = useState<VideoState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isBuffering: false,
    playbackRate: 1,
    isFullscreen: false,
    isPiP: false
  });

  // UI state
  const [showControls, setShowControls] = useState(true);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [downloadSpeed, setDownloadSpeed] = useState<string>('');
  const [bufferedRanges, setBufferedRanges] = useState<TimeRanges | null>(null);

  // New state for progress bar visibility
  const [showProgressBar, setShowProgressBar] = useState(true);
  const progressBarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Navigation helpers
  const hasMultipleVideos = videos.length > 1;
  const canGoNext = hasMultipleVideos && currentIndex < videos.length - 1;
  const canGoPrev = hasMultipleVideos && currentIndex > 0;
  const currentVideoNumber = currentIndex + 1;
  const totalVideos = videos.length || 1;

  // Initialize video when opened
  useEffect(() => {
    if (isOpen && videoRef.current) {
      const video = videoRef.current;
      
      // Reset video state
      setVideoState(prev => ({
        ...prev,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        isBuffering: false,
        volume: 1,
        isMuted: false
      }));
      
      // Explicitly set video properties
      video.volume = 1;
      video.muted = false;
      
      setVideoLoaded(false);
      setVideoError(false);
      setShowControls(true);
      
      // Generate thumbnail
      generateThumbnail();
      
      // Auto-hide controls
      resetControlsTimeout();
    }
  }, [isOpen, src]);

  // Generate intelligent thumbnail
  const generateThumbnail = useCallback(() => {
    if (!videoRef.current || !thumbnailCanvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = thumbnailCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    const handleThumbnailCapture = () => {
      // Seek to 25% of video for better thumbnail (avoiding black frames)
      const seekTime = video.duration * 0.25;
      video.currentTime = seekTime;
      
      video.addEventListener('seeked', function captureThumbnail() {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setThumbnailUrl(dataUrl);
        
        // Reset video to beginning
        video.currentTime = 0;
        video.removeEventListener('seeked', captureThumbnail);
      }, { once: true });
    };
    
    if (video.readyState >= 2) {
      handleThumbnailCapture();
    } else {
      video.addEventListener('loadeddata', handleThumbnailCapture, { once: true });
    }
  }, []);

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadStart = () => setVideoState(prev => ({ ...prev, isBuffering: true }));
    const handleCanPlay = () => {
      setVideoLoaded(true);
      setVideoState(prev => ({ ...prev, isBuffering: false }));
      
      // Ensure video is not muted when it can play
      video.muted = false;
      video.volume = videoState.volume;
    };
    const handleLoadedMetadata = () => {
      setVideoState(prev => ({ ...prev, duration: video.duration }));
      
      // Set initial volume and mute state
      video.volume = videoState.volume;
      video.muted = videoState.isMuted;
    };
    const handleTimeUpdate = () => {
      setVideoState(prev => ({ ...prev, currentTime: video.currentTime }));
      setBufferedRanges(video.buffered);
    };
    const handlePlay = () => {
      setVideoState(prev => ({ ...prev, isPlaying: true }));
      
      // Ensure audio is enabled when playing
      if (video.muted && videoState.volume > 0) {
        video.muted = false;
      }
    };
    const handlePause = () => setVideoState(prev => ({ ...prev, isPlaying: false }));
    const handleEnded = () => {
      setVideoState(prev => ({ ...prev, isPlaying: false, currentTime: video.duration }));
      showControlsTemporarily();
    };
    const handleVolumeChange = () => {
      setVideoState(prev => ({ 
        ...prev, 
        volume: video.volume, 
        isMuted: video.muted 
      }));
    };
    const handleWaiting = () => setVideoState(prev => ({ ...prev, isBuffering: true }));
    const handlePlaying = () => setVideoState(prev => ({ ...prev, isBuffering: false }));
    const handleError = () => {
      setVideoError(true);
      setVideoLoaded(false);
      setVideoState(prev => ({ ...prev, isBuffering: false }));
    };
    
    // Progress monitoring for download speed
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const bufferedPercent = (bufferedEnd / video.duration) * 100;
        
        // Estimate download speed (simplified)
        const loadedBytes = (bufferedPercent / 100) * parseFloat(fileSize.replace(/[^\d.]/g, ''));
        const timeElapsed = video.currentTime || 1;
        const speed = (loadedBytes / timeElapsed).toFixed(1);
        setDownloadSpeed(`${speed} MB/s`);
      }
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('error', handleError);
    video.addEventListener('progress', handleProgress);

    return () => {
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('error', handleError);
      video.removeEventListener('progress', handleProgress);
    };
  }, [fileSize, videoState.volume, videoState.isMuted]);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case 'Escape':
          if (videoState.isFullscreen) {
            exitFullscreen();
          } else {
            onClose();
          }
          break;
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          if (e.shiftKey) {
            if (canGoPrev && onNavigate) {
              onNavigate(currentIndex - 1);
            }
          } else {
            seek(video.currentTime - 10);
          }
          break;
        case 'ArrowRight':
          if (e.shiftKey) {
            if (canGoNext && onNavigate) {
              onNavigate(currentIndex + 1);
            }
          } else {
            seek(video.currentTime + 10);
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(Math.min(video.volume + 0.1, 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(Math.max(video.volume - 0.1, 0));
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'p':
        case 'P':
          togglePiP();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, videoState.isFullscreen, canGoNext, canGoPrev, currentIndex, onNavigate]);

  // Control functions
  const togglePlayPause = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.paused) {
        // Ensure audio is not muted when starting playback
        if (videoState.volume > 0) {
          video.muted = false;
        }
        await video.play();
      } else {
        video.pause();
      }
      showControlsTemporarily();
    } catch (error) {
      console.error('Play/pause failed:', error);
      // Handle autoplay policy errors
      if (error.name === 'NotAllowedError') {
        toast({
          title: 'Autoplay Blocked',
          description: 'Please click the play button to start the video',
          variant: 'destructive'
        });
      }
    }
  }, [videoState.volume, toast]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = Math.max(0, Math.min(time, video.duration));
    showControlsTemporarily();
  }, []);

  const changeVolume = useCallback((volume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = volume;
    // Unmute if volume is increased
    if (volume > 0) {
      video.muted = false;
    }
    showControlsTemporarily();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    showControlsTemporarily();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setVideoState(prev => ({ ...prev, isFullscreen: true }));
    } else {
      document.exitFullscreen();
      setVideoState(prev => ({ ...prev, isFullscreen: false }));
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      setVideoState(prev => ({ ...prev, isFullscreen: false }));
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setVideoState(prev => ({ ...prev, isPiP: false }));
      } else {
        await video.requestPictureInPicture();
        setVideoState(prev => ({ ...prev, isPiP: true }));
      }
    } catch (error) {
      console.error('PiP failed:', error);
      toast({
        title: 'Picture-in-Picture Unavailable',
        description: 'Your browser does not support Picture-in-Picture mode',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const changePlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = rate;
    setVideoState(prev => ({ ...prev, playbackRate: rate }));
    setShowSettings(false);
    showControlsTemporarily();
  }, []);

  // Progress bar interaction
  const handleProgressClick = useCallback((e: React.MouseEvent) => {
    const progressBar = progressRef.current;
    const video = videoRef.current;
    if (!progressBar || !video) return;

    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * video.duration;
    
    seek(newTime);
  }, [seek]);

  const handleProgressHover = useCallback((e: React.MouseEvent) => {
    const progressBar = progressRef.current;
    const video = videoRef.current;
    if (!progressBar || !video) return;

    const rect = progressBar.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const percentage = hoverX / rect.width;
    const hoverTimeValue = percentage * video.duration;
    
    setHoverTime(hoverTimeValue);
  }, []);

  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    resetControlsTimeout();
  }, []);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (videoState.isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [videoState.isPlaying]);

  // Handle container click with audio consideration
  const handleContainerClick = useCallback(async (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      try {
        await togglePlayPause();
      } catch (error) {
        // If autoplay fails, just show controls
        showControlsTemporarily();
      }
    }
  }, [togglePlayPause]);

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle download with proper file fetching
  const handleDownload = useCallback(async () => {
    try {
      await downloadFile(src, fileName);
      toast({
        title: 'Download Complete',
        description: `${fileName} has been downloaded`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: 'Download Failed',
        description: 'Video download failed, please try again',
        variant: 'destructive',
      });
    }
  }, [src, fileName, toast]);

  // Function to handle mouse movement
  const handleMouseMove = useCallback(() => {
    setShowProgressBar(true);
    
    // Clear any existing timeout
    if (progressBarTimeoutRef.current) {
      clearTimeout(progressBarTimeoutRef.current);
    }
    
    // Set timeout to hide progress bar after 2 seconds of inactivity
    progressBarTimeoutRef.current = setTimeout(() => {
      setShowProgressBar(false);
    }, 2000);
  }, []);

  useEffect(() => {
    // Add mouse move listener
    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
      if (progressBarTimeoutRef.current) {
        clearTimeout(progressBarTimeoutRef.current);
      }
    };
  }, [handleMouseMove]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      onClick={handleContainerClick}
      onMouseMove={showControlsTemporarily}
    >
      {/* Hidden canvas for thumbnail generation */}
      <canvas ref={thumbnailCanvasRef} className="hidden" />

      {/* Navigation Arrows */}
      {hasMultipleVideos && (
        <>
          {/* Previous Button */}
          <button
            onClick={() => canGoPrev && onNavigate?.(currentIndex - 1)}
            disabled={!canGoPrev}
            className={`
              absolute left-4 top-1/2 -translate-y-1/2 z-10
              w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm
              flex items-center justify-center text-white
              transition-all duration-200 hover:bg-black/70
              ${!canGoPrev ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'}
              ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}
          >
            <ChevronLeft size={24} />
          </button>

          {/* Next Button */}
          <button
            onClick={() => canGoNext && onNavigate?.(currentIndex + 1)}
            disabled={!canGoNext}
            className={`
              absolute right-4 top-1/2 -translate-y-1/2 z-10
              w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm
              flex items-center justify-center text-white
              transition-all duration-200 hover:bg-black/70
              ${!canGoNext ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'}
              ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Main Video Container */}
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Loading State */}
        {!videoLoaded && !videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-10">
            <div className="w-12 h-12 border-2 border-white/30 border-t-white rounded-full animate-spin mb-4" />
            <div className="text-center">
              <p className="text-lg mb-2">Loading video...</p>
              {downloadSpeed && (
                <p className="text-sm text-white/70">Download speed: {downloadSpeed}</p>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8 z-10">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Video failed to load</h3>
              <p className="text-white/70 mb-4">The video could not be played</p>
              <Button 
                onClick={() => {
                  setVideoError(false);
                  setVideoLoaded(false);
                  if (videoRef.current) {
                    videoRef.current.load();
                  }
                }}
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                <RefreshCw size={16} className="mr-2" />
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          src={src}
          className="max-w-full max-h-full"
          onClick={togglePlayPause}
          poster={thumbnailUrl}
          preload="metadata"
          playsInline
        />

        {/* Buffering Indicator */}
        {videoState.isBuffering && videoLoaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Center Play Button */}
        {!videoState.isPlaying && videoLoaded && !videoError && (
          <button
            onClick={togglePlayPause}
            className={`
              absolute inset-0 flex items-center justify-center
              transition-opacity duration-300
              ${showControls ? 'opacity-100' : 'opacity-0'}
            `}
          >
            <div className="w-20 h-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition-colors">
              <Play size={32} className="text-white ml-1" />
            </div>
          </button>
        )}
      </div>

      {/* Top Toolbar */}
      <div className={`
        absolute top-4 left-1/2 -translate-x-1/2 z-20
        transition-all duration-300 ease-out
        ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}
      `}>
        <div className="flex items-center gap-2 px-4 py-3 bg-black/50 backdrop-blur-sm rounded-full">
          {/* Video Counter */}
          {hasMultipleVideos && (
            <div className="text-white text-sm font-medium px-3">
              {currentVideoNumber} / {totalVideos}
            </div>
          )}

          {/* Download */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            title="Download"
          >
            <Download size={16} />
          </Button>

          {/* Share */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowContactPicker(true)}
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            title="Share/Forward"
          >
            <Share size={16} />
          </Button>

          {/* Picture-in-Picture */}
          <Button
            size="sm"
            variant="ghost"
            onClick={togglePiP}
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            title="Picture-in-Picture"
          >
            <PictureInPicture size={16} />
          </Button>

          {/* Settings */}
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSettings(!showSettings)}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              title="Playback Speed"
            >
              <Settings size={16} />
            </Button>

            {/* Settings Dropdown */}
            {showSettings && (
              <div className="absolute top-full mt-2 right-0 bg-black/80 backdrop-blur-sm rounded-lg p-2 min-w-[120px]">
                <div className="text-white text-xs font-medium mb-2">Playback Speed</div>
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                  <button
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    className={`
                      w-full text-left px-2 py-1 text-sm rounded hover:bg-white/20 transition-colors
                      ${videoState.playbackRate === rate ? 'text-blue-400' : 'text-white'}
                    `}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-white/30 mx-1" />

          {/* Close */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            title="Close (Esc)"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Progress bar with intelligent visibility */}
      <div 
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${
          showProgressBar ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div 
          className="w-full h-1.5 bg-gray-600 rounded-full mb-3 cursor-pointer" 
          ref={progressRef} 
          onClick={handleProgressClick}
        >
          <div 
            className="h-full bg-blue-500 rounded-full" 
            style={{ width: `${(videoState.currentTime / videoState.duration) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Contact Picker Modal */}
      {showContactPicker && (
        <ContactPicker
          isOpen={showContactPicker}
          onClose={() => setShowContactPicker(false)}
          onSelect={(contactIds) => {
            toast({
              title: 'Video Shared',
              description: `Video forwarded to ${contactIds.length} contact(s)`,
            });
            setShowContactPicker(false);
          }}
          multiple={true}
          title="Forward Video"
        />
      )}
    </div>
  );
};

export default VideoPreview; 