import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAudioContext } from '@/context/AudioContext';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Download,
  Headphones,
  Loader
} from 'lucide-react';
import { generateWaveformData, loadAudioBuffer, generateFallbackWaveform, WaveformData } from '@/utils/audioWaveform';
import { downloadFile } from '@/utils/downloadUtils';

interface AudioPlayerProps {
  audioId: string;
  src: string;
  fileName: string;
  fileSize: string;
  isMyMessage: boolean;
  className?: string;
}

// Waveform visualization component
const Waveform: React.FC<{
  waveformData: WaveformData;
  progress: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  className?: string;
}> = ({ waveformData, progress, isPlaying, onSeek, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverProgress, setHoverProgress] = useState(0);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData.peaks.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const barWidth = width / waveformData.peaks.length;
    const progressWidth = width * progress;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw waveform bars
    waveformData.peaks.forEach((peak, index) => {
      const barHeight = peak * height * 0.8; // Leave some padding
      const x = index * barWidth;
      const y = (height - barHeight) / 2;
      
      // Choose color based on progress
      const isPastProgress = x < progressWidth;
      ctx.fillStyle = isPastProgress 
        ? (isPlaying ? '#3b82f6' : '#6b7280') // Blue when playing, gray when paused
        : '#e5e7eb'; // Light gray for unplayed

      // Add rounded rectangle for better appearance
      ctx.beginPath();
      ctx.roundRect(x + 1, y, Math.max(2, barWidth - 2), barHeight, 1);
      ctx.fill();
    });

    // Draw hover indicator
    if (isHovering) {
      const hoverX = width * hoverProgress;
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
    }
  }, [waveformData, progress, isPlaying, isHovering, hoverProgress]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickProgress = clickX / rect.width;
    const seekTime = clickProgress * waveformData.duration;
    
    onSeek(seekTime);
  }, [waveformData.duration, onSeek]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const hoverProg = Math.max(0, Math.min(1, hoverX / rect.width));
    
    setHoverProgress(hoverProg);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={180}
      height={32}
      className={`cursor-pointer transition-opacity hover:opacity-80 ${className}`}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    />
  );
};

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioId,
  src,
  fileName,
  fileSize,
  isMyMessage,
  className = ''
}) => {
  const { toast } = useToast();
  const { audioState, playAudio, pauseAudio, seekTo, setVolume, toggleMute, isCurrentAudio } = useAudioContext();
  
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isLoadingWaveform, setIsLoadingWaveform] = useState(true);
  const [localProgress, setLocalProgress] = useState(0);

  const isCurrentlyPlaying = isCurrentAudio(audioId);
  const isPlaying = isCurrentlyPlaying && audioState.isPlaying;
  const currentTime = isCurrentlyPlaying ? audioState.currentTime : 0;
  const duration = isCurrentlyPlaying ? audioState.duration : waveformData?.duration || 0;
  const progress = duration > 0 ? currentTime / duration : 0;

  // Load and generate waveform data
  useEffect(() => {
    let cancelled = false;
    
    const loadWaveform = async () => {
      setIsLoadingWaveform(true);
      
      try {
        const audioBuffer = await loadAudioBuffer(src);
        if (cancelled) return;
        
        const waveform = await generateWaveformData(audioBuffer, 120);
        if (cancelled) return;
        
        setWaveformData(waveform);
      } catch (error) {
        console.warn('Failed to generate waveform, using fallback:', error);
        if (!cancelled) {
          // Estimate duration from file size (rough approximation)
          const estimatedDuration = Math.max(30, Math.min(300, parseFloat(fileSize.replace(/[^\d.]/g, '')) * 10));
          setWaveformData(generateFallbackWaveform(estimatedDuration, 120));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWaveform(false);
        }
      }
    };

    loadWaveform();
    
    return () => {
      cancelled = true;
    };
  }, [src, fileSize]);

  // Handle play/pause
  const handlePlayPause = useCallback(async () => {
    try {
      if (isCurrentlyPlaying && isPlaying) {
        pauseAudio();
      } else {
        await playAudio(audioId, src, setLocalProgress);
      }
    } catch (error) {
      console.error('Audio playback failed:', error);
      toast({
        title: 'Playback Failed',
        description: 'Unable to play audio file',
        variant: 'destructive'
      });
    }
  }, [audioId, src, isCurrentlyPlaying, isPlaying, playAudio, pauseAudio, toast]);

  // Handle seeking
  const handleSeek = useCallback((time: number) => {
    if (isCurrentlyPlaying) {
      seekTo(time);
    } else {
      // Start playing from the seek position
      playAudio(audioId, src).then(() => {
        seekTo(time);
      });
    }
  }, [audioId, src, isCurrentlyPlaying, seekTo, playAudio]);

  // Format time display
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Truncate filename for display
  const displayName = useMemo(() => {
    if (fileName.length <= 25) return fileName;
    const ext = fileName.split('.').pop() || '';
    const nameWithoutExt = fileName.slice(0, fileName.length - ext.length - 1);
    const keepStart = Math.floor((25 - ext.length - 3) / 2);
    const keepEnd = Math.ceil((25 - ext.length - 3) / 2);
    return `${nameWithoutExt.slice(0, keepStart)}...${nameWithoutExt.slice(-keepEnd)}.${ext}`;
  }, [fileName]);

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
        description: 'Audio download failed, please try again',
        variant: 'destructive',
      });
    }
  }, [src, fileName, toast]);

  return (
    <div className={`
      flex items-center gap-2 p-2 rounded-lg transition-all duration-200 w-full max-w-xs
      ${isMyMessage 
        ? 'bg-blue-500 text-white' 
        : 'bg-gray-100 text-gray-800'
      }
      ${className}
    `}>
      {/* Play/Pause Button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={handlePlayPause}
        disabled={audioState.isLoading && isCurrentlyPlaying}
        className={`
          flex-shrink-0 h-8 w-8 rounded-full p-0
          ${isMyMessage 
            ? 'hover:bg-white/20 text-white' 
            : 'hover:bg-black/10 text-gray-600'
          }
        `}
      >
        {audioState.isLoading && isCurrentlyPlaying ? (
          <Loader className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </Button>

      {/* Waveform and Time */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        {isLoadingWaveform || !waveformData ? (
          <div className="h-8 flex items-center">
            <span className={`text-xs ${isMyMessage ? 'text-white/70' : 'text-gray-500'}`}>
              Loading...
            </span>
          </div>
        ) : (
          <>
            <Waveform
              waveformData={waveformData}
              progress={progress}
              isPlaying={isPlaying}
              onSeek={handleSeek}
              className="h-8"
            />
            <div className="flex justify-between items-center mt-0.5">
              <span className={`text-[10px] font-mono tabular-nums ${isMyMessage ? 'text-white/60' : 'text-gray-500'}`}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <span className={`text-[10px] truncate max-w-[120px] ${isMyMessage ? 'text-white/60' : 'text-gray-500'}`}>
                {displayName}
              </span>
            </div>
          </>
        )}
      </div>
      
      {/* Download Button */}
      <Button
        onClick={handleDownload}
        variant="ghost"
        size="icon"
        className={`
          flex-shrink-0 h-8 w-8 rounded-full p-0
          ${isMyMessage 
            ? 'bg-white/20 text-white hover:bg-white/30' 
            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
          }
        `}
        title="Download audio"
      >
        <Download className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default AudioPlayer; 