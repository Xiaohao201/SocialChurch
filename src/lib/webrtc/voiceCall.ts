export interface VoiceCallConfig {
  iceServers: RTCIceServer[];
}

export interface CallUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface CallMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-start' | 'call-end' | 'call-reject';
  payload?: any;
  from: string;
  to: string;
}

export class VoiceCallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private config: VoiceCallConfig;
  private messageCallback: ((message: CallMessage) => void) | null = null;
  private callStatusCallback: ((status: 'calling' | 'connected' | 'ended' | 'rejected') => void) | null = null;
  private remoteAudioCallback: ((stream: MediaStream) => void) | null = null;

  constructor(config: VoiceCallConfig) {
    this.config = config;
  }

  // 设置消息回调，用于发送信令消息
  setMessageCallback(callback: (message: CallMessage) => void) {
    this.messageCallback = callback;
  }

  // 设置通话状态回调
  setCallStatusCallback(callback: (status: 'calling' | 'connected' | 'ended' | 'rejected') => void) {
    this.callStatusCallback = callback;
  }

  // 设置远程音频流回调
  setRemoteAudioCallback(callback: (stream: MediaStream) => void) {
    this.remoteAudioCallback = callback;
  }

  // 初始化 PeerConnection
  private async initPeerConnection(): Promise<RTCPeerConnection> {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers
    });

    // 处理 ICE 候选
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.messageCallback) {
        console.log('🧊 生成新的 ICE 候选:', event.candidate);
        this.messageCallback({
          type: 'ice-candidate',
          payload: event.candidate,
          from: '',
          to: ''
        });
      } else if (!event.candidate) {
        console.log('🧊 ICE 候选收集完成');
      }
    };

    // 处理远程流
    this.peerConnection.ontrack = (event) => {
      console.log('🎵 接收到远程轨道:', event.track.kind);
      this.remoteStream = event.streams[0];
      console.log('🎵 远程流包含', this.remoteStream.getAudioTracks().length, '个音频轨道');
      if (this.remoteAudioCallback) {
        this.remoteAudioCallback(this.remoteStream);
      }
    };

    // 处理连接状态变化
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection.connectionState;
        console.log('🔗 PeerConnection 状态变化:', state);
        if (state === 'connected' && this.callStatusCallback) {
          console.log('✅ P2P 连接建立成功！');
          this.callStatusCallback('connected');
        } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
          console.log('❌ P2P 连接断开:', state);
          if (this.callStatusCallback) {
            this.callStatusCallback('ended');
          }
          this.cleanup();
        }
      }
    };

    return this.peerConnection;
  }

  // 获取用户媒体（音频）
  private async getUserMedia(): Promise<MediaStream> {
    try {
      // 首先检查是否支持getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('您的浏览器不支持音频功能');
      }

      console.log('🎤 请求音频权限...');
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        },
        video: false
      });
      
      console.log('✅ 音频权限获取成功');
      return this.localStream;
    } catch (error: any) {
      console.error('❌ 获取用户媒体失败:', error);
      
      let errorMessage = '无法访问麦克风';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许访问麦克风';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '未找到可用的麦克风设备';
      } else if (error.name === 'NotReadableError') {
        errorMessage = '麦克风正被其他应用使用';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = '麦克风不支持所需的音频格式';
      } else if (error.name === 'AbortError') {
        errorMessage = '音频访问被中断';
      } else if (error.name === 'SecurityError') {
        errorMessage = '由于安全限制无法访问麦克风';
      }
      
      throw new Error(errorMessage);
    }
  }

  // 发起通话
  async startCall(targetUserId: string, currentUserId: string): Promise<void> {
    try {
      console.log('📞 开始发起通话，目标用户:', targetUserId);
      
      const stream = await this.getUserMedia();
      console.log('🎤 获取本地音频流成功:', stream.getAudioTracks().length, '个音频轨道');
      
      const pc = await this.initPeerConnection();
      console.log('🔗 PeerConnection 初始化成功');

      // 添加本地流到 PeerConnection
      stream.getTracks().forEach(track => {
        if (this.peerConnection) {
          console.log('➕ 添加音频轨道到 PeerConnection:', track.kind);
          this.peerConnection.addTrack(track, stream);
        }
      });

      // 创建 offer
      console.log('📝 创建 offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('✅ Offer 创建并设置成功');

      // 发送 offer 给对方
      if (this.messageCallback) {
        console.log('📤 发送 offer 给对方');
        this.messageCallback({
          type: 'offer',
          payload: offer,
          from: currentUserId,
          to: targetUserId
        });
      }

      if (this.callStatusCallback) {
        this.callStatusCallback('calling');
      }
    } catch (error) {
      console.error('❌ 发起通话失败:', error);
      throw error;
    }
  }

  // 接听通话
  async answerCall(offer: RTCSessionDescriptionInit, targetUserId: string, currentUserId: string): Promise<void> {
    try {
      console.log('📞 开始接听通话，来自用户:', targetUserId);
      console.log('📞 接收到的 offer:', offer);
      
      const stream = await this.getUserMedia();
      console.log('🎤 获取本地音频流成功:', stream.getAudioTracks().length, '个音频轨道');
      
      const pc = await this.initPeerConnection();
      console.log('🔗 PeerConnection 初始化成功');

      // 添加本地流到 PeerConnection
      stream.getTracks().forEach(track => {
        if (this.peerConnection) {
          console.log('➕ 添加音频轨道到 PeerConnection:', track.kind);
          this.peerConnection.addTrack(track, stream);
        }
      });

      // 设置远程描述
      console.log('🔄 设置远程 offer 描述...');
      await pc.setRemoteDescription(offer);
      console.log('✅ 远程 offer 设置成功');

      // 创建 answer
      console.log('📝 创建 answer...');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('✅ Answer 创建并设置成功');

      // 发送 answer 给对方
      if (this.messageCallback) {
        console.log('📤 发送 answer 给对方');
        this.messageCallback({
          type: 'answer',
          payload: answer,
          from: currentUserId,
          to: targetUserId
        });
      }

      if (this.callStatusCallback) {
        this.callStatusCallback('connected');
      }
    } catch (error) {
      console.error('❌ 接听通话失败:', error);
      throw error;
    }
  }

  // 处理 answer
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
      console.log('🔄 设置远程 answer 描述');
      await this.peerConnection.setRemoteDescription(answer);
      console.log('✅ Answer 设置成功');
    } else {
      console.error('❌ 无法设置 answer：PeerConnection 不可用或已关闭');
    }
  }

  // 处理 ICE 候选
  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
      try {
        console.log('🧊 添加 ICE 候选:', candidate);
        await this.peerConnection.addIceCandidate(candidate);
        console.log('✅ ICE 候选添加成功');
      } catch (error) {
        console.error('❌ 添加 ICE 候选失败:', error);
      }
    } else {
      console.error('❌ 无法添加 ICE 候选：PeerConnection 不可用或已关闭');
    }
  }

  // 拒绝通话
  rejectCall(targetUserId: string, currentUserId: string): void {
    if (this.messageCallback) {
      this.messageCallback({
        type: 'call-reject',
        from: currentUserId,
        to: targetUserId
      });
    }
    this.cleanup();
  }

  // 结束通话
  endCall(targetUserId: string, currentUserId: string): void {
    if (this.messageCallback) {
      this.messageCallback({
        type: 'call-end',
        from: currentUserId,
        to: targetUserId
      });
    }
    this.cleanup();
  }

  // 切换麦克风
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

  // 获取音频级别（可用于显示音量指示器）
  getAudioLevel(): number {
    // 这里可以实现音频级别检测
    // 返回 0-100 的音量级别
    return 0;
  }

  // 清理资源
  private cleanup(): void {
    // 停止本地流
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // 关闭 PeerConnection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
  }

  // 销毁服务
  destroy(): void {
    this.cleanup();
    this.messageCallback = null;
    this.callStatusCallback = null;
    this.remoteAudioCallback = null;
  }
}

// 默认配置
export const defaultVoiceCallConfig: VoiceCallConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}; 