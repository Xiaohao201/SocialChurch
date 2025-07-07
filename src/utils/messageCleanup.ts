import { cleanupExpiredMessages } from '@/lib/appwrite/api';

/**
 * 客户端消息清理任务（仅用于演示）
 * 在生产环境中，这应该是服务器端的定时任务
 */
export class MessageCleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  // 5分钟清理一次
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000;

  /**
   * 启动定时清理任务
   */
  start() {
    if (this.intervalId) {
      return;
    }
    
    // 立即执行一次清理
    this.performCleanup();
    
    // 设置定时任务
    this.intervalId = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * 停止定时清理任务
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * 执行消息清理
   */
  private async performCleanup() {
    try {
      await cleanupExpiredMessages();
    } catch (error) {
      // 静默处理错误
    }
  }

  /**
   * 手动触发清理
   */
  async manualCleanup() {
    await this.performCleanup();
  }
}

// 单例实例
export const messageCleanupService = new MessageCleanupService(); 