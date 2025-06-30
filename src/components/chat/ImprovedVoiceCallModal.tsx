import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ImprovedVoiceCallService, CallStatus, defaultImprovedVoiceCallConfig, NetworkQuality } from '@/lib/webrtc/improvedVoiceCall';
import { useUserContext } from '@/context/AuthContext';
import { getUserAvatarUrl } from '@/lib/appwrite/api';
import Loader from '../shared/Loader';
import { Wifi, WifiOff } from 'lucide-react';

// 图标
const PhoneHangupIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" transform="rotate(135 12 12)"></path>
  </svg>
);

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
  </svg>
);

const MuteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-white">
    <path d="m12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z"></path>
    <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);

const UnmuteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-white">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
  </svg>
);

// Function to fetch TURN credentials from your backend
const fetchTurnCredentials = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/get-turn-credentials');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const turnServers = await response.json();
    return turnServers;
  } catch (error) {
    console.error('Failed to fetch TURN credentials:', error);
    return []; // Return empty array on failure
  }
};

interface ImprovedVoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    name: string;
    avatar?: string;
  };
  mode: 'outgoing' | 'incoming';
  incomingOffer?: RTCSessionDescriptionInit | null;
  onIncomingCall?: (fromUserId: string, callerInfo: { userId: string; offer: RTCSessionDescriptionInit; callerName?: string; callerAvatar?: string }) => void;
}

const NetworkStatusIndicator: React.FC<{ quality: NetworkQuality }> = ({ quality }) => {
  if (quality === 'unknown') {
    return null;
  }

  const qualityMap = {
    good: { text: '网络良好', color: 'text-green-500' },
    average: { text: '网络一般', color: 'text-yellow-500' },
    poor: { text: '网络较差', color: 'text-red-500' },
  };

  const { text, color } = qualityMap[quality];

  return (
    <div className={`flex items-center gap-1 text-xs ${color}`}>
      <Wifi size={14} />
      <span>{text}</span>
    </div>
  );
};

const ImprovedVoiceCallModal: React.FC<ImprovedVoiceCallModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  mode,
  incomingOffer,
  onIncomingCall
}) => {
  const { user } = useUserContext();
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('unknown');
  
  const voiceServiceRef = useRef<ImprovedVoiceCallService | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isServiceInitialized, setIsServiceInitialized] = useState(false);

  // 初始化语音通话服务
  useEffect(() => {
    const initializeService = async () => {
      if (isOpen && user?.$id && !voiceServiceRef.current) {
        try {
          console.log('🚀 Initializing voice call service...');
          console.log('📡 Fetching TURN credentials...');
          const turnServers = await fetchTurnCredentials();

          const iceConfig = {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              ...turnServers, // Add the TURN servers from Twilio
            ],
          };
          
          console.log('🎙️ Using ICE Configuration:', iceConfig);
          voiceServiceRef.current = new ImprovedVoiceCallService(iceConfig);
          
          // 设置回调函数
          voiceServiceRef.current.setCallbacks({
            onStatusChange: (status) => {
              console.log('📱 通话状态变化:', status);
              setCallStatus(status);
              if (status === 'connected') {
                startCallTimer();
              } else if (status === 'ended' || status === 'rejected' || status === 'failed') {
                stopCallTimer();
                setTimeout(() => {
                  onClose();
                }, 2000);
              }
            },
            onRemoteStream: (stream) => {
              console.log('🔊 接收到远程音频流');
              if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = stream;
                remoteAudioRef.current.play().catch(error => {
                  console.error('播放远程音频失败:', error);
                });
              }
            },
            onError: (error) => {
              console.error('❌ 语音通话错误:', error);
              setError(error.message);
              setCallStatus('failed');
            },
            onIncomingCall: (fromUserId, callerInfo) => {
              console.log('📞 收到来电通知:', fromUserId, callerInfo);
              // 调用父组件传入的回调函数
              if (onIncomingCall) {
                onIncomingCall(fromUserId, callerInfo);
              }
            },
            onNetworkQualityChange: (quality) => {
              setNetworkQuality(quality);
            }
          });

          // 初始化用户
          const currentUserInfo = {
            id: user.$id,
            name: user.name || '未知用户',
            avatar: getUserAvatarUrl(user.imageUrl)
          };
          await voiceServiceRef.current.initializeUser(user.$id, currentUserInfo);
          
          setIsServiceInitialized(true);
          console.log('✅ 语音通话服务初始化完成');

        } catch (error) {
          console.error('❌ 初始化语音通话服务失败:', error);
          setError('初始化语音通话服务失败');
        }
      }
    };

    initializeService();

    return () => {
      if (voiceServiceRef.current) {
        voiceServiceRef.current.destroy();
        voiceServiceRef.current = null;
        setIsServiceInitialized(false);
        setIsMuted(false); // 重置静音状态
      }
      stopCallTimer();
    };
  }, [isOpen, user?.$id, onClose]);

  // 处理传入的 offer（来电）
  useEffect(() => {
    if (incomingOffer && mode === 'incoming' && isServiceInitialized && voiceServiceRef.current) {
      console.log('📞 处理来电 offer - 设置状态为ringing');
      console.log('📞 来电者信息:', targetUser);
      setCallStatus('ringing');
    }
  }, [incomingOffer, mode, isServiceInitialized, targetUser]);

  // 如果是来电模式，直接设置为ringing状态，不需要等待服务初始化
  useEffect(() => {
    if (mode === 'incoming' && isOpen) {
      console.log('📞 来电模式 - 立即设置为ringing状态');
      console.log('📞 来电者:', targetUser);
      setCallStatus('ringing');
    }
  }, [mode, isOpen, targetUser]);

  // 开始通话计时器
  const startCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
    }
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
    if (!voiceServiceRef.current || !isServiceInitialized) {
      setError('语音通话服务未初始化');
      return;
    }

    try {
      // 确保传递完整的 targetUser 对象
      const fullTargetUser = {
        id: targetUser.id,
        name: targetUser.name,
        avatar: getUserAvatarUrl(targetUser.avatar)
      };
      await voiceServiceRef.current.initiateCall(fullTargetUser);
    } catch (error: any) {
      console.error('发起通话失败:', error);
      setError(error.message || '发起通话失败');
    }
  };

  // 接听通话
  const handleAnswerCall = async () => {
    console.log('🎯 开始接听通话流程');
    console.log('🔍 当前状态检查:', {
      voiceServiceRef: !!voiceServiceRef.current,
      isServiceInitialized,
      incomingOffer: !!incomingOffer,
      targetUser,
      mode,
      callStatus
    });

    if (!voiceServiceRef.current) {
      const errorMsg = '语音服务未初始化';
      console.error('❌', errorMsg);
      setError(errorMsg);
      return;
    }

    if (!isServiceInitialized) {
      const errorMsg = '语音服务未完成初始化';
      console.error('❌', errorMsg);
      setError(errorMsg);
      return;
    }

    if (!incomingOffer) {
      const errorMsg = '没有收到来电offer信息';
      console.error('❌', errorMsg);
      setError(errorMsg);
      return;
    }

    try {
      console.log('📞 开始调用answerCall方法');
      
      const callerInfo = {
        userId: targetUser.id,
        offer: incomingOffer,
        callerName: targetUser.name,
        callerAvatar: getUserAvatarUrl(targetUser.avatar)
      };
      
      setError(null); // 清除之前的错误
      await voiceServiceRef.current.answerCall(callerInfo);
      
      console.log('✅ answerCall调用成功');
    } catch (error: any) {
      console.error('❌ 接听通话失败:', error);
      console.error('❌ 错误详情:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      setError(error.message || '接听通话失败');
    }
  };

  // 拒绝通话
  const handleRejectCall = async () => {
    if (voiceServiceRef.current) {
      await voiceServiceRef.current.rejectCall(targetUser.id);
    }
    onClose();
  };

  // 结束通话
  const handleEndCall = async () => {
    if (!voiceServiceRef.current) {
      return;
    }

    try {
      await voiceServiceRef.current.endCall();
    } catch (error: any) {
      console.error('结束通话失败:', error);
    }
  };

  // 切换静音
  const handleToggleMute = () => {
    if (voiceServiceRef.current) {
      const newMuteState = voiceServiceRef.current.toggleMute();
      setIsMuted(newMuteState);
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    // 特殊处理来电模式
    if (mode === 'incoming') {
      switch (callStatus) {
        case 'idle':
        case 'ringing':
          return '来电中，请选择接听或拒绝';
        case 'connected':
          return `通话中 ${formatDuration(callDuration)}`;
        case 'ended':
          return '通话已结束';
        case 'rejected':
          return '已拒绝通话';
        case 'failed':
          return '通话失败';
        default:
          return '收到来电';
      }
    }
    
    // 外拨模式的状态文本
    switch (callStatus) {
      case 'calling':
        return '正在呼叫...';
      case 'ringing':
        return '等待接听...';
      case 'connected':
        return `通话中 ${formatDuration(callDuration)}`;
      case 'ended':
        return '通话已结束';
      case 'rejected':
        return '通话被拒绝';
      case 'failed':
        return '通话失败';
      default:
        return '准备中...';
    }
  };

  // 获取状态颜色
  const getStatusColor = () => {
    switch (callStatus) {
      case 'calling':
      case 'ringing':
        return 'text-yellow-500';
      case 'connected':
        return 'text-green-500';
      case 'ended':
        return 'text-gray-500';
      case 'rejected':
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-light-2';
    }
  };

  // 自动发起通话（外拨模式）
  useEffect(() => {
    if (mode === 'outgoing' && callStatus === 'idle' && isServiceInitialized) {
      handleStartCall();
    }
  }, [mode, callStatus, isServiceInitialized]);

  if (!isOpen) return null;

  // 调试信息
  console.log('🎯 ImprovedVoiceCallModal 渲染状态:', {
    isOpen,
    mode,
    callStatus,
    targetUser,
    isServiceInitialized,
    incomingOffer: !!incomingOffer,
    error
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-dark-2 border-dark-4">
        <div className="flex flex-col items-center space-y-6 p-6">
          {/* 远程音频元素 */}
          <audio 
            ref={remoteAudioRef} 
            autoPlay 
            className="hidden"
          />

          {/* 用户头像 */}
          <div className="relative">
            {/* 背景光环效果 */}
            {(callStatus === 'calling' || callStatus === 'ringing') && (
              <div className="absolute inset-0 rounded-full bg-yellow-500/20 animate-ping" />
            )}
            {callStatus === 'connected' && (
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-pulse" />
            )}
            
            {/* 主头像 */}
            <img
              src={targetUser.avatar || '/assets/icons/profile-placeholder.svg'}
              alt={targetUser.name}
              className="relative w-32 h-32 rounded-full object-cover border-4 border-dark-4 shadow-2xl"
              onError={(e) => {
                // 如果头像加载失败，先尝试生成基于用户名的头像
                console.log('📷 头像加载失败，原URL:', (e.target as HTMLImageElement).src);
                const target = e.target as HTMLImageElement;
                
                if (target.src !== '/assets/icons/profile-placeholder.svg') {
                  // 如果还没有尝试过用户名头像，先尝试生成一个
                  if (targetUser.name && !target.src.includes('avatars/initials')) {
                    const initialsUrl = `https://fra.cloud.appwrite.io/v1/avatars/initials?name=${encodeURIComponent(targetUser.name)}&project=6846b9f900368f67ddb4`;
                    console.log('📷 尝试使用用户名生成头像:', initialsUrl);
                    target.src = initialsUrl;
                  } else {
                    console.log('📷 使用默认头像');
                    target.src = '/assets/icons/profile-placeholder.svg';
                  }
                }
              }}
              onLoad={() => {
                console.log('📷 ✅ 头像加载成功:', targetUser.avatar);
                console.log('📷 ✅ 显示的用户:', targetUser.name);
              }}
            />
            
            {/* 状态指示环 */}
            <div className={`absolute inset-0 rounded-full border-4 transition-colors duration-300 ${
              callStatus === 'calling' || callStatus === 'ringing' 
                ? 'border-yellow-500 animate-pulse shadow-lg shadow-yellow-500/50' 
                : callStatus === 'connected'
                ? 'border-green-500 shadow-lg shadow-green-500/50'
                : callStatus === 'failed' || callStatus === 'rejected'
                ? 'border-red-500 shadow-lg shadow-red-500/50'
                : 'border-gray-500'
            }`} />
            
            {/* 通话状态图标 */}
            {callStatus === 'ringing' && mode === 'incoming' && (
              <div className="absolute -top-2 -right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center animate-bounce shadow-lg">
                <span className="text-white text-lg">📞</span>
              </div>
            )}
            
            {callStatus === 'connected' && (
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">🔊</span>
              </div>
            )}
            
            {callStatus === 'calling' && (
              <div className="absolute -top-2 -right-2 w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center animate-spin shadow-lg">
                <span className="text-white text-lg">📱</span>
              </div>
            )}
          </div>

          {/* 用户信息 */}
          <div className="text-center">
            <DialogTitle className="text-2xl font-bold text-light-1 mb-2">
              {targetUser.name}
            </DialogTitle>
            <DialogDescription className={`text-lg ${getStatusColor()}`}>
              {getStatusText()}
            </DialogDescription>
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>

          {/* 通话状态和时长 */}
          <div className="text-center mt-2">
            <p className={`text-sm ${getStatusColor()}`}>{getStatusText()}</p>
            {callStatus === 'connected' && (
              <div className="flex items-center justify-center gap-x-4 mt-1">
                <p className="text-sm text-gray-300">{formatDuration(callDuration)}</p>
                <NetworkStatusIndicator quality={networkQuality} />
              </div>
            )}
          </div>

          {/* 通话控制按钮 */}
          <div className="flex items-center justify-center gap-x-6 mt-8">
            {/* 静音按钮 - 仅在通话连接时显示 */}
            {callStatus === 'connected' && (
              <Button
                onClick={handleToggleMute}
                className="rounded-full w-16 h-16 flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors"
              >
                {isMuted ? <MuteIcon /> : <UnmuteIcon />}
              </Button>
            )}

            {/* 挂断按钮 */}
            {['calling', 'ringing', 'connected'].includes(callStatus) && (
              <Button
                onClick={handleEndCall}
                className="rounded-full w-16 h-16 flex items-center justify-center bg-red-500 hover:bg-red-600 transition-colors"
              >
                <PhoneHangupIcon />
              </Button>
            )}

            {/* 接听按钮 */}
            {callStatus === 'ringing' && (
              <Button
                onClick={handleAnswerCall}
                className="rounded-full w-16 h-16 flex items-center justify-center bg-green-500 hover:bg-green-600 transition-colors"
              >
                <PhoneIcon />
              </Button>
            )}
          </div>

          {/* 调试信息（开发环境） */}
          {import.meta.env.DEV && (
            <div className="text-xs text-gray-400 text-center">
              <p>状态: {callStatus}</p>
              <p>服务: {isServiceInitialized ? '已初始化' : '未初始化'}</p>
              <p>模式: {mode}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImprovedVoiceCallModal;