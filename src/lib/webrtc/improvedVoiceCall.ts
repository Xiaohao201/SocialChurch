import { appwriteSignalingService } from './appwriteSignaling';
import { CallMessage } from './signalingTypes';
import { createCallRecord, ICallRecord, getUserById, createNotification } from '@/lib/appwrite/api';

export type { CallMessage } from './signalingTypes';

export type NetworkQuality = 'good' | 'average' | 'poor' | 'unknown';

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
  private callStartTime: number | null = null;
  private networkStatsTimer?: NodeJS.Timeout;
  
  // 当前用户信息
  private currentUserInfo: { id: string; name?: string; avatar?: string } = { id: '' };
  // 目标用户信息
  private targetUserInfo: { id: string; name?: string; avatar?: string } = { id: '' };

  // 回调函数
  private onStatusChange?: (status: CallStatus) => void;
  private onRemoteStream?: (stream: MediaStream) => void;
  private onError?: (error: Error) => void;
  private onIncomingCall?: (fromUserId: string, callerInfo: { userId: string; offer: RTCSessionDescriptionInit; callerName?: string; callerAvatar?: string }) => void;
  private onNetworkQualityChange?: (quality: NetworkQuality) => void;

  // 状态追踪
  private iceCandidatesQueue: RTCIceCandidateInit[] = [];
  private isInitiator = false;
  private connectionTimeout?: NodeJS.Timeout;

  constructor(config: VoiceCallConfig) {
    this.config = config;
    this.setupSignalingCallbacks();
  }

  // 初始化用户
  async initializeUser(userId: string, userInfo: { name?: string; avatar?: string }): Promise<void> {
    this.currentUserId = userId;
    this.currentUserInfo = { id: userId, ...userInfo };
    await appwriteSignalingService.registerUser(userId, this.handleSignalMessage.bind(this));
    this.setupSignalingCallbacks();
    console.log('📝 当前用户信息已设置:', this.currentUserInfo);
  }

  // 设置回调函数
  setCallbacks(callbacks: {
    onStatusChange?: (status: CallStatus) => void;
    onRemoteStream?: (stream: MediaStream) => void;
    onError?: (error: Error) => void;
    onIncomingCall?: (fromUserId: string, callerInfo: { userId: string; offer: RTCSessionDescriptionInit; callerName?: string; callerAvatar?: string }) => void;
    onNetworkQualityChange?: (quality: NetworkQuality) => void;
  }): void {
    this.onStatusChange = callbacks.onStatusChange;
    this.onRemoteStream = callbacks.onRemoteStream;
    this.onError = callbacks.onError;
    this.onIncomingCall = callbacks.onIncomingCall;
    this.onNetworkQualityChange = callbacks.onNetworkQualityChange;
  }

  // 设置当前用户信息 (此方法可被 initializeUser 替代)
  setCurrentUserInfo(userInfo: { name?: string; avatar?: string }): void {
    this.currentUserInfo = { ...this.currentUserInfo, ...userInfo };
    console.log('📝 设置当前用户信息:', this.currentUserInfo);
  }

  // 发起语音通话
  async initiateCall(targetUser: { id: string; name?: string; avatar?: string }): Promise<void> {
    try {
      this.targetUserId = targetUser.id;
      this.targetUserInfo = targetUser; // 保存目标用户信息
      this.isInitiator = true;
      this.updateCallStatus('calling');

      console.log(`📞 向用户 ${targetUser.id} 发起语音通话`);
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
        to: this.targetUserId,
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
  async answerCall(callerInfo: { userId: string; offer: RTCSessionDescriptionInit; callerName?: string; callerAvatar?: string }): Promise<void> {
    try {
      this.targetUserId = callerInfo.userId;
      // 接听时，我们可能没有完整的用户信息，先根据信令中的信息设置
      this.targetUserInfo = { 
        id: callerInfo.userId, 
        name: callerInfo.callerName, 
        avatar: callerInfo.callerAvatar 
      };
      this.isInitiator = false;
      this.updateCallStatus('ringing');

      console.log(`📞 接听来自用户 ${this.targetUserId} 的语音通话`);

      // 获取用户媒体
      await this.getUserMedia();
      
      // 创建PeerConnection
      await this.createPeerConnection();

      // 添加本地流到PeerConnection
      this.addLocalStreamToPeerConnection();
      
      // 设置远程描述(offer)
      await this.peerConnection!.setRemoteDescription(new RTCSessionDescription(callerInfo.offer));
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
        to: this.targetUserId
      });

    } catch (error) {
      console.error('❌ 接听通话失败:', error);
      this.handleError(error as Error);
    }
  }

  // 拒绝来电
  async rejectCall(fromUserId: string): Promise<void> {
    // 拒绝时，我们不知道对方的完整信息，但我们需要记录
    const caller = await getUserById(fromUserId);
    this.targetUserInfo = {
      id: fromUserId,
      name: caller?.name,
      avatar: caller?.imageUrl
    };

    await this.sendSignalMessage({
      type: 'call-reject',
      from: this.currentUserId,
      to: fromUserId
    });
    this.updateCallStatus('rejected');
    this.cleanup(); // 拒绝后也应清理并记录
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
    if (!this.peerConnection || !this.localStream) {
      console.warn("无法切换静音，通话未连接或本地流不存在。");
      return false;
    }

    const senders = this.peerConnection.getSenders();
    const audioSender = senders.find(sender => sender.track?.kind === 'audio');

    if (audioSender && audioSender.track) {
      const currentMuteState = !audioSender.track.enabled;
      audioSender.track.enabled = !audioSender.track.enabled;
      console.log(`🎤 麦克风已 ${audioSender.track.enabled ? '取消静音' : '静音'}`);
      return audioSender.track.enabled === false; // 返回是否已静音
    }
    
    console.warn("未找到音频轨道，无法切换静音。");
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
    // 只有在状态真实改变时才触发
    if (this.callStatus === status) return;
    
    this.callStatus = status;
    console.log(`📱 通话状态更新: ${status}`);
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }

    // 在通话连接时记录开始时间并启动网络监测
    if (status === 'connected') {
      this.callStartTime = Date.now();
      this.startNetworkQualityCheck();
    } else {
      // 在通话结束时停止网络监测
      this.stopNetworkQualityCheck();
    }
  }

  // 设置连接超时
  private setConnectionTimeout(): void {
    this.connectionTimeout = setTimeout(() => {
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

  // 开始网络质量检测
  private startNetworkQualityCheck(): void {
    if (this.networkStatsTimer) {
      clearInterval(this.networkStatsTimer);
    }
    this.networkStatsTimer = setInterval(async () => {
      if (!this.peerConnection || this.peerConnection.connectionState !== 'connected') {
        this.stopNetworkQualityCheck();
        return;
      }

      try {
        const stats = await this.peerConnection.getStats();
        let rtt = -1;
        let packetsLost = -1;

        stats.forEach(report => {
          if (report.type === 'remote-inbound-rtp' && report.roundTripTime !== undefined) {
             rtt = report.roundTripTime * 1000; // convert to ms
          }
          if (report.type === 'remote-inbound-rtp' && report.packetsLost !== undefined) {
            packetsLost = report.packetsLost;
          }
        });
        
        let quality: NetworkQuality = 'unknown';
        if (rtt !== -1) {
          if (rtt < 150 && packetsLost < 5) {
            quality = 'good';
          } else if (rtt < 300 && packetsLost < 10) {
            quality = 'average';
          } else {
            quality = 'poor';
          }
        }
        
        if (this.onNetworkQualityChange) {
          this.onNetworkQualityChange(quality);
        }

      } catch (error) {
        console.warn("获取网络状态失败:", error);
      }
    }, 5000); // 每5秒检测一次
  }

  // 停止网络质量检测
  private stopNetworkQualityCheck(): void {
    if (this.networkStatsTimer) {
      clearInterval(this.networkStatsTimer);
      this.networkStatsTimer = undefined;
    }
    // 通知UI停止显示
    if(this.onNetworkQualityChange) {
      this.onNetworkQualityChange('unknown');
    }
  }

  // 错误处理
  private handleError(error: Error): void {
    console.error(`❌ 语音通话错误:`, error);
    if (this.onError) {
      this.onError(error);
    }
    this.updateCallStatus('failed');
    this.cleanup();
  }

  // 清理资源
  private cleanup(): void {
    console.log('🧹 清理语音通话资源');

    // 在清理时创建通话记录
    this.createCallHistoryEntry();

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
    this.isInitiator = false;
    this.callStartTime = null;
    this.stopNetworkQualityCheck(); // 确保清理时停止检测
    // 不重置 currentUserId 和 currentUserInfo
    this.targetUserId = '';
    this.targetUserInfo = { id: '' };
  }

  private async createCallHistoryEntry(): Promise<void> {
    // 只有在通话状态为 'ended', 'rejected', 'failed' 时才创建记录
    // 'failed' 状态可以理解为 'missed'
    const finalStatus = this.callStatus;
    if (!['ended', 'rejected', 'failed'].includes(finalStatus) || !this.targetUserId) {
      return;
    }

    // 'failed' 并且是发起方，说明对方未接听，状态为 'missed'
    const recordStatus = (finalStatus === 'failed' && this.isInitiator) ? 'missed' : 
                         (finalStatus === 'ended') ? 'completed' : 'rejected';

    let duration = 0;
    if (this.callStartTime && finalStatus === 'ended') {
      duration = Math.round((Date.now() - this.callStartTime) / 1000);
    }

    const callData: ICallRecord = {
      callerId: this.isInitiator ? this.currentUserInfo.id : this.targetUserInfo.id,
      receiverId: this.isInitiator ? this.targetUserInfo.id : this.currentUserInfo.id,
      callerName: this.isInitiator ? this.currentUserInfo.name || '未知用户' : this.targetUserInfo.name || '未知用户',
      receiverName: this.isInitiator ? this.targetUserInfo.name || '未知用户' : this.currentUserInfo.name || '未知用户',
      callerAvatar: this.isInitiator ? this.currentUserInfo.avatar : this.targetUserInfo.avatar,
      receiverAvatar: this.isInitiator ? this.targetUserInfo.avatar : this.currentUserInfo.avatar,
      status: recordStatus,
      duration: duration,
      initiatedAt: new Date().toISOString(),
    };
    
    console.log('✍️ 准备创建通话记录:', callData);
    const newCallRecord = await createCallRecord(callData);

    // 如果是未接或被拒绝的电话，为被叫方创建通知
    if ((recordStatus === 'missed' || recordStatus === 'rejected') && newCallRecord) {
      const receiverId = this.isInitiator ? this.targetUserInfo.id : this.currentUserInfo.id;
      const callerName = this.isInitiator ? this.currentUserInfo.name : this.targetUserInfo.name;

      await createNotification({
        userId: receiverId,
        type: 'missed_call',
        message: `您错过了来自 ${callerName || '未知用户'} 的一通电话`,
        relatedItemId: newCallRecord.$id,
      });
    }
  }

  // 销毁服务
  destroy(): void {
    console.log('💥 销毁语音通话服务实例');
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