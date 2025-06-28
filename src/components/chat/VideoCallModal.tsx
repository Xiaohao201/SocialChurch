import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VideoCallService, VideoCallStatus, defaultVideoCallConfig } from '@/lib/webrtc/videoCall';
import { useUserContext } from '@/context/AuthContext';
import { getUserAvatarUrl } from '@/lib/appwrite/api';

interface VideoCallModalProps {
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

const VideoCallModal: React.FC<VideoCallModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  mode,
  incomingOffer,
  onIncomingCall
}) => {
  const { user } = useUserContext();
  const [callStatus, setCallStatus] = useState<VideoCallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  
  const videoServiceRef = useRef<VideoCallService | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isServiceInitialized, setIsServiceInitialized] = useState(false);

  // 初始化视频通话服务
  useEffect(() => {
    const initializeService = async () => {
      if (isOpen && user?.$id && !videoServiceRef.current) {
        try {
          console.log('🚀 初始化视频通话服务');
          console.log('👤 当前用户:', user);
          console.log('🎯 目标用户:', targetUser);
          console.log('📋 模式:', mode);
          videoServiceRef.current = new VideoCallService(defaultVideoCallConfig);
          
          // 设置回调函数
          videoServiceRef.current.setCallbacks({
            onStatusChange: (status) => {
              console.log('📹 视频通话状态变化:', status);
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
            onLocalStream: (stream) => {
              console.log('📹 本地视频流可用');
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.play().catch(error => {
                  console.error('播放本地视频失败:', error);
                });
              }
            },
            onRemoteStream: (stream) => {
              console.log('📺 接收到远程视频流');
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
                remoteVideoRef.current.play().catch(error => {
                  console.error('播放远程视频失败:', error);
                });
              }
            },
            onError: (error) => {
              console.error('❌ 视频通话错误:', error);
              setError(error.message);
              setCallStatus('failed');
            },
            onIncomingCall: (fromUserId, callerInfo) => {
              console.log('📹 收到视频通话邀请:', fromUserId, callerInfo);
              if (onIncomingCall) {
                onIncomingCall(fromUserId, callerInfo);
              }
            },
            onRemoteVideoToggle: (enabled) => {
              console.log('📹 对方视频状态变化:', enabled);
              setRemoteVideoEnabled(enabled);
            },
            onRemoteAudioToggle: (enabled) => {
              console.log('🎤 对方音频状态变化:', enabled);
              setRemoteAudioEnabled(enabled);
            }
          });

          // 初始化用户
          await videoServiceRef.current.initializeUser(user.$id);
          
          // 设置当前用户信息
          const userInfo = {
            name: user.name || '未知用户',
            avatar: getUserAvatarUrl(user.imageUrl)
          };
          
          console.log('📝 设置当前用户信息:', userInfo);
          videoServiceRef.current.setCurrentUserInfo(userInfo);
          
          setIsServiceInitialized(true);
          console.log('✅ 视频通话服务初始化完成');
          console.log('🔧 服务状态:', {
            isServiceInitialized: true,
            targetUserId: targetUser.id,
            mode: mode
          });

        } catch (error) {
          console.error('❌ 初始化视频通话服务失败:', error);
          setError('初始化视频通话服务失败');
        }
      }
    };

    initializeService();

    return () => {
      if (videoServiceRef.current) {
        videoServiceRef.current.destroy();
        videoServiceRef.current = null;
        setIsServiceInitialized(false);
      }
      stopCallTimer();
    };
  }, [isOpen, user?.$id, onClose]);

  // 处理传入的 offer（来电）
  useEffect(() => {
    if (incomingOffer && mode === 'incoming' && isServiceInitialized && videoServiceRef.current) {
      console.log('📹 处理视频通话 offer');
      setCallStatus('ringing');
    }
  }, [incomingOffer, mode, isServiceInitialized]);

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
    if (!videoServiceRef.current || !isServiceInitialized) {
      setError('视频通话服务未初始化');
      return;
    }

    try {
      await videoServiceRef.current.initiateCall(targetUser.id);
    } catch (error: any) {
      console.error('发起视频通话失败:', error);
      setError(error.message || '发起视频通话失败');
    }
  };

  // 接听通话
  const handleAnswerCall = async () => {
    if (!videoServiceRef.current || !isServiceInitialized || !incomingOffer) {
      setError('无法接听视频通话');
      return;
    }

    try {
      await videoServiceRef.current.answerCall(targetUser.id, incomingOffer);
    } catch (error: any) {
      console.error('接听视频通话失败:', error);
      setError(error.message || '接听视频通话失败');
    }
  };

  // 拒绝通话
  const handleRejectCall = async () => {
    if (!videoServiceRef.current || !isServiceInitialized) {
      return;
    }

    try {
      await videoServiceRef.current.rejectCall(targetUser.id);
    } catch (error: any) {
      console.error('拒绝视频通话失败:', error);
    }
    onClose();
  };

  // 结束通话
  const handleEndCall = async () => {
    if (!videoServiceRef.current) {
      return;
    }

    try {
      await videoServiceRef.current.endCall();
    } catch (error: any) {
      console.error('结束视频通话失败:', error);
    }
  };

  // 切换静音
  const handleToggleMute = () => {
    if (videoServiceRef.current) {
      const muted = videoServiceRef.current.toggleAudio();
      setIsMuted(muted);
    }
  };

  // 切换视频
  const handleToggleVideo = () => {
    if (videoServiceRef.current) {
      const enabled = videoServiceRef.current.toggleVideo();
      setIsVideoEnabled(enabled);
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    switch (callStatus) {
      case 'calling':
        return '正在呼叫...';
      case 'ringing':
        return mode === 'incoming' ? '视频通话邀请' : '等待接听...';
      case 'connected':
        return `视频通话中 ${formatDuration(callDuration)}`;
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-w-full bg-dark-2 border-dark-4 p-0 overflow-hidden">
        <div className="relative w-full h-[80vh] bg-black">
          {/* 远程视频 - 主窗口 */}
          <div className="relative w-full h-full">
            {callStatus === 'connected' ? (
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }} // 镜像显示，更自然
              />
            ) : (
              // 通话前显示对方头像
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-dark-3 to-dark-4">
                <div className="text-center">
                  {/* 用户头像 */}
                  <div className="relative mb-6">
                    {/* 背景光环效果 */}
                    {(callStatus === 'calling' || callStatus === 'ringing') && (
                      <div className="absolute inset-0 rounded-full bg-yellow-500/20 animate-ping scale-110" />
                    )}
                    
                    {/* 主头像 */}
                    <img
                      src={targetUser.avatar || '/assets/icons/profile-placeholder.svg'}
                      alt={targetUser.name}
                      className="relative w-32 h-32 rounded-full object-cover border-4 border-dark-4 shadow-2xl mx-auto"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src !== '/assets/icons/profile-placeholder.svg') {
                          if (targetUser.name && !target.src.includes('avatars/initials')) {
                            const initialsUrl = `https://fra.cloud.appwrite.io/v1/avatars/initials?name=${encodeURIComponent(targetUser.name)}&project=6846b9f900368f67ddb4`;
                            target.src = initialsUrl;
                          } else {
                            target.src = '/assets/icons/profile-placeholder.svg';
                          }
                        }
                      }}
                    />
                  </div>

                  {/* 用户名和状态 */}
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
              </div>
            )}

            {/* 远程视频状态覆盖层 */}
            {callStatus === 'connected' && !remoteVideoEnabled && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="mb-4">
                    <img
                      src={targetUser.avatar || '/assets/icons/profile-placeholder.svg'}
                      alt={targetUser.name}
                      className="w-24 h-24 rounded-full object-cover mx-auto border-2 border-gray-400"
                    />
                  </div>
                  <p className="text-lg">{targetUser.name}</p>
                  <p className="text-sm text-gray-400">摄像头已关闭</p>
                </div>
              </div>
            )}

            {/* 本地视频 - 小窗口 */}
            {callStatus === 'connected' && (
              <div className="absolute top-4 right-4 w-32 h-24 bg-black rounded-lg overflow-hidden border-2 border-gray-600 shadow-lg">
                {isVideoEnabled ? (
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }} // 镜像显示
                  />
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <span className="text-white text-xs">摄像头关闭</span>
                  </div>
                )}
              </div>
            )}

            {/* 控制按钮 */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
              <div className="flex items-center space-x-4 bg-black/50 backdrop-blur-sm rounded-full px-6 py-3">
                {/* 静音按钮 */}
                {(callStatus === 'connected' || callStatus === 'calling') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`w-12 h-12 rounded-full ${
                      isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
                    }`}
                    onClick={handleToggleMute}
                  >
                    <span className="text-xl">{isMuted ? '🔇' : '🎤'}</span>
                  </Button>
                )}

                {/* 视频切换按钮 */}
                {(callStatus === 'connected' || callStatus === 'calling') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`w-12 h-12 rounded-full ${
                      !isVideoEnabled ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-700'
                    }`}
                    onClick={handleToggleVideo}
                  >
                    <span className="text-xl">{isVideoEnabled ? '📹' : '📷'}</span>
                  </Button>
                )}

                {/* 主要操作按钮 */}
                {callStatus === 'ringing' && mode === 'incoming' ? (
                  <>
                    {/* 接听按钮 */}
                    <Button
                      className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600"
                      onClick={handleAnswerCall}
                    >
                      <span className="text-xl">📹</span>
                    </Button>
                    {/* 拒绝按钮 */}
                    <Button
                      className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600"
                      onClick={handleRejectCall}
                    >
                      <span className="text-xl">❌</span>
                    </Button>
                  </>
                ) : (
                  /* 结束通话按钮 */
                  <Button
                    className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600"
                    onClick={handleEndCall}
                    disabled={callStatus === 'idle' || !isServiceInitialized}
                  >
                    <span className="text-xl">📞</span>
                  </Button>
                )}
              </div>
            </div>

            {/* 状态信息（非连接状态时显示） */}
            {callStatus !== 'connected' && (
              <div className="absolute top-6 left-1/2 transform -translate-x-1/2">
                <div className="bg-black/50 backdrop-blur-sm rounded-full px-4 py-2">
                  <p className={`text-sm ${getStatusColor()}`}>{getStatusText()}</p>
                </div>
              </div>
            )}

            {/* 远程音频静音指示 */}
            {callStatus === 'connected' && !remoteAudioEnabled && (
              <div className="absolute top-6 right-6">
                <div className="bg-red-500/80 backdrop-blur-sm rounded-full px-3 py-1">
                  <span className="text-white text-xs">🔇 对方已静音</span>
                </div>
              </div>
            )}

            {/* 调试信息（开发环境） */}
            {import.meta.env.DEV && (
              <div className="absolute bottom-6 left-6 text-xs text-gray-400 bg-black/50 backdrop-blur-sm rounded px-2 py-1">
                <p>状态: {callStatus}</p>
                <p>服务: {isServiceInitialized ? '已初始化' : '未初始化'}</p>
                <p>模式: {mode}</p>
                <p>本地视频: {isVideoEnabled ? '开启' : '关闭'}</p>
                <p>远程视频: {remoteVideoEnabled ? '开启' : '关闭'}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VideoCallModal; 