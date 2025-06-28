import { CallMessage } from './voiceCall';

export type RealTimeSignalingCallback = (message: CallMessage) => void;

export class RealTimeSignalingService {
  private callbacks: Map<string, RealTimeSignalingCallback[]> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private storageKey = 'voice_call_signals';
  private userStorageKey = 'voice_call_user_';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private static instance: RealTimeSignalingService;

  constructor() {
    this.initBroadcastChannel();
    this.initStorageListener();
    this.startHeartbeat();
  }

  // 单例模式
  static getInstance(): RealTimeSignalingService {
    if (!RealTimeSignalingService.instance) {
      RealTimeSignalingService.instance = new RealTimeSignalingService();
    }
    return RealTimeSignalingService.instance;
  }

  // 初始化 BroadcastChannel（同一浏览器不同标签页通信）
  private initBroadcastChannel(): void {
    try {
      this.broadcastChannel = new BroadcastChannel('voice_call_channel');
      this.broadcastChannel.addEventListener('message', (event) => {
        this.handleReceivedMessage(event.data);
      });
    } catch (error) {
      console.warn('BroadcastChannel not supported, falling back to localStorage');
    }
  }

  // 初始化 localStorage 监听（跨浏览器通信）
  private initStorageListener(): void {
    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey && event.newValue) {
        try {
          const message = JSON.parse(event.newValue);
          this.handleReceivedMessage(message);
        } catch (error) {
          console.error('Failed to parse storage message:', error);
        }
      }
    });
  }

  // 开始心跳检测
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkForNewMessages();
    }, 1000); // 每秒检查一次
  }

  // 检查新消息
  private checkForNewMessages(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const message = JSON.parse(stored);
        const messageTime = message.timestamp || 0;
        const now = Date.now();
        
        // 如果消息是在最近5秒内的，且不是自己发送的
        if (now - messageTime < 5000 && message.processed !== true) {
          this.handleReceivedMessage(message);
          // 标记消息为已处理
          message.processed = true;
          localStorage.setItem(this.storageKey, JSON.stringify(message));
        }
      }
    } catch (error) {
      console.error('Failed to check for new messages:', error);
    }
  }

  // 处理接收到的消息
  private handleReceivedMessage(message: CallMessage): void {
    console.log('🔔 Real-time signal received:', message);
    
    const targetCallbacks = this.callbacks.get(message.to);
    if (targetCallbacks) {
      targetCallbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error in real-time signaling callback:', error);
        }
      });
    }
  }

  // 注册用户的回调函数
  registerUser(userId: string, callback: RealTimeSignalingCallback): void {
    if (!this.callbacks.has(userId)) {
      this.callbacks.set(userId, []);
    }
    this.callbacks.get(userId)!.push(callback);
    
    // 在 localStorage 中标记用户为在线
    localStorage.setItem(this.userStorageKey + userId, Date.now().toString());
    
    console.log(`📱 User ${userId} registered for real-time signaling`);
  }

  // 注销用户的回调函数
  unregisterUser(userId: string, callback: RealTimeSignalingCallback): void {
    const userCallbacks = this.callbacks.get(userId);
    if (userCallbacks) {
      const index = userCallbacks.indexOf(callback);
      if (index > -1) {
        userCallbacks.splice(index, 1);
      }
      if (userCallbacks.length === 0) {
        this.callbacks.delete(userId);
        localStorage.removeItem(this.userStorageKey + userId);
      }
    }
    
    console.log(`📱 User ${userId} unregistered from real-time signaling`);
  }

  // 发送信令消息
  sendSignal(message: CallMessage): void {
    console.log('📤 Sending real-time signal:', message);
    
    const messageWithTimestamp = {
      ...message,
      timestamp: Date.now(),
      processed: false
    };

    // 通过 BroadcastChannel 发送（同一浏览器不同标签页）
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(messageWithTimestamp);
      } catch (error) {
        console.error('Failed to send via BroadcastChannel:', error);
      }
    }

    // 通过 localStorage 发送（跨浏览器）
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(messageWithTimestamp));
      
      // 立即触发 storage 事件检查
      setTimeout(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: this.storageKey,
          newValue: JSON.stringify(messageWithTimestamp),
          oldValue: null,
          storageArea: localStorage
        }));
      }, 100);
    } catch (error) {
      console.error('Failed to send via localStorage:', error);
    }
  }

  // 检查用户是否在线
  isUserOnline(userId: string): boolean {
    const lastSeen = localStorage.getItem(this.userStorageKey + userId);
    if (!lastSeen) return false;
    
    const lastSeenTime = parseInt(lastSeen);
    const now = Date.now();
    
    // 如果用户在最近30秒内活跃，认为在线
    return now - lastSeenTime < 30000;
  }

  // 获取当前注册的用户列表
  getRegisteredUsers(): string[] {
    return Array.from(this.callbacks.keys());
  }

  // 更新用户心跳
  updateUserHeartbeat(userId: string): void {
    localStorage.setItem(this.userStorageKey + userId, Date.now().toString());
  }

  // 清理过期的用户数据
  cleanupExpiredUsers(): void {
    const keys = Object.keys(localStorage);
    const now = Date.now();
    
    keys.forEach(key => {
      if (key.startsWith(this.userStorageKey)) {
        const timestamp = localStorage.getItem(key);
        if (timestamp && now - parseInt(timestamp) > 60000) { // 1分钟过期
          localStorage.removeItem(key);
        }
      }
    });
  }

  // 销毁服务
  destroy(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    this.callbacks.clear();
    this.cleanupExpiredUsers();
  }
}

// 导出单例实例
export const realTimeSignalingService = RealTimeSignalingService.getInstance(); 