import { appwriteSignalingService } from './appwriteSignaling';
import { VideoCallMessage } from './signalingTypes';

export interface VideoCallConfig {
  iceServers: RTCIceServer[];
}

export type VideoCallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'failed';

export class VideoCallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: VideoCallConfig;
  private currentUserId: string = '';
  private targetUserId: string = '';
  private callStatus: VideoCallStatus = 'idle';
  
  // 媒体状态
  private isAudioEnabled = true;
  private isVideoEnabled = true;
  
  // 当前用户信息
  private currentUserInfo: { name?: string; avatar?: string } = {};

  // 回调函数
  private onStatusChange?: (status: VideoCallStatus) => void;
  private onRemoteStream?: (stream: MediaStream) => void;
  private onLocalStream?: (stream: MediaStream) => void;
  private onError?: (error: Error) => void;
  private onIncomingCall?: (fromUserId: string, callerInfo: { userId: string; offer: RTCSessionDescriptionInit; callerName?: string; callerAvatar?: string }) => void;
  private onRemoteVideoToggle?: (enabled: boolean) => void;
  private onRemoteAudioToggle?: (enabled: boolean) => void;

  // 状态追踪
  private iceCandidatesQueue: RTCIceCandidateInit[] = [];
  private isInitiator = false;
  private connectionTimeout?: NodeJS.Timeout;

  constructor(config: VideoCallConfig) {
    this.config = config;
    this.setupSignalingCallbacks();
  }

  // 初始化用户
  async initializeUser(userId: string): Promise<void> {
    this.currentUserId = userId;
    await appwriteSignalingService.registerUser(userId, this.handleSignalMessage.bind(this));
    this.setupSignalingCallbacks();
  }

  // 设置回调函数
  setCallbacks(callbacks: {
    onStatusChange?: (status: VideoCallStatus) => void;
    onRemoteStream?: (stream: MediaStream) => void;
    onLocalStream?: (stream: MediaStream) => void;
    onError?: (error: Error) => void;
    onIncomingCall?: (fromUserId: string, callerInfo: { userId: string; offer: RTCSessionDescriptionInit; callerName?: string; callerAvatar?: string }) => void;
    onRemoteVideoToggle?: (enabled: boolean) => void;
    onRemoteAudioToggle?: (enabled: boolean) => void;
  }): void {
    this.onStatusChange = callbacks.onStatusChange;
    this.onRemoteStream = callbacks.onRemoteStream;
    this.onLocalStream = callbacks.onLocalStream;
    this.onError = callbacks.onError;
    this.onIncomingCall = callbacks.onIncomingCall;
    this.onRemoteVideoToggle = callbacks.onRemoteVideoToggle;
    this.onRemoteAudioToggle = callbacks.onRemoteAudioToggle;
  }

  // 设置当前用户信息
  setCurrentUserInfo(userInfo: { name?: string; avatar?: string }): void {
    this.currentUserInfo = userInfo;
    console.log('📝 设置当前用户信息:', this.currentUserInfo);
  }

  // 发起视频通话
  async initiateCall(targetUserId: string): Promise<void> {
    try {
      this.targetUserId = targetUserId;
      this.isInitiator = true;
      this.updateCallStatus('calling');

      console.log(`📹 向用户 ${targetUserId} 发起视频通话`);
      console.log('📝 当前用户信息:', this.currentUserInfo);

      // 获取用户媒体（音频+视频）
      await this.getUserMedia();
      
      // 创建PeerConnection
      await this.createPeerConnection();
      
      // 添加本地流
      this.addLocalStreamToPeerConnection();
      
      // 创建offer
      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await this.peerConnection!.setLocalDescription(offer);
      console.log('✅ 创建并设置本地描述(offer)成功');

      // 发送offer给目标用户
      const signalMessage = {
        type: 'offer' as const,
        payload: offer,
        from: this.currentUserId,
        to: targetUserId,
        callerName: this.currentUserInfo.name,
        callerAvatar: this.currentUserInfo.avatar
      };
      
      console.log('📤 发送视频通话信令消息:', signalMessage);
      await this.sendSignalMessage(signalMessage);

      // 设置连接超时
      this.setConnectionTimeout();

    } catch (error) {
      console.error('❌ 发起视频通话失败:', error);
      this.handleError(error as Error);
    }
  }

  // 接听来电
  async answerCall(fromUserId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      this.targetUserId = fromUserId;
      this.isInitiator = false;
      this.updateCallStatus('ringing');

      console.log(`📹 接听来自用户 ${fromUserId} 的视频通话`);

      // 获取用户媒体（音频+视频）
      await this.getUserMedia();
      
      // 创建PeerConnection
      await this.createPeerConnection();
      
      // 添加本地流
      this.addLocalStreamToPeerConnection();
      
      // 设置远程描述(offer)
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('✅ 设置远程描述(offer)成功');

      // 处理队列中的ICE候选
      await this.processQueuedIceCandidates();
      
      // 创建answer
      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);
      console.log('✅ 创建并设置本地描述(answer)成功');

      // 发送answer给发起者
      await this.sendSignalMessage({
        type: 'answer',
        payload: answer,
        from: this.currentUserId,
        to: fromUserId
      });

      // 发送接听确认
      await this.sendSignalMessage({
        type: 'call-accept',
        from: this.currentUserId,
        to: fromUserId
      });

    } catch (error) {
      console.error('❌ 接听视频通话失败:', error);
      this.handleError(error as Error);
    }
  }

  // 拒绝来电
  async rejectCall(fromUserId: string): Promise<void> {
    await this.sendSignalMessage({
      type: 'call-reject',
      from: this.currentUserId,
      to: fromUserId
    });
    this.updateCallStatus('rejected');
  }

  // 结束通话
  async endCall(): Promise<void> {
    if (this.targetUserId) {
      await this.sendSignalMessage({
        type: 'call-end',
        from: this.currentUserId,
        to: this.targetUserId
      });
    }
    this.cleanup();
    this.updateCallStatus('ended');
  }

  // 切换音频状态
  toggleAudio(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        this.isAudioEnabled = !this.isAudioEnabled;
        audioTrack.enabled = this.isAudioEnabled;
        console.log(`🎤 音频 ${this.isAudioEnabled ? '开启' : '关闭'}`);

        // 通知对方音频状态变化
        if (this.targetUserId) {
          this.sendSignalMessage({
            type: 'audio-toggle',
            payload: { enabled: this.isAudioEnabled },
            from: this.currentUserId,
            to: this.targetUserId
          });
        }
      }
    }
    return !this.isAudioEnabled; // 返回是否静音
  }

  // 切换视频状态
  toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        this.isVideoEnabled = !this.isVideoEnabled;
        videoTrack.enabled = this.isVideoEnabled;
        console.log(`📹 视频 ${this.isVideoEnabled ? '开启' : '关闭'}`);

        // 通知对方视频状态变化
        if (this.targetUserId) {
          this.sendSignalMessage({
            type: 'video-toggle',
            payload: { enabled: this.isVideoEnabled },
            from: this.currentUserId,
            to: this.targetUserId
          });
        }
      }
    }
    return this.isVideoEnabled;
  }

  // 获取音频和视频状态
  getMediaStatus(): { audioEnabled: boolean; videoEnabled: boolean } {
    return {
      audioEnabled: this.isAudioEnabled,
      videoEnabled: this.isVideoEnabled
    };
  }

  // 处理信令消息
  private async handleSignalMessage(message: VideoCallMessage): Promise<void> {
    console.log('📨 收到视频通话信令消息:', message);

    try {
      switch (message.type) {
        case 'offer':
          console.log('📞 收到视频通话邀请');
          if (this.onIncomingCall) {
            this.onIncomingCall(message.from, {
              userId: message.from,
              offer: message.payload,
              callerName: message.callerName,
              callerAvatar: message.callerAvatar
            });
          }
          break;

        case 'answer':
          console.log('📞 收到通话应答');
          if (this.peerConnection && this.isInitiator) {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload));
            console.log('✅ 设置远程描述(answer)成功');
            await this.processQueuedIceCandidates();
          }
          break;

        case 'ice-candidate':
          console.log('🧊 收到ICE候选');
          await this.handleIceCandidate(message.payload);
          break;

        case 'call-accept':
          console.log('✅ 对方接听了通话');
          this.clearConnectionTimeout();
          this.updateCallStatus('connected');
          break;

        case 'call-reject':
          console.log('❌ 对方拒绝了通话');
          this.updateCallStatus('rejected');
          break;

        case 'call-end':
          console.log('📞 对方结束了通话');
          this.cleanup();
          this.updateCallStatus('ended');
          break;

        case 'video-toggle':
          console.log('📹 对方切换了视频状态:', message.payload?.enabled);
          if (this.onRemoteVideoToggle) {
            this.onRemoteVideoToggle(message.payload?.enabled || false);
          }
          break;

        case 'audio-toggle':
          console.log('🎤 对方切换了音频状态:', message.payload?.enabled);
          if (this.onRemoteAudioToggle) {
            this.onRemoteAudioToggle(message.payload?.enabled || false);
          }
          break;

        default:
          console.warn('⚠️ 未知的信令消息类型:', message.type);
      }
    } catch (error) {
      console.error('❌ 处理信令消息失败:', error);
      this.handleError(error as Error);
    }
  }

  // 创建PeerConnection
  private async createPeerConnection(): Promise<void> {
    try {
      this.peerConnection = new RTCPeerConnection(this.config);
      console.log('✅ 创建PeerConnection成功');

      // 监听ICE候选
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 发现新的ICE候选');
          this.sendSignalMessage({
            type: 'ice-candidate',
            payload: event.candidate.toJSON(),
            from: this.currentUserId,
            to: this.targetUserId
          });
        }
      };

      // 监听远程流
      this.peerConnection.ontrack = (event) => {
        console.log('📺 接收到远程媒体流');
        this.remoteStream = event.streams[0];
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      };

      // 监听连接状态变化
      this.peerConnection.onconnectionstatechange = () => {
        console.log('🔗 连接状态变化:', this.peerConnection?.connectionState);
        switch (this.peerConnection?.connectionState) {
          case 'connected':
            this.clearConnectionTimeout();
            this.updateCallStatus('connected');
            break;
          case 'disconnected':
          case 'failed':
            this.handleError(new Error('连接失败'));
            break;
          case 'closed':
            this.updateCallStatus('ended');
            break;
        }
      };

      // 监听ICE连接状态变化
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('🧊 ICE连接状态:', this.peerConnection?.iceConnectionState);
        switch (this.peerConnection?.iceConnectionState) {
          case 'connected':
          case 'completed':
            this.clearConnectionTimeout();
            this.updateCallStatus('connected');
            break;
          case 'failed':
            this.handleError(new Error('ICE连接失败'));
            break;
          case 'disconnected':
            console.warn('⚠️ ICE连接断开');
            break;
        }
      };

    } catch (error) {
      console.error('❌ 创建PeerConnection失败:', error);
      throw error;
    }
  }

  // 获取用户媒体（音频+视频）
  private async getUserMedia(): Promise<void> {
    try {
      console.log('📹🎤 请求音频和视频权限...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        },
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: 'user'
        }
      });
      console.log('✅ 音频和视频权限获取成功');
      
      // 通知UI本地流可用
      if (this.onLocalStream) {
        this.onLocalStream(this.localStream);
      }
      
    } catch (error: any) {
      let errorMessage = '获取摄像头和麦克风权限失败';
      
      switch (error.name) {
        case 'NotAllowedError':
          errorMessage = '摄像头或麦克风权限被拒绝，请在浏览器设置中允许访问';
          break;
        case 'NotFoundError':
          errorMessage = '未找到可用的摄像头或麦克风设备';
          break;
        case 'NotReadableError':
          errorMessage = '摄像头或麦克风正被其他应用使用';
          break;
        case 'OverconstrainedError':
          errorMessage = '摄像头不支持请求的配置';
          break;
      }
      
      throw new Error(errorMessage);
    }
  }

  // 添加本地流到PeerConnection
  private addLocalStreamToPeerConnection(): void {
    if (this.localStream && this.peerConnection) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
        console.log(`➕ 添加 ${track.kind} 轨道到PeerConnection`);
      });
    }
  }

  // 处理ICE候选
  private async handleIceCandidate(candidateInit: RTCIceCandidateInit): Promise<void> {
    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
        console.log('✅ 添加ICE候选成功');
      } catch (error) {
        console.error('❌ 添加ICE候选失败:', error);
      }
    } else {
      // 如果还没有远程描述，将ICE候选加入队列
      console.log('📤 ICE候选加入队列，等待远程描述');
      this.iceCandidatesQueue.push(candidateInit);
    }
  }

  // 处理队列中的ICE候选
  private async processQueuedIceCandidates(): Promise<void> {
    console.log(`🔄 处理队列中的 ${this.iceCandidatesQueue.length} 个ICE候选`);
    
    for (const candidateInit of this.iceCandidatesQueue) {
      try {
        await this.peerConnection!.addIceCandidate(new RTCIceCandidate(candidateInit));
        console.log('✅ 处理队列ICE候选成功');
      } catch (error) {
        console.error('❌ 处理队列ICE候选失败:', error);
      }
    }
    
    this.iceCandidatesQueue = [];
  }

  // 发送信令消息
  private async sendSignalMessage(message: VideoCallMessage): Promise<void> {
    try {
      await appwriteSignalingService.sendSignal(message);
    } catch (error) {
      console.error('❌ 发送视频通话信令消息失败:', error);
      throw error;
    }
  }

  // 设置信令回调
  private setupSignalingCallbacks(): void {
    // 已在initializeUser中设置
  }

  // 更新通话状态
  private updateCallStatus(status: VideoCallStatus): void {
    this.callStatus = status;
    console.log(`📹 视频通话状态更新: ${status}`);
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  // 设置连接超时
  private setConnectionTimeout(): void {
    this.connectionTimeout = setTimeout(() => {
      console.log('⏰ 视频通话连接超时');
      this.handleError(new Error('连接超时'));
    }, 30000); // 30秒超时
  }

  // 清除连接超时
  private clearConnectionTimeout(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = undefined;
    }
  }

  // 错误处理
  private handleError(error: Error): void {
    console.error('❌ 视频通话错误:', error);
    
    // 只有在通话未结束时才设置为失败状态
    if (this.callStatus !== 'ended' && this.callStatus !== 'failed') {
      this.updateCallStatus('failed');
    }
    
    this.cleanup();
    
    if (this.onError) {
      this.onError(error);
    }
  }

  // 清理资源
  private cleanup(): void {
    console.log('🧹 清理视频通话资源');
    
    this.clearConnectionTimeout();
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.remoteStream = null;
    this.iceCandidatesQueue = [];
    this.targetUserId = '';
    this.isInitiator = false;
    this.isAudioEnabled = true;
    this.isVideoEnabled = true;
  }

  // 销毁服务
  destroy(): void {
    this.cleanup();
    if (this.currentUserId) {
      appwriteSignalingService.unregisterUser(this.currentUserId, this.handleSignalMessage.bind(this));
    }
    this.updateCallStatus('idle');
  }

  // 获取当前状态
  getCallStatus(): VideoCallStatus {
    return this.callStatus;
  }

  // 获取本地流
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // 获取远程流
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  // 获取通话统计信息
  async getCallStats(): Promise<RTCStatsReport | null> {
    if (this.peerConnection) {
      return await this.peerConnection.getStats();
    }
    return null;
  }
}

// 默认配置 - 包含多个STUN和TURN服务器
export const defaultVideoCallConfig: VideoCallConfig = {
  iceServers: [
    // Google STUN服务器（免费）
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
    // 开放的TURN服务器（免费，有流量限制）
    { 
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    { 
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    { 
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
}; 