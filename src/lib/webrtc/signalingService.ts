import { CallMessage } from './voiceCall';

export type SignalingCallback = (message: CallMessage) => void;

export class SignalingService {
  private callbacks: Map<string, SignalingCallback[]> = new Map();
  private static instance: SignalingService;

  // 单例模式
  static getInstance(): SignalingService {
    if (!SignalingService.instance) {
      SignalingService.instance = new SignalingService();
    }
    return SignalingService.instance;
  }

  // 注册用户的回调函数
  registerUser(userId: string, callback: SignalingCallback): void {
    if (!this.callbacks.has(userId)) {
      this.callbacks.set(userId, []);
    }
    this.callbacks.get(userId)!.push(callback);
  }

  // 注销用户的回调函数
  unregisterUser(userId: string, callback: SignalingCallback): void {
    const userCallbacks = this.callbacks.get(userId);
    if (userCallbacks) {
      const index = userCallbacks.indexOf(callback);
      if (index > -1) {
        userCallbacks.splice(index, 1);
      }
      if (userCallbacks.length === 0) {
        this.callbacks.delete(userId);
      }
    }
  }

  // 发送信令消息
  sendSignal(message: CallMessage): void {
    console.log('Sending signal:', message);
    
    // 模拟网络延迟
    setTimeout(() => {
      const targetCallbacks = this.callbacks.get(message.to);
      if (targetCallbacks) {
        targetCallbacks.forEach(callback => {
          try {
            callback(message);
          } catch (error) {
            console.error('Error in signaling callback:', error);
          }
        });
      } else {
        console.warn('No callbacks found for user:', message.to);
      }
    }, 100);
  }

  // 获取当前注册的用户列表
  getRegisteredUsers(): string[] {
    return Array.from(this.callbacks.keys());
  }

  // 检查用户是否在线
  isUserOnline(userId: string): boolean {
    return this.callbacks.has(userId) && this.callbacks.get(userId)!.length > 0;
  }
}

// 导出单例实例
export const signalingService = SignalingService.getInstance(); 