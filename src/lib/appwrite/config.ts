import { Client, Account, Databases, Storage, Functions, Locale, Avatars } from 'appwrite'

export const appwriteConfig = {
  url: import.meta.env.VITE_APPWRITE_URL,
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID,
  storageId: import.meta.env.VITE_APPWRITE_STORAGE_ID,
  userCollectionId: import.meta.env.VITE_APPWRITE_USER_COLLECTION_ID,
  postCollectionId: import.meta.env.VITE_APPWRITE_POST_COLLECTION_ID,
  savesCollectionId: import.meta.env.VITE_APPWRITE_SAVES_COLLECTION_ID,
  friendshipCollectionId: import.meta.env.VITE_APPWRITE_FRIENDSHIP_COLLECTION_ID,
  friendRequestCollectionId: import.meta.env.VITE_APPWRITE_FRIEND_REQUEST_COLLECTION_ID,
  notificationCollectionId: import.meta.env.VITE_APPWRITE_NOTIFICATION_COLLECTION_ID,
  ministryCollectionId: import.meta.env.VITE_APPWRITE_MINISTRY_COLLECTION_ID,
  chatCollectionId: import.meta.env.VITE_APPWRITE_CHAT_COLLECTION_ID || 'chats',
  messageCollectionId: import.meta.env.VITE_APPWRITE_MESSAGE_COLLECTION_ID || 'messages',
  signalCollectionId: import.meta.env.VITE_APPWRITE_SIGNAL_COLLECTION_ID || 'signals',
  callsCollectionId: import.meta.env.VITE_APPWRITE_CALL_HISTORY_COLLECTION_ID,
  generateTwilioTokenFunctionId: import.meta.env.VITE_APPWRITE_TWILIO_FUNCTION_ID,
}

// 在开发环境中打印配置信息
if (import.meta.env.DEV) {
    console.log('🔧 Appwrite Configuration Debug:', {
        url: appwriteConfig.url,
        projectId: appwriteConfig.projectId,
        databaseId: appwriteConfig.databaseId,
        signalCollectionId: appwriteConfig.signalCollectionId,
        // 环境变量原始值
        rawUrl: import.meta.env.VITE_APPWRITE_URL,
        rawProjectId: import.meta.env.VITE_APPWRITE_PROJECT_ID,
    });
    
    // 验证关键配置
    if (!appwriteConfig.url) {
        console.error('❌ VITE_APPWRITE_URL 未设置');
    }
    if (!appwriteConfig.projectId) {
        console.error('❌ VITE_APPWRITE_PROJECT_ID 未设置');
    }
    if (!appwriteConfig.databaseId) {
        console.error('❌ VITE_APPWRITE_DATABASE_ID 未设置');
    }
    if (!appwriteConfig.signalCollectionId) {
        console.error('❌ VITE_APPWRITE_SIGNAL_COLLECTION_ID 未设置');
    }
}

// 创建和配置 Appwrite 客户端
const client = new Client()
  .setEndpoint('https://fra.cloud.appwrite.io/v1')
  .setProject('6846b9f900368f67ddb4')
  .setLocale('en-US');

// 基本配置
client
    .setEndpoint(appwriteConfig.url)
    .setProject(appwriteConfig.projectId);

// 修复XMLHttpRequest blob错误的简单方案
// 这个错误通常是由于Appwrite SDK的响应类型配置问题导致的
// 建议在实际使用中检查网络请求的响应类型配置

// 创建服务实例，并配置响应类型
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);
export const locale = new Locale(client);
export const avatars = new Avatars(client);

// 导出配置的客户端
export { client };
