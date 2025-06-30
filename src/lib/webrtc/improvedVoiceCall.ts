import { appwriteSignalingService } from './appwriteSignaling';
import { CallMessage } from './signalingTypes';

export type { CallMessage } from './signalingTypes';

export interface VoiceCallConfig {
  iceServers: RTCIceServer[];
}

export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'failed';

export class ImprovedVoiceCallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: VoiceCallConfig;
  private currentUserId: string = '';
  private targetUserId: string = '';
  private callStatus: CallStatus = 'idle';
  
  // 当前用户信息
  private currentUserInfo: { name?: string; avatar?: string } = {};

  // 回调函数
  private onStatusChange?: (status: CallStatus) => void;
  private onRemoteStream?: (stream: MediaStream) => void;
  private onError?: (error: Error) => void;
  private onIncomingCall?: (fromUserId: string, callerInfo: { userId: string; offer: RTCSessionDescriptionInit; callerName?: string; callerAvatar?: string }) => void;

  // 状态追踪
  private iceCandidatesQueue: RTCIceCandidateInit[] = [];
  private isInitiator = false;
  private connectionTimeout?: NodeJS.Timeout;

  constructor(config: VoiceCallConfig) {
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
    onStatusChange?: (status: CallStatus) => void;
    onRemoteStream?: (stream: MediaStream) => void;
    onError?: (error: Error) => void;
    onIncomingCall?: (fromUserId: string, callerInfo: { userId: string; offer: RTCSessionDescriptionInit; callerName?: string; callerAvatar?: string }) => void;
  }): void {
    this.onStatusChange = callbacks.onStatusChange;
    this.onRemoteStream = callbacks.onRemoteStream;
    this.onError = callbacks.onError;
    this.onIncomingCall = callbacks.onIncomingCall;
  }

  // 设置当前用户信息
  setCurrentUserInfo(userInfo: { name?: string; avatar?: string }): void {
    this.currentUserInfo = userInfo;
    console.log('📝 设置当前用户信息:', this.currentUserInfo);
  }

  // 发起语音通话
  async initiateCall(targetUserId: string): Promise<void> {
    try {
      this.targetUserId = targetUserId;
      this.isInitiator = true;
      this.updateCallStatus('calling');

      console.log(`📞 向用户 ${targetUserId} 发起语音通话`);
      console.log('📝 当前用户信息:', this.currentUserInfo);

      // 获取用户媒体
      await this.getUserMedia();
      
      // 创建PeerConnection
      await this.createPeerConnection();
      
      // 添加本地流
      this.addLocalStreamToPeerConnection();
      
      // 创建offer
      const offer = await this.peerConnection!.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false
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
      
      console.log('📤 发送信令消息:', signalMessage);
      await this.sendSignalMessage(signalMessage);

      // 设置连接超时
      this.setConnectionTimeout();

    } catch (error) {
      console.error('❌ 发起通话失败:', error);
      this.handleError(error as Error);
    }
  }

  // 接听来电
  async answerCall(fromUserId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      this.targetUserId = fromUserId;
      this.isInitiator = false;
      this.updateCallStatus('ringing');

      console.log(`📞 接听来自用户 ${fromUserId} 的语音通话`);

      // 获取用户媒体
      await this.getUserMedia();
      
      // 创建PeerConnection
      await this.createPeerConnection();

      // 添加本地流到PeerConnection
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
      console.error('❌ 接听通话失败:', error);
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

  // 切换静音状态
  toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled; // 返回是否静音
      }
    }
    return false;
  }

  // 处理信令消息
  private async handleSignalMessage(message: CallMessage): Promise<void> {
    console.log(`🔔 收到信令消息 ${message.type} 来自 ${message.from}`);

    // 只处理当前通话相关的消息
    if (this.targetUserId && message.from !== this.targetUserId && message.to !== this.currentUserId) {
      console.log('⏭️ 跳过非当前通话的消息');
      return;
    }

    // 如果通话已结束，忽略后续消息（除了新的来电）
    if ((this.callStatus === 'ended' || this.callStatus === 'failed') && message.type !== 'offer') {
      console.log(`⏭️ 跳过已结束通话的消息: ${message.type}`);
      return;
    }

    try {
      switch (message.type) {
        case 'offer':
          if (this.callStatus === 'idle') {
            // 通知上层有来电，传递完整的来电者信息
            if (this.onIncomingCall) {
              // 创建包含来电者信息的对象
              const callerInfo = {
                userId: message.from,
                offer: message.payload,
                // 可以在这里添加更多来电者信息，如果信令消息中包含的话
                callerName: message.callerName || undefined,
                callerAvatar: message.callerAvatar || undefined
              };
              console.log('📞 触发来电回调，来电者信息:', callerInfo);
              this.onIncomingCall(message.from, callerInfo);
            }
          }
          break;

        case 'answer':
          if (this.isInitiator && this.peerConnection && this.peerConnection.signalingState === 'have-local-offer') {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.payload));
            console.log('✅ 设置远程描述(answer)成功');
            await this.processQueuedIceCandidates();
          } else if (this.isInitiator && this.peerConnection?.signalingState === 'stable') {
            console.log('⏭️ 跳过重复的answer，连接已建立');
          } else {
            console.log(`⚠️ 忽略answer消息，当前状态: isInitiator=${this.isInitiator}, signalingState=${this.peerConnection?.signalingState}`);
          }
          break;

        case 'ice-candidate':
          await this.handleIceCandidate(message.payload);
          break;

        case 'call-accept':
          if (this.callStatus === 'calling') {
            this.updateCallStatus('connected');
            this.clearConnectionTimeout();
          } else {
            console.log('⏭️ 跳过重复的call-accept消息');
          }
          break;

        case 'call-reject':
          this.updateCallStatus('rejected');
          this.cleanup();
          break;

        case 'call-end':
          this.updateCallStatus('ended');
          this.cleanup();
          break;
      }
    } catch (error) {
      console.error('❌ 处理信令消息失败:', error);
      this.handleError(error as Error);
    }
  }

  // 创建PeerConnection
  private async createPeerConnection(): Promise<void> {
    this.peerConnection = new RTCPeerConnection(this.config);

    // ICE候选事件
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 生成ICE候选:', event.candidate.candidate);
        this.sendSignalMessage({
          type: 'ice-candidate',
          payload: event.candidate,
          from: this.currentUserId,
          to: this.targetUserId
        });
      } else {
        console.log('🧊 ICE候选收集完成');
      }
    };

    // 远程流事件
    this.peerConnection.ontrack = (event) => {
      console.log('🎵 接收到远程音频流');
      this.remoteStream = event.streams[0];
      if (this.onRemoteStream) {
        this.onRemoteStream(this.remoteStream);
      }
    };

    // 连接状态变化
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔗 PeerConnection状态:', state);
      
      if (state === 'connected' && this.callStatus !== 'failed') {
        this.updateCallStatus('connected');
        this.clearConnectionTimeout();
      } else if (state === 'disconnected') {
        console.log('🔌 连接断开，等待重连...');
        // 不立即结束通话，给连接重建的机会
      } else if (state === 'failed') {
        console.log('❌ 连接失败');
        this.updateCallStatus('failed');
        this.cleanup();
      } else if (state === 'closed') {
        console.log('📞 连接已关闭');
        if (this.callStatus !== 'ended' && this.callStatus !== 'failed') {
          this.updateCallStatus('ended');
        }
        this.cleanup();
      }
    };

    // ICE连接状态变化
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('🧊 ICE连接状态:', state);
      
      if (state === 'connected' || state === 'completed') {
        console.log('✅ ICE连接成功建立');
        this.clearConnectionTimeout();
      } else if (state === 'failed') {
        console.log('❌ ICE连接失败');
        this.handleError(new Error('ICE连接失败'));
      } else if (state === 'disconnected') {
        console.log('🔌 ICE连接断开，尝试重连...');
        // 给ICE一些时间尝试重连
        setTimeout(() => {
          if (this.peerConnection?.iceConnectionState === 'disconnected') {
            console.log('⚠️ ICE重连超时');
            this.handleError(new Error('ICE连接断开超时'));
          }
        }, 10000); // 10秒重连超时
      }
    };
  }

  // 获取用户媒体
  private async getUserMedia(): Promise<void> {
    try {
      console.log('🎤 请求音频权限...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        },
        video: false
      });
      console.log('✅ 音频权限获取成功');
    } catch (error: any) {
      let errorMessage = '获取音频权限失败';
      
      switch (error.name) {
        case 'NotAllowedError':
          errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许访问麦克风';
          break;
        case 'NotFoundError':
          errorMessage = '未找到可用的麦克风设备';
          break;
        case 'NotReadableError':
          errorMessage = '麦克风正被其他应用使用';
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
  private async sendSignalMessage(message: CallMessage): Promise<void> {
    try {
      await appwriteSignalingService.sendSignal(message);
    } catch (error) {
      console.error('❌ 发送信令消息失败:', error);
      throw error;
    }
  }

  // 设置信令回调
  private setupSignalingCallbacks(): void {
    // 已在initializeUser中设置
  }

  // 更新通话状态
  private updateCallStatus(status: CallStatus): void {
    this.callStatus = status;
    console.log(`📱 通话状态更新: ${status}`);
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  // 设置连接超时
  private setConnectionTimeout(): void {
    this.connectionTimeout = setTimeout(() => {
      console.log('⏰ 连接超时');
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
    console.error('❌ 语音通话错误:', error);
    
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
    console.log('🧹 清理语音通话资源');
    
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
  getCallStatus(): CallStatus {
    return this.callStatus;
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
export const defaultImprovedVoiceCallConfig: VoiceCallConfig = {
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
    },
    
    // 备用TURN服务器（可替换为你自己的服务器）
    // { 
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'your-username',
    //   credential: 'your-password'
    // }
  ]
}; 