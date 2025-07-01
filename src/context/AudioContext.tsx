import React, { createContext, useContext, useRef, useState, useCallback, useEffect, ReactNode } from 'react';

interface AudioState {
  currentAudioId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;
}

interface AudioContextType {
  audioState: AudioState;
  playAudio: (audioId: string, src: string, onTimeUpdate?: (time: number) => void) => Promise<void>;
  pauseAudio: () => void;
  stopAudio: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  isCurrentAudio: (audioId: string) => boolean;
  getCurrentAudioElement: () => HTMLAudioElement | null;
  playingAudio: HTMLAudioElement | null;
  setPlayingAudio: (audio: HTMLAudioElement | null) => void;
}

const AudioContext = createContext<AudioContextType | null>(null);

export const useAudioContext = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudioContext must be used within AudioProvider');
  }
  return context;
};

export const AudioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentCallbackRef = useRef<((time: number) => void) | null>(null);
  const [playingAudio, setPlayingAudio] = useState<HTMLAudioElement | null>(null);
  const playingAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [audioState, setAudioState] = useState<AudioState>({
    currentAudioId: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isLoading: false
  });

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    // Event listeners
    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime;
      setAudioState(prev => ({ ...prev, currentTime }));
      if (currentCallbackRef.current) {
        currentCallbackRef.current(currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setAudioState(prev => ({ 
        ...prev, 
        duration: audio.duration,
        isLoading: false 
      }));
    };

    const handlePlay = () => {
      setAudioState(prev => ({ ...prev, isPlaying: true }));
    };

    const handlePause = () => {
      setAudioState(prev => ({ ...prev, isPlaying: false }));
    };

    const handleEnded = () => {
      setAudioState(prev => ({ 
        ...prev, 
        isPlaying: false, 
        currentTime: 0,
        currentAudioId: null 
      }));
      currentCallbackRef.current = null;
    };

    const handleVolumeChange = () => {
      setAudioState(prev => ({ 
        ...prev, 
        volume: audio.volume,
        isMuted: audio.muted 
      }));
    };

    const handleLoadStart = () => {
      setAudioState(prev => ({ ...prev, isLoading: true }));
    };

    const handleCanPlay = () => {
      setAudioState(prev => ({ ...prev, isLoading: false }));
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('volumechange', handleVolumeChange);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('volumechange', handleVolumeChange);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.pause();
      audio.src = '';
    };
  }, []);

  const playAudio = useCallback(async (audioId: string, src: string, onTimeUpdate?: (time: number) => void) => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      // Stop any currently playing audio
      if (audioState.currentAudioId && audioState.currentAudioId !== audioId) {
        audio.pause();
        audio.currentTime = 0;
      }

      // Set new audio source if different
      if (audioState.currentAudioId !== audioId) {
        audio.src = src;
        setAudioState(prev => ({ 
          ...prev, 
          currentAudioId: audioId,
          currentTime: 0,
          isLoading: true 
        }));
      }

      // Set callback for time updates
      currentCallbackRef.current = onTimeUpdate || null;

      // Play audio
      await audio.play();
    } catch (error) {
      console.error('Audio playback failed:', error);
      setAudioState(prev => ({ 
        ...prev, 
        isPlaying: false,
        isLoading: false 
      }));
    }
  }, [audioState.currentAudioId]);

  const pauseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
  }, []);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      setAudioState(prev => ({ 
        ...prev, 
        currentAudioId: null,
        isPlaying: false,
        currentTime: 0 
      }));
      currentCallbackRef.current = null;
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.max(0, Math.min(time, audio.duration));
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
      if (volume > 0) {
        audio.muted = false;
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !audio.muted;
    }
  }, []);

  const isCurrentAudio = useCallback((audioId: string) => {
    return audioState.currentAudioId === audioId;
  }, [audioState.currentAudioId]);

  const getCurrentAudioElement = useCallback(() => {
    return audioRef.current;
  }, []);

  const contextValue: AudioContextType = {
    audioState,
    playAudio,
    pauseAudio,
    stopAudio,
    seekTo,
    setVolume,
    toggleMute,
    isCurrentAudio,
    getCurrentAudioElement,
    playingAudio,
    setPlayingAudio
  };

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}; 