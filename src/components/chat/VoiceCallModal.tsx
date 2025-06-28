import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VoiceCallService, CallMessage, defaultVoiceCallConfig } from '@/lib/webrtc/voiceCall';

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    id: string;
    name: string;
    avatar?: string;
  };
  targetUser: {
    id: string;
    name: string;
    avatar?: string;
  };
  mode: 'outgoing' | 'incoming' | 'connected';
  onSendSignal: (message: CallMessage) => void;
  onCallAnswer?: () => void;
  onCallReject?: () => void;
  incomingOffer?: RTCSessionDescriptionInit | null; // 传入的 offer
  onSignalReceived?: (handler: (message: CallMessage) => Promise<void>) => void; // 注册信令处理器
}

const VoiceCallModal: React.FC<VoiceCallModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetUser,
  mode,
  onSendSignal,
  onCallAnswer,
  onCallReject,
  incomingOffer,
  onSignalReceived
}) => {
  const [callStatus, setCallStatus] = useState<'calling' | 'connected' | 'ended' | 'rejected'>('calling');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const voiceServiceRef = useRef<VoiceCallService | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  // 初始化语音通话服务
  useEffect(() => {
    if (isOpen) {
      voiceServiceRef.current = new VoiceCallService(defaultVoiceCallConfig);
      
      // 设置消息回调
      voiceServiceRef.current.setMessageCallback((message: CallMessage) => {
        message.from = currentUser.id;
        message.to = targetUser.id;
        onSendSignal(message);
      });

      // 设置通话状态回调
      voiceServiceRef.current.setCallStatusCallback((status) => {
        setCallStatus(status);
        if (status === 'connected') {
          startCallTimer();
        } else if (status === 'ended' || status === 'rejected') {
          stopCallTimer();
          setTimeout(onClose, 1000); // 延迟关闭，让用户看到状态
        }
      });

      // 设置远程音频回调
      voiceServiceRef.current.setRemoteAudioCallback((stream) => {
        console.log('🔊 接收到远程音频流:', stream);
        console.log('🔊 音频轨道数量:', stream.getAudioTracks().length);
        if (remoteAudioRef.current && stream.getAudioTracks().length > 0) {
          console.log('🔊 设置远程音频流到 audio 元素');
          remoteAudioRef.current.srcObject = stream;
          
          // 确保音频能够播放
          const playPromise = remoteAudioRef.current.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log('🔊 远程音频开始播放');
              })
              .catch(error => {
                console.error('🔊 播放远程音频失败:', error);
                // 尝试用户交互后播放
                const playOnUserInteraction = () => {
                  if (remoteAudioRef.current) {
                    remoteAudioRef.current.play().catch(e => 
                      console.error('🔊 用户交互后播放仍失败:', e)
                    );
                  }
                  document.removeEventListener('click', playOnUserInteraction);
                };
                document.addEventListener('click', playOnUserInteraction);
              });
          }
        } else {
          console.error('🔊 无法设置音频流：remoteAudioRef 或音频轨道不可用');
        }
      });

      return () => {
        if (voiceServiceRef.current) {
          voiceServiceRef.current.destroy();
        }
        stopCallTimer();
      };
    }
  }, [isOpen, currentUser.id, targetUser.id, onSendSignal, onClose]);

  // 处理接收到的信令消息
  const handleIncomingSignal = useCallback(async (message: CallMessage) => {
    console.log('🎯 VoiceCallModal 处理信令:', message);
    
    if (!voiceServiceRef.current) return;

    try {
      switch (message.type) {
        case 'answer':
          console.log('📱 处理 answer');
          await voiceServiceRef.current.handleAnswer(message.payload);
          setCallStatus('connected');
          break;
        case 'ice-candidate':
          console.log('🧊 处理 ICE 候选');
          await voiceServiceRef.current.handleIceCandidate(message.payload);
          break;
        case 'call-end':
          console.log('📞 对方结束通话');
          setCallStatus('ended');
          setTimeout(onClose, 1000);
          break;
        case 'call-reject':
          console.log('❌ 对方拒绝通话');
          setCallStatus('rejected');
          setTimeout(onClose, 1000);
          break;
      }
    } catch (error) {
      console.error('处理信令失败:', error);
    }
  }, [onClose]);

  // 注册信令处理回调 - 只在组件挂载时执行一次
  useEffect(() => {
    if (onSignalReceived) {
      onSignalReceived(handleIncomingSignal);
    }
  }, [onSignalReceived]); // 移除 handleIncomingSignal 依赖，避免无限循环

  // 处理传入的 offer
  useEffect(() => {
    if (incomingOffer && mode === 'incoming') {
      pendingOfferRef.current = incomingOffer;
    }
  }, [incomingOffer, mode]);

  // 开始通话计时器
  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // 停止通话计时器
  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  };

  // 格式化通话时长
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 发起通话
  const handleStartCall = async () => {
    if (voiceServiceRef.current) {
      try {
        await voiceServiceRef.current.startCall(targetUser.id, currentUser.id);
      } catch (error: any) {
        console.error('发起通话失败:', error);
        const errorMessage = error.message || '发起通话失败，请检查麦克风权限';
        alert(errorMessage);
        onClose();
      }
    }
  };

  // 接听通话
  const handleAnswerCall = async () => {
    if (voiceServiceRef.current && mode === 'incoming' && pendingOfferRef.current) {
      try {
        console.log('📱 接听通话，处理 offer:', pendingOfferRef.current);
        await voiceServiceRef.current.answerCall(
          pendingOfferRef.current,
          targetUser.id,
          currentUser.id
        );
        if (onCallAnswer) {
          onCallAnswer();
        }
      } catch (error: any) {
        console.error('接听通话失败:', error);
        const errorMessage = error.message || '接听通话失败，请检查麦克风权限';
        alert(errorMessage);
        onClose();
      }
    }
  };

  // 拒绝通话
  const handleRejectCall = () => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.rejectCall(targetUser.id, currentUser.id);
    }
    if (onCallReject) {
      onCallReject();
    }
    onClose();
  };

  // 结束通话
  const handleEndCall = () => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.endCall(targetUser.id, currentUser.id);
    }
    stopCallTimer();
    onClose();
  };

  // 切换静音
  const handleToggleMute = () => {
    if (voiceServiceRef.current) {
      const muted = voiceServiceRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  // 当组件挂载时，如果是外拨模式则自动发起通话
  useEffect(() => {
    if (mode === 'outgoing' && voiceServiceRef.current) {
      handleStartCall();
    }
  }, [mode]);

  const getStatusText = () => {
    switch (mode) {
      case 'outgoing':
        return callStatus === 'calling' ? '正在呼叫...' : '通话中';
      case 'incoming':
        return '来电';
      case 'connected':
        return '通话中';
      default:
        return '通话中';
    }
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case 'calling':
        return 'text-yellow-400';
      case 'connected':
        return 'text-green-400';
      case 'ended':
        return 'text-gray-400';
      case 'rejected':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-dark-2 border-dark-4">
        <DialogTitle className="sr-only">语音通话 - {targetUser.name}</DialogTitle>
        <DialogDescription className="sr-only">
          {mode === 'incoming' ? `来自 ${targetUser.name} 的语音通话` : `正在与 ${targetUser.name} 进行语音通话`}
        </DialogDescription>
        <div className="flex flex-col items-center space-y-6 p-6">
          {/* 远程音频元素 */}
          <audio
            ref={remoteAudioRef}
            autoPlay
            playsInline
            controls={false}
            muted={false}
            style={{ display: 'none' }}
          />

          {/* 用户头像 */}
          <div className="relative">
            <img
              src={targetUser.avatar || '/assets/icons/profile-placeholder.svg'}
              alt={targetUser.name}
              className="w-32 h-32 rounded-full border-4 border-dark-4"
            />
            {/* 音频波形指示器 */}
            {callStatus === 'connected' && (
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                <div className="flex space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`w-1 bg-green-400 rounded-full transition-all duration-300 ${
                        audioLevel > i * 20 ? 'h-4' : 'h-2'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 用户信息 */}
          <div className="text-center">
            <h3 className="text-xl font-semibold text-light-1 mb-2">
              {targetUser.name}
            </h3>
            <p className={`text-sm ${getStatusColor()}`}>
              {getStatusText()}
            </p>
            {callStatus === 'connected' && (
              <p className="text-light-3 text-sm mt-1">
                {formatDuration(callDuration)}
              </p>
            )}
          </div>

          {/* 控制按钮 */}
          <div className="flex space-x-4">
            {mode === 'incoming' && callStatus === 'calling' && (
              <>
                <Button
                  onClick={handleAnswerCall}
                  className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.924 2.617a.997.997 0 00-.215-.322l-.004-.004A.997.997 0 0017 2h-4a1 1 0 100 2h1.586l-3.293 3.293a1 1 0 001.414 1.414L16 5.414V7a1 1 0 102 0V3a.997.997 0 00-.076-.383z"/>
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                  </svg>
                </Button>
                <Button
                  onClick={handleRejectCall}
                  className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3.707 14.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 12.586l.707-.707a1 1 0 00-1.414-1.414L5 12.586zm.707-.707l2.586-2.586a1 1 0 00-1.414-1.414L5.707 11.88l.707.707zm2.586-2.586l2.586-2.586a1 1 0 00-1.414-1.414L7.879 9.879l.414.414zm2.586-2.586l2.586-2.586a1 1 0 00-1.414-1.414L10.465 7.293l.414.414z"/>
                  </svg>
                </Button>
              </>
            )}

            {(mode === 'outgoing' || mode === 'connected' || callStatus === 'connected') && (
              <>
                <Button
                  onClick={handleToggleMute}
                  className={`w-16 h-16 rounded-full ${
                    isMuted 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-dark-3 hover:bg-dark-4'
                  }`}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    {isMuted ? (
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd"/>
                    ) : (
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM15.657 6.343a1 1 0 011.414 0c1.97 1.97 1.97 5.162 0 7.071a1 1 0 11-1.414-1.414 3.313 3.313 0 000-4.243 1 1 0 010-1.414z" clipRule="evenodd"/>
                    )}
                  </svg>
                </Button>
              </>
            )}

            <Button
              onClick={handleEndCall}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600"
            >
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3.707 14.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 12.586l.707-.707a1 1 0 00-1.414-1.414L5 12.586zm.707-.707l2.586-2.586a1 1 0 00-1.414-1.414L5.707 11.88l.707.707zm2.586-2.586l2.586-2.586a1 1 0 00-1.414-1.414L7.879 9.879l.414.414zm2.586-2.586l2.586-2.586a1 1 0 00-1.414-1.414L10.465 7.293l.414.414z"/>
              </svg>
            </Button>
          </div>

          {/* 通话状态信息 */}
          {callStatus === 'calling' && mode === 'outgoing' && (
            <div className="text-center">
              <div className="animate-pulse flex space-x-1 justify-center">
                <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              </div>
              <p className="text-light-3 text-sm mt-2">等待对方接听...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceCallModal; 