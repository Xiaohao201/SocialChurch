export interface OnlineStatusCallback {
  (userId: string, isOnline: boolean): void;
}

export class OnlineStatusService {
  private static instance: OnlineStatusService;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private statusCallbacks: OnlineStatusCallback[] = [];
  private currentUserId: string | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒
  private readonly ONLINE_THRESHOLD = 60000; // 1分钟内活跃认为在线
  private readonly STORAGE_PREFIX = 'user_heartbeat_';

  private constructor() {
    this.setupStorageListener();
    this.startPeriodicCleanup();
  }

  static getInstance(): OnlineStatusService {
    if (!OnlineStatusService.instance) {
      OnlineStatusService.instance = new OnlineStatusService();
    }
    return OnlineStatusService.instance;
  }

  // 启动用户的在线状态检测
  startUserSession(userId: string): void {
    this.currentUserId = userId;
    this.updateHeartbeat(userId);
    this.startHeartbeat();
    console.log(`🟢 用户 ${userId} 开始在线状态检测`);
  }

  // 停止用户的在线状态检测
  stopUserSession(): void {
    if (this.currentUserId) {
      this.removeHeartbeat(this.currentUserId);
      console.log(`🔴 用户 ${this.currentUserId} 停止在线状态检测`);
      this.currentUserId = null;
    }
    this.stopHeartbeat();
  }

  // 检查指定用户是否在线
  isUserOnline(userId: string): boolean {
    const heartbeatKey = this.STORAGE_PREFIX + userId;
    const lastHeartbeat = localStorage.getItem(heartbeatKey);
    
    if (!lastHeartbeat) {
      return false;
    }

    const lastHeartbeatTime = parseInt(lastHeartbeat);
    const now = Date.now();
    const isOnline = now - lastHeartbeatTime < this.ONLINE_THRESHOLD;
    
    return isOnline;
  }

  // 获取所有在线用户的ID列表
  getOnlineUsers(): string[] {
    const onlineUsers: string[] = [];
    const keys = Object.keys(localStorage);
    const now = Date.now();

    keys.forEach(key => {
      if (key.startsWith(this.STORAGE_PREFIX)) {
        const userId = key.replace(this.STORAGE_PREFIX, '');
        const timestamp = localStorage.getItem(key);
        
        if (timestamp && now - parseInt(timestamp) < this.ONLINE_THRESHOLD) {
          onlineUsers.push(userId);
        }
      }
    });

    return onlineUsers;
  }

  // 添加状态变化回调
  addStatusCallback(callback: OnlineStatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  // 移除状态变化回调
  removeStatusCallback(callback: OnlineStatusCallback): void {
    const index = this.statusCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusCallbacks.splice(index, 1);
    }
  }

  // 手动触发在线状态检查
  checkOnlineStatus(userIds: string[]): Map<string, boolean> {
    const statusMap = new Map<string, boolean>();
    
    userIds.forEach(userId => {
      const isOnline = this.isUserOnline(userId);
      statusMap.set(userId, isOnline);
    });

    return statusMap;
  }

  // 更新当前用户的心跳
  private updateHeartbeat(userId: string): void {
    const heartbeatKey = this.STORAGE_PREFIX + userId;
    const timestamp = Date.now().toString();
    localStorage.setItem(heartbeatKey, timestamp);
  }

  // 移除用户的心跳记录
  private removeHeartbeat(userId: string): void {
    const heartbeatKey = this.STORAGE_PREFIX + userId;
    localStorage.removeItem(heartbeatKey);
  }

  // 开始心跳检测
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.currentUserId) {
        this.updateHeartbeat(this.currentUserId);
        
        // 检查其他用户的在线状态变化
        this.checkAndNotifyStatusChanges();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  // 停止心跳检测
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 设置存储监听器（用于跨标签页同步）
  private setupStorageListener(): void {
    window.addEventListener('storage', (event) => {
      if (event.key && event.key.startsWith(this.STORAGE_PREFIX)) {
        const userId = event.key.replace(this.STORAGE_PREFIX, '');
        const isOnline = event.newValue ? this.isUserOnline(userId) : false;
        
        // 通知所有回调函数
        this.statusCallbacks.forEach(callback => {
          try {
            callback(userId, isOnline);
          } catch (error) {
            console.error('在线状态回调错误:', error);
          }
        });
      }
    });
  }

  // 检查并通知状态变化
  private checkAndNotifyStatusChanges(): void {
    // 这里可以实现更复杂的状态变化检测逻辑
    // 暂时简化处理
  }

  // 定期清理过期的心跳记录
  private startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredHeartbeats();
    }, 5 * 60 * 1000); // 每5分钟清理一次
  }

  // 清理过期的心跳记录
  private cleanupExpiredHeartbeats(): void {
    const keys = Object.keys(localStorage);
    const now = Date.now();

    keys.forEach(key => {
      if (key.startsWith(this.STORAGE_PREFIX)) {
        const timestamp = localStorage.getItem(key);
        if (timestamp && now - parseInt(timestamp) > this.ONLINE_THRESHOLD * 2) {
          localStorage.removeItem(key);
        }
      }
    });
  }
}

// 导出单例实例
export const onlineStatusService = OnlineStatusService.getInstance(); 