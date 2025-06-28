import { Client, Databases, ID, Query, Permission, Role } from 'appwrite';
import { appwriteConfig, client } from '@/lib/appwrite/config';
import { BaseSignalMessage, SignalingCallback } from './signalingTypes';

export type AppwriteSignalingCallback = SignalingCallback;

export class AppwriteSignalingService {
  private databases: Databases;
  private callbacks: Map<string, AppwriteSignalingCallback[]> = new Map();
  private subscriptions: Map<string, () => void> = new Map();
  private processedMessages: Set<string> = new Set(); // 追踪已处理的消息
  private static instance: AppwriteSignalingService;

  constructor() {
    this.databases = new Databases(client);
    
    // 定期清理已处理消息缓存（防止内存泄漏）
    setInterval(() => {
      this.cleanupProcessedMessages();
    }, 300000); // 5分钟清理一次
  }

  // 单例模式
  static getInstance(): AppwriteSignalingService {
    if (!AppwriteSignalingService.instance) {
      AppwriteSignalingService.instance = new AppwriteSignalingService();
    }
    return AppwriteSignalingService.instance;
  }

  // 清理已处理消息缓存
  private cleanupProcessedMessages(): void {
    if (this.processedMessages.size > 1000) {
      this.processedMessages.clear();
      console.log('🧹 清理信令消息缓存');
    }
  }

  // 注册用户并监听信令消息
  async registerUser(userId: string, callback: AppwriteSignalingCallback): Promise<void> {
    console.log(`📱 注册用户 ${userId} 到Appwrite实时信令服务`);
    
    if (!this.callbacks.has(userId)) {
      this.callbacks.set(userId, []);
    }
    this.callbacks.get(userId)!.push(callback);

    // 监听发给此用户的信令消息
    try {
      const unsubscribe = client.subscribe(
        `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.signalCollectionId}.documents`,
        (response) => {
          console.log('🔔 收到Appwrite实时事件:', response);
          
          if (response.events.includes('databases.*.collections.*.documents.*.create')) {
            const message = response.payload as any;
            
            // 检查消息是否已经处理过
            const messageId = message.$id;
            if (this.processedMessages.has(messageId)) {
              console.log('⏭️ 跳过重复消息:', messageId);
              return;
            }
            
            // 标记消息为已处理
            this.processedMessages.add(messageId);
            
            if (message.to === userId) {
              console.log(`📨 用户 ${userId} 收到信令消息:`, message);
              this.handleReceivedMessage({
                type: message.type,
                payload: JSON.parse(message.payload || '{}'),
                from: message.from,
                to: message.to,
                timestamp: Date.now() // 添加本地时间戳
              });
            }
          }
        }
      );

      this.subscriptions.set(userId, unsubscribe);
      console.log(`✅ 用户 ${userId} 成功注册实时信令监听`);
    } catch (error) {
      console.error('❌ 注册实时信令监听失败:', error);
      throw error;
    }
  }

  // 注销用户
  unregisterUser(userId: string, callback: AppwriteSignalingCallback): void {
    const userCallbacks = this.callbacks.get(userId);
    if (userCallbacks) {
      const index = userCallbacks.indexOf(callback);
      if (index > -1) {
        userCallbacks.splice(index, 1);
      }
      if (userCallbacks.length === 0) {
        this.callbacks.delete(userId);
        
        // 取消订阅
        const unsubscribe = this.subscriptions.get(userId);
        if (unsubscribe) {
          unsubscribe();
          this.subscriptions.delete(userId);
        }
      }
    }
    console.log(`📱 用户 ${userId} 注销实时信令服务`);
  }

  // 发送信令消息
  async sendSignal(message: BaseSignalMessage): Promise<void> {
    console.log('📤 发送Appwrite信令消息:', message);
    
    try {
      // 暂时不使用timestamp字段，直到Appwrite字段问题解决
      const documentData = {
        type: message.type,
        payload: JSON.stringify(message.payload || {}),
        from: message.from,
        to: message.to,
        createdAt: new Date().toISOString()
      };
      
      console.log('📦 发送的文档数据 (无timestamp):', documentData);
    
      await this.databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.signalCollectionId,
        ID.unique(),
        documentData,
        [
          Permission.read(Role.users()),
          Permission.delete(Role.users())
        ]
      );
      
      console.log('✅ 信令消息发送成功');
    } catch (error) {
      console.error('❌ 发送信令消息失败:', error);
      throw error;
    }
  }

  // 处理接收到的消息
  private handleReceivedMessage(message: BaseSignalMessage): void {
    const targetCallbacks = this.callbacks.get(message.to);
    if (targetCallbacks) {
      targetCallbacks.forEach(callback => {
        try {
          callback(message);
        } catch (error) {
          console.error('❌ 信令回调执行失败:', error);
        }
      });
    }
  }

  // 清理过期的信令消息（可选，保持数据库整洁）
  async cleanupOldSignals(): Promise<void> {
    try {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const oldSignals = await this.databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.signalCollectionId,
        [Query.lessThan('timestamp', oneHourAgo)]
      );

      for (const signal of oldSignals.documents) {
        await this.databases.deleteDocument(
          appwriteConfig.databaseId,
          appwriteConfig.signalCollectionId,
          signal.$id
        );
      }
    } catch (error) {
      console.error('清理过期信令失败:', error);
    }
  }

  // 检查用户是否在线（基于最近的心跳）
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      const recentActivity = await this.databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.signalCollectionId,
        [
          Query.equal('from', userId),
          Query.greaterThan('timestamp', fiveMinutesAgo)
        ]
      );
      
      return recentActivity.total > 0;
    } catch (error) {
      console.error('检查用户在线状态失败:', error);
      return false;
    }
  }
}

// 导出单例实例
export const appwriteSignalingService = AppwriteSignalingService.getInstance(); 