import React, { useEffect, useState } from 'react';
import { Mic, MicOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecordingOverlayProps {
  isRecording: boolean;
  duration: number;
  isCancelZone: boolean;
  onCancel: () => void;
  className?: string;
}

const VoiceRecordingOverlay: React.FC<VoiceRecordingOverlayProps> = ({
  isRecording,
  duration,
  isCancelZone,
  onCancel,
  className
}) => {
  const [rippleScale, setRippleScale] = useState(0);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isRecording) {
      // Start ripple animation
      const interval = setInterval(() => {
        setRippleScale(prev => (prev >= 1 ? 0 : prev + 0.1));
      }, 100);
      return () => clearInterval(interval);
    } else {
      setRippleScale(0);
    }
  }, [isRecording]);

  if (!isRecording) return null;

  return (
    <div className={cn(
      'fixed inset-0 bg-black/50 flex items-center justify-center z-50',
      className
    )}>
      {/* Main recording interface */}
      <div className="flex flex-col items-center space-y-6">
        {/* Ripple animation background */}
        <div className="relative">
          {/* Ripple effect */}
          <div 
            className="absolute inset-0 rounded-full border-2 border-white/30"
            style={{
              transform: `scale(${1 + rippleScale})`,
              opacity: 1 - rippleScale,
              width: '120px',
              height: '120px',
              left: '50%',
              top: '50%',
              marginLeft: '-60px',
              marginTop: '-60px',
            }}
          />
          
          {/* Mic icon */}
          <div className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200',
            isCancelZone 
              ? 'bg-red-500 scale-110' 
              : 'bg-blue-500 scale-100'
          )}>
            {isCancelZone ? (
              <MicOff className="w-8 h-8 text-white" />
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </div>
        </div>

        {/* Duration display */}
        <div className="text-white text-2xl font-mono">
          {formatDuration(duration)}
        </div>

        {/* Instructions */}
        <div className="text-center space-y-2">
          {isCancelZone ? (
            <div className="text-red-400 text-lg font-medium">
              <Trash2 className="w-5 h-5 inline mr-2" />
              松开手指，取消发送
            </div>
          ) : (
            <div className="text-white text-lg">
              <span className="font-medium">松开</span> 发送，<span className="font-medium">上滑</span> 取消
            </div>
          )}
          
          <div className="text-white/60 text-sm">
            最长录制 60 秒
          </div>
        </div>

        {/* Cancel zone indicator */}
        <div className={cn(
          'absolute top-20 left-1/2 transform -translate-x-1/2 transition-all duration-200',
          isCancelZone ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        )}>
          <div className="bg-red-500/20 border-2 border-red-500 rounded-lg px-6 py-3">
            <div className="text-red-400 text-sm font-medium flex items-center">
              <Trash2 className="w-4 h-4 mr-2" />
              取消录制区域
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar for max duration */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 w-64">
        <div className="bg-white/20 rounded-full h-1">
          <div 
            className="bg-white rounded-full h-1 transition-all duration-100"
            style={{ width: `${Math.min((duration / 60000) * 100, 100)}%` }}
          />
        </div>
        <div className="text-white/60 text-xs text-center mt-2">
          {duration >= 60000 ? '已达最长录制时间' : ''}
        </div>
      </div>
    </div>
  );
};

export default VoiceRecordingOverlay; 