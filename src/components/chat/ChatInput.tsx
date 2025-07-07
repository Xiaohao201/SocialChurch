import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Smile, Send, Plus, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import EmojiPicker from '@/components/shared/EmojiPicker';
import AttachmentMenu, { AttachmentType } from '@/components/chat/AttachmentMenu';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import VoiceRecordingOverlay from '@/components/chat/VoiceRecordingOverlay';

interface ChatInputProps {
  onSend: (text: string) => void;
  onSendVoice?: (audioBlob: Blob, duration: number) => void;
  onAttach?: (type: AttachmentType) => void;
  className?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, onSendVoice, onAttach, className }) => {
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [isCancelZone, setIsCancelZone] = useState(false);
  const attachRef = useRef<HTMLDivElement>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const processedAudioRef = useRef<Blob | null>(null);

  // Voice recording hook
  const [voiceState, voiceActions] = useVoiceRecorder();

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(message.trim());
    setMessage('');
    setShowAttach(false);
  };

  const addEmoji = (emoji: string) => {
    setMessage((prev) => prev + emoji);
  };

  const handleAttachSelect = (type: AttachmentType) => {
    onAttach?.(type);
    setShowAttach(false);
  };

  // Voice recording handlers
  const handleVoiceStart = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎤 Voice recording start triggered');
    
    try {
      await voiceActions.startRecording();
      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      console.log('✅ Voice recording started successfully');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
    }
  }, [voiceActions]);

  const handleVoiceEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎤 Voice recording end triggered, cancelZone:', isCancelZone);
    
    if (isCancelZone) {
      voiceActions.cancelRecording();
      setIsCancelZone(false);
      console.log('❌ Voice recording cancelled');
    } else {
      voiceActions.stopRecording();
      console.log('✅ Voice recording stopped');
    }
    
    // Add haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [isCancelZone, voiceActions]);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!voiceState.isRecording) return;
    e.preventDefault();

    const touch = e.touches[0];
    const micButton = micButtonRef.current;
    if (!micButton) return;

    const rect = micButton.getBoundingClientRect();
    const touchY = touch.clientY;
    const buttonY = rect.top;
    
    // Check if touch moved up significantly (cancel zone)
    const moveDistance = buttonY - touchY;
    const cancelThreshold = 100; // pixels
    
    const inCancelZone = moveDistance > cancelThreshold;
    setIsCancelZone(inCancelZone);
    
    console.log('📱 Touch move:', { moveDistance, inCancelZone });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!voiceState.isRecording) return;
    e.preventDefault();

    const micButton = micButtonRef.current;
    if (!micButton) return;

    const rect = micButton.getBoundingClientRect();
    const mouseY = e.clientY;
    const buttonY = rect.top;
    
    // Check if mouse moved up significantly (cancel zone)
    const moveDistance = buttonY - mouseY;
    const cancelThreshold = 100; // pixels
    
    const inCancelZone = moveDistance > cancelThreshold;
    setIsCancelZone(inCancelZone);
    
    console.log('🖱️ Mouse move:', { moveDistance, inCancelZone });
  };

  // Handle mouse leave - if recording and mouse leaves, stop recording
  const handleMouseLeave = (e: React.MouseEvent) => {
    if (!voiceState.isRecording) return;
    console.log('🖱️ Mouse left button area while recording');
    handleVoiceEnd(e);
  };

  // Handle voice recording completion
  useEffect(() => {
    if (voiceState.audioBlob && !voiceState.isRecording && voiceState.audioBlob !== processedAudioRef.current) {
      console.log('🎤 Processing new audio blob, size:', voiceState.audioBlob.size);
      processedAudioRef.current = voiceState.audioBlob;
      
      // Calculate duration from blob if possible, or use recorded duration
      const duration = voiceState.duration;
      console.log('🎤 Sending voice message with duration:', duration, 'ms');
      onSendVoice?.(voiceState.audioBlob, duration);
      
      // Clear the audio blob to prevent reprocessing
      setTimeout(() => {
        voiceActions.clearAudioBlob();
      }, 100);
    }
  }, [voiceState.audioBlob, voiceState.isRecording, onSendVoice, voiceState.duration, voiceActions]);

  // Reset processed audio ref when recording starts
  useEffect(() => {
    if (voiceState.isRecording) {
      processedAudioRef.current = null;
      console.log('🎤 Recording started, reset processed audio ref');
    }
  }, [voiceState.isRecording]);

  // Handle voice recording errors
  useEffect(() => {
    if (voiceState.error) {
      // Just log the error, don't show toast
      console.error('🎤 Voice recording error:', voiceState.error);
    }
  }, [voiceState.error]);

  // Global mouse/touch event handling for voice recording
  useEffect(() => {
    if (!voiceState.isRecording) return;

    const handleGlobalMouseUp = (e: MouseEvent) => {
      console.log('🌍 Global mouse up detected');
      handleVoiceEnd(e as any);
    };

    const handleGlobalTouchEnd = (e: TouchEvent) => {
      console.log('🌍 Global touch end detected');
      handleVoiceEnd(e as any);
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!micButtonRef.current) return;
      
      const rect = micButtonRef.current.getBoundingClientRect();
      const mouseY = e.clientY;
      const buttonY = rect.top;
      
      const moveDistance = buttonY - mouseY;
      const cancelThreshold = 100;
      
      const inCancelZone = moveDistance > cancelThreshold;
      setIsCancelZone(inCancelZone);
    };

    // Add global event listeners
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalTouchEnd);
    document.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [voiceState.isRecording, handleVoiceEnd]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(event.target as Node)) {
        setShowAttach(false);
      }
    };

    if (showAttach) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttach]);

  return (
    <div className={cn('relative border-t bg-background/60 px-4 py-3 backdrop-blur', className)}>
      <div className="flex items-center gap-2">
        <div className="relative" ref={attachRef}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg"
            onClick={() => {
              setShowAttach((p) => !p);
              setShowEmoji(false);
            }}
            aria-label="附件"
          >
            <Plus className="h-5 w-5 text-muted-foreground" />
          </Button>
          <AttachmentMenu open={showAttach} onSelect={handleAttachSelect} className="absolute bottom-full mb-1" />
        </div>

        <div className="relative flex-1">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="输入消息..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="rounded-xl bg-background/70 px-4 py-3 shadow-inner placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-accent-blue"
          />

          {showEmoji && (
            <div className="absolute bottom-full mb-2 right-0 z-20">
              <EmojiPicker
                isOpen={showEmoji}
                onClose={() => setShowEmoji(false)}
                onEmojiSelect={(emoji) => addEmoji(emoji)}
              />
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg"
          onClick={() => {
            setShowEmoji((p) => !p);
            setShowAttach(false);
          }}
          aria-label="表情"
        >
          <Smile className="h-5 w-5 text-muted-foreground" />
        </Button>

        {message.trim() ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg bg-accent-blue text-white hover:bg-accent-blue"
            onClick={handleSend}
            aria-label="发送"
          >
            <Send className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            ref={micButtonRef}
            variant="ghost"
            size="icon"
            className={cn(
              'h-10 w-10 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg select-none',
              voiceState.isRecording && 'bg-red-500 text-white scale-110'
            )}
            onMouseDown={handleVoiceStart}
            onMouseUp={handleVoiceEnd}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleVoiceStart}
            onTouchEnd={handleVoiceEnd}
            onTouchMove={handleTouchMove}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="语音消息"
            style={{ touchAction: 'none' }}
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Voice recording overlay */}
      <VoiceRecordingOverlay
        isRecording={voiceState.isRecording}
        duration={voiceState.duration}
        isCancelZone={isCancelZone}
        onCancel={() => {
          voiceActions.cancelRecording();
          setIsCancelZone(false);
        }}
      />
    </div>
  );
};

export default ChatInput; 