import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceMessageProps {
  audioUrl: string;
  duration: number;
  isMyMessage: boolean;
  isUnread?: boolean;
  onPlay?: () => void;
  className?: string;
}

const VoiceMessage: React.FC<VoiceMessageProps> = ({
  audioUrl,
  duration,
  isMyMessage,
  isUnread = false,
  onPlay,
  className
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
      onPlay?.();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedData = () => {
    setIsLoaded(true);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg max-w-xs relative',
      isMyMessage 
        ? 'bg-blue-500 text-white ml-auto' 
        : 'bg-gray-100 text-gray-900',
      className
    )}>
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
      )}

      {/* Play/Pause Button */}
      <button
        onClick={handlePlayPause}
        disabled={!isLoaded}
        className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full transition-colors',
          isMyMessage 
            ? 'bg-white/20 hover:bg-white/30 text-white' 
            : 'bg-gray-200 hover:bg-gray-300 text-gray-700',
          !isLoaded && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>

      {/* Waveform and Progress */}
      <div className="flex-1 space-y-1">
        {/* Waveform visualization */}
        <div 
          className="flex items-center gap-0.5 h-6 cursor-pointer"
          onClick={handleSeek}
        >
          {Array.from({ length: 20 }, (_, i) => {
            const barHeight = Math.random() * 0.7 + 0.3; // Random height between 30% and 100%
            const isActive = (i / 20) * 100 <= progress;
            
            return (
              <div
                key={i}
                className={cn(
                  'w-1 rounded-full transition-colors',
                  isActive 
                    ? isMyMessage ? 'bg-white' : 'bg-blue-500'
                    : isMyMessage ? 'bg-white/40' : 'bg-gray-300'
                )}
                style={{ height: `${barHeight * 100}%` }}
              />
            );
          })}
        </div>

        {/* Time display */}
        <div className={cn(
          'text-xs',
          isMyMessage ? 'text-white/80' : 'text-gray-500'
        )}>
          {isPlaying ? formatTime(currentTime) : formatTime(duration)}
        </div>
      </div>

      {/* Volume indicator */}
      <Volume2 className={cn(
        'w-4 h-4',
        isMyMessage ? 'text-white/60' : 'text-gray-400'
      )} />

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
      />
    </div>
  );
};

export default VoiceMessage; 