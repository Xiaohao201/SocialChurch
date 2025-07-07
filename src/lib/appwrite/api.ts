import { Account, ID, Query, Models, Permission, Role } from 'appwrite';
import { INewPost, INewUser, IUpdatePost, IUpdateUser, INotification, IUserWithFriendship, DisappearingMessageDuration, IDisappearingMessageSettings } from "@/types";
import { account, appwriteConfig, avatars, client, databases, storage } from './config';

// =================================================================================================
// TYPE DEFINITIONS
// =================================================================================================

export type ChatDocument = Models.Document & {
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: string;
  isGroup?: boolean;
  name?: string;
  avatar?: string;
  admins?: string[];
  createdBy?: string;
};

export type UserDocument = Models.Document & {
  name: string;
  email: string;
  imageUrl: string;
  ministryId?: string;
  isOnline?: boolean;
  lastSeen?: string;
  accountId: string;
  initialPassword?: string;
  gender?: 'male' | 'female' | 'unknown';
  dateOfFaith?: string;
  faithTestimony?: string;
};

export type UIChat = ChatDocument & {
  otherUser?: UserDocument | null;
  isGroup?: boolean;
  name?: string;
  avatar?: string;
};

// =================================================================================================
// AUTHENTICATION & USER MANAGEMENT
// =================================================================================================

export async function createUserAccount(user: INewUser) {
    try {
      const newAccount = await account.create(
        ID.unique(),
        user.email,
        user.password,
        user.name
      );

    if (!newAccount) throw new Error("Failed to create account");
  
      const avatarUrl = avatars.getInitials(user.name).toString();
  
      const newUser = await saveUserToDB({
        accountId: newAccount.$id,
        name: newAccount.name,
        email: newAccount.email,
        ministryId: user.ministryId,
        imageUrl: avatarUrl,
      initialPassword: user.password
      });
  
      if(!newUser) {
      // Clean up failed registration
      await account.deleteSession('current');
      throw new Error('Failed to save user to database');
      }

      return newAccount;
    } catch (error: any) {
      console.error("createUserAccount error:", error);
      if (error.code === 409) {
      throw new Error("An account with this email already exists.");
      }
      throw error;
    }
}

export async function saveUserToDB(user: {
  accountId: string;
  email: string;
  name: string;
  imageUrl?: string;
  ministryId?: string;
  initialPassword?: string;
}) {
  try {
    const newUser = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      ID.unique(),
      {
        accountId: user.accountId,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl || `https://api.dicebear.com/6.x/initials/svg?seed=${user.name}`,
        ministryId: user.ministryId || null,
        initialPassword: user.initialPassword,
        isOnline: false,
        lastSeen: new Date().toISOString(),
      },
      [
        Permission.read(Role.any()), // Make user profiles public
        Permission.update(Role.user(user.accountId)), // User can update their own profile
        Permission.delete(Role.user(user.accountId)), // User can delete their own profile
      ]
    );

    return newUser as UserDocument;
  } catch (error) {
    console.error('Error saving user to DB:', error);
    throw error;
  }
}

export async function signInAccount(credentials: { email: string; password: string }) {
    try {
    // End any existing session to ensure a clean login
    await account.deleteSession('current').catch(() => {});

        const newSession = await account.createEmailPasswordSession(credentials.email, credentials.password);
        const currentAccount = await account.get();
        
    const userQuery = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            [Query.equal('accountId', currentAccount.$id)]
        );

    if (userQuery.documents.length > 0) {
      await updateUserOnlineStatus(userQuery.documents[0].$id, true);
    } else {
       // This case is for users who were authenticated in Appwrite but not in our DB
                const defaultMinistry = await initializeDefaultMinistry();
       await saveUserToDB({
                    accountId: currentAccount.$id,
                    name: currentAccount.name,
                    email: currentAccount.email,
           ministryId: defaultMinistry?.$id,
           imageUrl: avatars.getInitials(currentAccount.name).toString(),
       });
        }

        return newSession;
    } catch (error: any) {
        if (error.code === 401) {
      throw new Error('Incorrect email or password.');
        }
    console.error("Sign in error:", error);
        throw error;
    }
}

export async function getCurrentUser(): Promise<(UserDocument & { ministry?: any }) | null> {
  try {
    const currentAccount = await account.get();

    const userQuery = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.equal('accountId', currentAccount.$id)]
    );

    if (userQuery.documents.length === 0) return null;

    const currentUser = userQuery.documents[0] as UserDocument;

    if (currentUser.ministryId) {
        const ministry = await databases.getDocument(
          appwriteConfig.databaseId,
          appwriteConfig.ministryCollectionId,
            currentUser.ministryId
        );
        return { ...currentUser, ministry };
    }

    return currentUser;
  } catch (error) {
    console.error("Failed to get current user:", error);
    return null;
  }
}

export async function signOutAccount() {
  try {
      const user = await getCurrentUser();
    if(user) {
        await updateUserOnlineStatus(user.$id, false);
        
        // 保存用户邮箱到localStorage，用于重新登录时恢复聊天缓存
        try {
          localStorage.setItem('last_user_email', user.email);
        } catch (error) {
          // 静默处理错误
        }
    }
    await account.deleteSession("current");
  } catch (error) {
    // 静默处理错误
  }
}

export async function getUserById(userId: string): Promise<UserDocument | null> {
    try {
      const userDoc = await databases.getDocument(
            appwriteConfig.databaseId,
        appwriteConfig.userCollectionId,
        userId
      );
      return userDoc as UserDocument;
    } catch (error) {
      console.error(`Failed to get user by ID ${userId}:`, error);
      return null;
    }
}

export async function getUserWithMinistry(userId: string): Promise<(UserDocument & { ministry?: any }) | null> {
    try {
      const userDoc = await databases.getDocument(
            appwriteConfig.databaseId,
        appwriteConfig.userCollectionId,
        userId
      );
      
      const user = userDoc as UserDocument;
      
      // 如果用户有事工ID，获取事工信息
      if (user.ministryId) {
        try {
          const ministry = await databases.getDocument(
            appwriteConfig.databaseId,
            appwriteConfig.ministryCollectionId,
            user.ministryId
          );
          return { ...user, ministry };
        } catch (ministryError) {
          console.error(`Failed to get ministry for user ${userId}:`, ministryError);
          return user;
        }
      }
      
      return user;
    } catch (error) {
      console.error(`Failed to get user with ministry by ID ${userId}:`, error);
      return null;
    }
}

// 扩展的用户类型，包含关系状态
export interface UserWithRelationship extends UserDocument {
  relationshipStatus: 'friend' | 'request_sent' | 'request_received' | 'none';
  friendRequestId?: string;
}

export async function searchUsers(keyword: string, currentUserId: string): Promise<UserWithRelationship[]> {
  try {
    const users = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [
        Query.search('name', keyword),
        Query.notEqual('$id', currentUserId)
      ]
    );

    // 获取当前用户的好友关系
    const friendships = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.friendshipCollectionId,
      [Query.equal('users', currentUserId)]
    );
    const friendIds = new Set(friendships.documents.map(fs => fs.friendId));

    // 获取当前用户发送的好友请求
    const sentRequests = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.friendRequestCollectionId,
      [
        Query.equal('senderId', currentUserId),
        Query.equal('status', 'pending')
      ]
    );
    const sentRequestsMap = new Map(sentRequests.documents.map(req => [req.receiverId, req.$id]));

    // 获取当前用户收到的好友请求
    const receivedRequests = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.friendRequestCollectionId,
      [
        Query.equal('receiverId', currentUserId),
        Query.equal('status', 'pending')
      ]
    );
    const receivedRequestsMap = new Map(receivedRequests.documents.map(req => [req.senderId, req.$id]));

    // 为每个搜索结果添加关系状态
    const usersWithRelationship: UserWithRelationship[] = users.documents.map(user => {
      let relationshipStatus: 'friend' | 'request_sent' | 'request_received' | 'none' = 'none';
      let friendRequestId: string | undefined;

      if (friendIds.has(user.$id)) {
        relationshipStatus = 'friend';
      } else if (sentRequestsMap.has(user.$id)) {
        relationshipStatus = 'request_sent';
        friendRequestId = sentRequestsMap.get(user.$id);
      } else if (receivedRequestsMap.has(user.$id)) {
        relationshipStatus = 'request_received';
        friendRequestId = receivedRequestsMap.get(user.$id);
      }

      return {
        ...(user as UserDocument),
        relationshipStatus,
        friendRequestId
      };
    });

    return usersWithRelationship;
  } catch (error) {
    console.error("Search users error:", error);
    return [];
  }
}

export async function updateUser(userId: string, user: {
  name?: string;
  email?: string;
  imageUrl?: string;
  ministryId?: string;
  gender?: string;
  dateOfFaith?: Date;
  faithTestimony?: string;
}) {
  try {
    // Build update data, only include fields with values
    const updateData: any = {};
    
    if (user.email !== undefined) updateData.email = user.email;
    if (user.name !== undefined) updateData.name = user.name;
    if (user.imageUrl !== undefined) updateData.imageUrl = user.imageUrl;
    if (user.ministryId !== undefined) updateData.ministryId = user.ministryId;
    if (user.gender !== undefined) updateData.gender = user.gender;
    if (user.dateOfFaith !== undefined) updateData.dateOfFaith = user.dateOfFaith;
    if (user.faithTestimony !== undefined) updateData.faithTestimony = user.faithTestimony;
    
    // Ensure at least one field needs updating
    if (Object.keys(updateData).length === 0) {
      throw new Error('No fields to update');
    }

    const updatedUser = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      userId,
      updateData
    );

    return updatedUser;
  } catch (error) {
    console.error('Update user error:', error);
    throw error;
  }
}

export async function getUserOnlineStatus(userId: string) {
  try {
    const user = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      userId
    );

    return {
      isOnline: user.isOnline || false,
      lastSeen: user.lastSeen || null,
    };
    } catch (error) {
    console.error('Get user online status error:', error);
    return {
      isOnline: false,
      lastSeen: null,
    };
  }
}

export async function updateUserOnlineStatus(userId: string, isOnline: boolean) {
  try {
    // 获取当前用户信息，确保只能更新自己的状态
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.$id !== userId) {
      console.warn('Cannot update online status for other users');
      return;
    }

    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      userId,
      { isOnline, lastSeen: new Date().toISOString() }
    );
    } catch (error) {
    console.error(`Failed to update online status for user ${userId}:`, error);
  }
}

// =================================================================================================
// CHAT
// =================================================================================================

export async function getOrCreateChat(user1Id: string, user2Id: string): Promise<ChatDocument> {
  try {
    const chatQuery = [
      Query.contains('participants', user1Id),
      Query.contains('participants', user2Id),
    ];

    const existingChats = await databases.listDocuments(
            appwriteConfig.databaseId,  
      appwriteConfig.chatCollectionId,
      chatQuery
    );

    const specificChat = existingChats.documents.find(doc => doc.participants.length === 2);

    if (specificChat) {
      return specificChat as ChatDocument;
    }

    const newChat = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      ID.unique(),
      {
        participants: [user1Id, user2Id].sort(),
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
      ]
    );
    return newChat as ChatDocument;
  } catch (error: any) {
    console.error('CRITICAL ERROR in getOrCreateChat:', error);
    throw new Error(`Failed to get or create chat: ${error.message}`);
  }
}

export async function getUserChats(userId: string): Promise<UIChat[]> {
  try {
    const response = await databases.listDocuments(
          appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      [Query.contains('participants', userId)],
    );

    const chatPromises = response.documents.map(async (chatDoc) => {
      const chat = chatDoc as ChatDocument;
      
      // 通过参与者数量判断是否为群组聊天
      const isGroupChat = chat.participants?.length > 2;
      
      if (isGroupChat) {
        // 群组聊天 - 尝试从系统消息中获取群组元数据
        let groupName = `群聊(${chat.participants?.length || 0})`;
        let groupAvatar = null;
        let admins: string[] = [];
        let createdBy = '';
        
        try {
          // 获取群组创建的系统消息
          const systemMessages = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.messageCollectionId,
            [
              Query.equal('chatId', chat.$id),
              Query.equal('messageType', 'system_group_created'),
              Query.limit(1)
            ]
          );
          
          if (systemMessages.documents.length > 0) {
            const systemMessage = systemMessages.documents[0];
            try {
              const metadata = JSON.parse(systemMessage.content);
              groupName = metadata.groupName || groupName;
              groupAvatar = metadata.avatar;
              admins = metadata.admins || [];
              createdBy = metadata.createdBy || '';
            } catch (e) {
              // 解析失败，使用默认值
            }
          }
        } catch (e) {
          // 获取系统消息失败，使用默认值
        }
        
        return {
          ...chat,
          otherUser: null, // 群组聊天没有otherUser
          isGroup: true,
          name: groupName,
          avatar: groupAvatar,
          admins,
          createdBy,
        };
      } else {
        // 一对一聊天
        const otherUserId = chat.participants?.find((id: string) => id !== userId);
        if (!otherUserId) return null;

        const otherUser = await getUserById(otherUserId);
        if (!otherUser) return null;

        return {
          ...chat,
          otherUser,
          isGroup: false,
        };
      }
    });

    const chats = (await Promise.all(chatPromises)).filter(Boolean) as UIChat[];

    chats.sort((a, b) => new Date(b.lastMessageTime!).getTime() - new Date(a.lastMessageTime!).getTime());

    return chats;
    } catch (error) {
    return [];
    }
}

export async function sendMessage(chatId: string, senderId: string, receiverId: string, content: string, type: string = 'text', fileData?: any) {
    try {
        // Validation to prevent corrupted messages
        if (!content || content.trim() === '') {
            throw new Error('Message content cannot be empty');
        }
        if (content === 'text' || content === type) {
            console.error('⚠️ Potential parameter mismatch detected!', { chatId, senderId, receiverId, content, type });
            throw new Error('Invalid message content - possible parameter order issue');
        }

        console.log('📤 Sending message:', { chatId, senderId, receiverId, content: content.substring(0, 50), type });

        // 消息本身不需要设置过期时间戳，清理时会根据创建时间和聊天设置来判断
        const newMessage = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.messageCollectionId,
            ID.unique(),
            {
                chatId,
                sender: senderId,
                content,
                messageType: type,
                fileData: fileData ? JSON.stringify(fileData) : undefined,
                // 移除 expirationTimestamp 字段，改为在清理时动态计算
            },
            [
                Permission.read(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        );

        await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.chatCollectionId,
            chatId,
            {
                lastMessage: type === 'file' ? `Attachment: ${content}` : content,
                lastMessageTime: new Date().toISOString()
            }
        );

        return newMessage;
    } catch (error) {
        console.error("Failed to send message:", error);
        throw error; 
    }
}


export async function getChatMessages(chatId: string, limit: number = 50) {
    try {
        const response = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.messageCollectionId,
            [
                Query.equal('chatId', chatId),
                Query.orderDesc('$createdAt'),
                Query.limit(limit)
            ]
        );
        return response.documents.reverse(); // reverse to show oldest first
    } catch (error) {
        console.error("Failed to get chat messages:", error);
        return [];
    }
}

export async function deleteMessage(messageId: string) {
    try {
        await databases.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.messageCollectionId,
            messageId
        );
        return { status: 'ok' };
    } catch (error) {
        console.error("Failed to delete message:", error);
        throw error;
    }
}

// =================================================================================================
// CHAT DEBUGGING AND REPAIR FUNCTIONS
// =================================================================================================

export async function recreateMissingChats(userId: string) {
  try {
    const CHATS_CACHE_KEY = `chats_cache_${userId}`;
    const cachedData = localStorage.getItem(CHATS_CACHE_KEY);
    if (!cachedData) return { success: true, createdCount: 0 };
    
    const localChats: UIChat[] = JSON.parse(cachedData);
    const dbChats = await getUserChats(userId);
    
    const dbChatIds = new Set(dbChats.map(c => c.$id));
    const missingChats = localChats.filter(lc => !dbChatIds.has(lc.$id) && lc.participants?.length === 2);
    
    if (missingChats.length === 0) return { success: true, createdCount: 0 };
    
    let createdCount = 0;
    for (const chatToRecreate of missingChats) {
      try {
        const otherUser = chatToRecreate.otherUser;
        if (otherUser && otherUser.$id) {
          await getOrCreateChat(userId, otherUser.$id);
          createdCount++;
        }
      } catch (e) {
        console.error(`Failed to recreate chat ${chatToRecreate.$id}`, e);
      }
    }
    
    return { success: true, createdCount };
  } catch(e) {
    return { success: false, error: (e as Error).message };
  }
}

export function getChatStorageInfo() {
  const allKeys = Object.keys(localStorage);
  const chatCacheKeys = allKeys.filter(k => k.startsWith('chats_cache_'));
  const results: Record<string, any> = {};

  chatCacheKeys.forEach(key => {
    try {
      const data = localStorage.getItem(key);
      const parsed = data ? JSON.parse(data) : [];
      results[key] = { count: parsed.length, size: data?.length || 0, chats: parsed };
    } catch (e) {
      results[key] = { error: 'Failed to parse JSON' };
    }
  });

  return { totalCacheEntries: chatCacheKeys.length, cacheDetails: results };
}

export async function debugUserChats(userId: string) {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      [Query.contains('participants', userId)]
    );
    return { userChats: response.documents };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function advancedChatDiagnosis(userId: string): Promise<any> {
  try {
    const dbQuery = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      [Query.contains('participants', userId)]
    );
    const dbDocs = dbQuery.documents as ChatDocument[];

    const processedChats = await Promise.all(
      dbDocs.map(async (chat) => {
        const issues: string[] = [];
        const otherUserId = chat.participants.find((p) => p !== userId);
        if (!otherUserId) {
          issues.push('Chat is missing another participant.');
          return { ...chat, otherUser: null, issues };
        }
        try {
          const otherUser = await getUserById(otherUserId);
          return { ...chat, otherUser, issues };
        } catch (e) {
          issues.push(`Error fetching other participant`);
          return { ...chat, otherUser: null, issues };
        }
      })
    );

    const CHATS_CACHE_KEY = `chats_cache_${userId}`;
    const cachedData = localStorage.getItem(CHATS_CACHE_KEY);
    const localChats: UIChat[] = cachedData ? JSON.parse(cachedData) : [];
    
    const issues: string[] = [];
    if (dbDocs.length !== localChats.length) {
      issues.push(`Mismatch: ${dbDocs.length} chats in DB vs ${localChats.length} in local cache.`);
    }

    return {
      userId,
      databaseQuery: { documentsCount: dbQuery.total },
      processedChats,
      localCache: { count: localChats.length, chats: localChats },
      issues,
    };
    } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function fixChatDataSync(userId: string): Promise<any> {
  try {
    const diagnosis = await advancedChatDiagnosis(userId);
    if (diagnosis.success === false) {
      return { success: false, error: 'Diagnosis failed' };
    }

    const { processedChats: dbChats, localCache } = diagnosis;
    const finalChatsMap = new Map<string, UIChat>();

    for (const chat of dbChats) {
      if (chat.otherUser && chat.issues.length === 0) {
        finalChatsMap.set(chat.$id, chat as unknown as UIChat);
      }
    }

    for (const localChat of localCache.chats) {
      if (!finalChatsMap.has(localChat.$id) && localChat.otherUser?.$id) {
        try {
          const newDbChat = await getOrCreateChat(userId, localChat.otherUser.$id);
          const fullChat: UIChat = { ...newDbChat, otherUser: localChat.otherUser };
          finalChatsMap.set(fullChat.$id, fullChat);
        } catch (e) { console.error(`Failed to recover local chat ${localChat.$id}:`, e); }
      }
    }

    const finalChatList = Array.from(finalChatsMap.values());

    const CHATS_CACHE_KEY = `chats_cache_${userId}`;
    localStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(finalChatList));

    return {
      success: true,
      finalCount: finalChatList.length,
      chats: finalChatList,
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// =================================================================================================
// FRIEND SYSTEM
// =================================================================================================

export async function getFriendRequests(userId: string) {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.friendRequestCollectionId,
      [
        Query.equal('receiverId', userId),
        Query.equal('status', 'pending'),
      ]
    );

    const requestsWithSender = await Promise.all(
      response.documents.map(async (request) => {
        const sender = await getUserById(request.senderId);
        return { ...request, sender };
      })
    );

    return requestsWithSender;
  } catch (error) {
    console.error('Get friend requests error:', error);
    return [];
  }
}

export async function sendFriendRequest(senderId: string, receiverId: string) {
  try {
    // 检查是否已经是好友
    const existingFriendship = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.friendshipCollectionId,
      [
        Query.equal('users', senderId),
        Query.equal('friendId', receiverId)
      ]
    );
    if (existingFriendship.total > 0) throw new Error("Already friends");

    // 检查是否已经存在待处理的好友请求（双向检查）
    const existingRequest1 = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.friendRequestCollectionId,
      [
        Query.equal('senderId', senderId),
        Query.equal('receiverId', receiverId),
        Query.equal('status', 'pending')
      ]
    );

    const existingRequest2 = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.friendRequestCollectionId,
      [
        Query.equal('senderId', receiverId),
        Query.equal('receiverId', senderId),
        Query.equal('status', 'pending')
      ]
    );

    if (existingRequest1.total > 0 || existingRequest2.total > 0) {
      throw new Error("Friend request already sent or received");
    }

    const friendRequest = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.friendRequestCollectionId,
      ID.unique(),
      { senderId, receiverId, status: 'pending' }
    );

    return friendRequest;
  } catch (error) {
    console.error('Send friend request error:', error);
    throw error;
  }
}

export async function handleFriendRequest(requestId: string, senderId: string, receiverId: string, status: 'accepted' | 'rejected') {
  try {
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.friendRequestCollectionId,
      requestId,
      { status }
    );

    if (status === 'accepted') {
      const currentTimestamp = new Date().toISOString();
      
      // Create friendship from sender's perspective
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.friendshipCollectionId,
        ID.unique(),
        { 
          users: senderId, 
          friendId: receiverId,
          status: 'active',
          createAt: currentTimestamp
        }
      );

      // Create friendship from receiver's perspective
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.friendshipCollectionId,
        ID.unique(),
        { 
          users: receiverId, 
          friendId: senderId,
          status: 'active',
          createAt: currentTimestamp
        }
      );
    }
    return { success: true };
  } catch (error) {
    console.error('Handle friend request error:', error);
    throw error;
  }
}

export async function getFriends(userId: string): Promise<UserDocument[]> {
  try {
    const friendships = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.friendshipCollectionId,
      [Query.equal('users', userId)]
    );

    // Extract friend IDs from the friendship documents
    const friendIds = friendships.documents
      .map(fs => fs.friendId)
      .filter(Boolean);

    if (friendIds.length === 0) return [];

    const friends = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.equal('$id', friendIds)]
    );

    return friends.documents as UserDocument[];
  } catch (error) {
    console.error('Get friends error:', error);
    return [];
  }
}

export async function removeFriend(friendshipId: string) {
  try {
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.friendshipCollectionId,
      friendshipId
    );

    return { success: true };
  } catch (error) {
    console.error('Remove friend error:', error);
    throw error;
  }
}

// ============================================================
// MINISTRY & NOTIFICATIONS & OTHER
// ============================================================

export async function getMinistryById(ministryId: string) {
  try {
    const ministry = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ministryCollectionId,
        ministryId
    );
    return ministry;
  } catch (error) {
    console.log(error);
  }
}

export async function initializeDefaultMinistry() {
    try {
        const ministryList = await databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.ministryCollectionId, [Query.limit(1)]);
        if (ministryList.documents.length > 0) {
            return ministryList.documents[0];
    } else {
            return await databases.createDocument(appwriteConfig.databaseId, appwriteConfig.ministryCollectionId, ID.unique(), { name: "Default Ministry" });
        }
  } catch (error) {
        console.error("Failed to initialize default ministry", error);
  return null;
}
}

export async function uploadFile(file: File) {
    try {
        const uploadedFile = await storage.createFile(
            appwriteConfig.storageId,
            ID.unique(),
            file
        );
        return uploadedFile;
  } catch (error) {
        console.log(error);
    throw error;
  }
}

export async function uploadVoiceMessage(audioBlob: Blob, fileName?: string): Promise<string> {
    try {
        // Convert blob to file
        const file = new File([audioBlob], fileName || `voice_${Date.now()}.webm`, {
            type: 'audio/webm',
        });

        const uploadedFile = await storage.createFile(
            appwriteConfig.storageId,
            ID.unique(),
            file
        );

        console.log('✅ Voice message uploaded:', uploadedFile.$id);
        return uploadedFile.$id;
    } catch (error) {
        console.error('Error uploading voice message:', error);
        throw new Error('Failed to upload voice message');
    }
}

export function getFilePreview(fileId: string) {
    try {
        const fileUrl = storage.getFileView(
            appwriteConfig.storageId,
            fileId
        );
        if (!fileUrl) throw Error;
        return fileUrl;
  } catch (error) {
        console.log(error);
    throw error;
  }
}

export async function deleteFile(fileId: string) {
    try {
        await storage.deleteFile(appwriteConfig.storageId, fileId);
        return { status: "ok" };
  } catch (error) {
        console.log(error);
    }
}

export function getUserAvatarUrl(imageUrl: string | null | undefined): string {
    try {
        if (!imageUrl) {
            return '/assets/icons/profile-placeholder.svg';
        }
        
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return imageUrl;
        }
        
        if (imageUrl.startsWith('/')) {
            return imageUrl;
        }
        
        // Handle case where imageUrl is a file ID from Appwrite Storage
        if (imageUrl.length > 10 && !imageUrl.includes('/')) {
            const fileUrl = storage.getFileView(
                appwriteConfig.storageId,
                imageUrl
            );
            return fileUrl.toString();
        }
        
        return imageUrl;
        
    } catch (error) {
        console.error("Failed to get user avatar URL:", error);
        return '/assets/icons/profile-placeholder.svg';
    }
}

// =================================================================================================
// POSTS
// =================================================================================================

export async function createPost(post: {
    userId: string;
    caption: string;
    file: File[];
    location: string;
    tags: string;
}) {
    try {
        // Upload file to storage
        const fileId = ID.unique();
        const uploadedFile = await storage.createFile(
            appwriteConfig.storageId,
            fileId,
            post.file[0]
        );

        if (!uploadedFile) throw Error;

        // Get file url
        const fileUrl = storage.getFileView(
            appwriteConfig.storageId,
            fileId
        );

        // Convert tags string to array
        const tags = post.tags?.replace(/ /g, "").split(",") || [];

        // Create post
        const newPost = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            ID.unique(),
            {
                creator: post.userId,
                caption: post.caption,
                imageUrl: fileUrl,
                imageId: fileId,
                location: post.location,
                tags: tags,
            }
        );

        if (!newPost) {
            await storage.deleteFile(appwriteConfig.storageId, fileId);
            throw Error;
        }

        return newPost;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function deletePost(postId: string, imageId: string) {
    if(!postId || !imageId) throw Error;
    
    try {
        // Delete the post document
        await databases.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId
        );
        
        // Delete the associated image file
        await storage.deleteFile(appwriteConfig.storageId, imageId);
        
        return { status: 'ok' };
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function getRecentPosts() {
    try {
        const posts = await databases.listDocuments(
            appwriteConfig.databaseId,  
            appwriteConfig.postCollectionId,
            [Query.orderDesc('$createdAt'), Query.limit(20)]
        );
        return posts.documents;
    } catch (error) {
        console.error('Error fetching recent posts:', error);
        throw error;
    }
}

export async function likePost(postId: string, likesArray: string[]) {
    try {
        const updatePost = await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId,
            {
                likes: likesArray
            }
        );

        if(!updatePost) throw Error;

        return updatePost;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function savePost(postId: string, userId: string) {
    try {
        const updatedPost = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.savesCollectionId,
            ID.unique(),
            {
                user: userId,
                post: postId,
            }
        );

        if(!updatedPost) throw Error;

        return updatedPost;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function deleteSavedPost(savedRecordId: string) {
    try {
        const statusCode = await databases.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.savesCollectionId,
            savedRecordId,
        );

        if(!statusCode) throw Error;

        return {status: 'ok'};
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function getPostById(postId: string) {
    try {
        const post = await databases.getDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId
        );
        return post;
    } catch (error) {
        console.log("Error in getPostById:", error);
        throw error; 
    }
}

export async function updatePost(post: {
    postId: string;
    caption: string;
    imageUrl: string;
    imageId: string;
    location: string;
    tags: string;
    file: File[];
}) {
    const hasFileToUpdate = post.file.length > 0;
    let uploadedFileData: any = undefined;

    try {
        if (hasFileToUpdate) {
            uploadedFileData = await uploadFile(post.file[0]);
            if (!uploadedFileData) throw Error;
        }

        const tags = post.tags?.replace(/ /g, '').split(',') || [];

        const updatedPost = await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            post.postId,
            {
                caption: post.caption,
                imageUrl: uploadedFileData ? getFilePreview(uploadedFileData.$id) : post.imageUrl,
                imageId: uploadedFileData?.$id || post.imageId,
                location: post.location,
                tags: tags,
            }
        );

        if (!updatedPost) {
            if (uploadedFileData) {
                await deleteFile(uploadedFileData.$id);
            }
            throw Error;
        }

        if (hasFileToUpdate && post.imageId) {
            await deleteFile(post.imageId);
        }

        return updatedPost;
    } catch (error) {
        if (uploadedFileData) {
            await deleteFile(uploadedFileData.$id);
        }
        console.log(error);
        throw error;
    }
}

export async function getInfinitePosts({ pageParam }: { pageParam: string | undefined }) {
    const queries: any[] = [Query.orderDesc('$updatedAt'), Query.limit(10)];

    if (pageParam) {
        queries.push(Query.cursorAfter(pageParam.toString()));
    }

    try {
        const posts = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            queries
        );

        if (!posts) throw new Error("Failed to fetch posts or no posts returned from Appwrite.");

        return posts;
    } catch (error) {
        console.error("Error in getInfinitePosts:", error);
        throw error;
    }
}

export async function searchPosts(searchTerm: string) {
    try {
        const posts = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            [Query.search('caption', searchTerm)]
        );

        if (!posts) throw new Error("Failed to search posts or no posts returned from Appwrite.");

        return posts;
    } catch (error) {
        console.error("Error in searchPosts:", error);
        throw error;
    }
}

// =================================================================================================
// NOTIFICATIONS
// =================================================================================================

export async function getUserNotifications(userId: string) {
  try {
    const notifications = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.notificationCollectionId,
      [
        Query.equal('userId', [userId]),
        Query.orderDesc('$createdAt'),
        Query.limit(50)
      ]
    );
    
    return notifications.documents.map(doc => ({
      $id: doc.$id,
      $createdAt: doc.$createdAt,
      userId: doc.userId,
      type: doc.type,
      title: doc.title,
      message: doc.message,
      isRead: doc.isRead,
      data: doc.data
    }));
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
}

export async function markUserNotificationAsRead(notificationId: string) {
  try {
    const updatedNotification = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.notificationCollectionId,
      notificationId,
      {
        isRead: true
      }
    );
    return updatedNotification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

export async function markAllUserNotificationsAsRead(userId: string) {
  try {
    const notifications = await getUserNotifications(userId);
    const updatePromises = notifications
      .filter(notification => !notification.isRead && notification.$id)
      .map(notification => 
        markUserNotificationAsRead(notification.$id!)
      );
    await Promise.all(updatePromises);
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

export async function getUnreadNotificationsCount(userId: string) {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.notificationCollectionId,
      [
        Query.equal('userId', userId),
        Query.equal('isRead', false),
      ]
    );
    return response.total;
  } catch (error) {
    console.error("获取未读通知数量失败:", error);
    return 0;
  }
}

export async function markNotificationsAsRead(userId: string, type?: 'missed_call') {
  try {
    const queries = [Query.equal('userId', userId), Query.equal('isRead', false)];
    if (type) {
      queries.push(Query.equal('type', type));
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.notificationCollectionId,
      queries
    );

    const updatePromises = response.documents.map(doc => 
      databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.notificationCollectionId,
        doc.$id,
        { isRead: true }
      )
    );

    await Promise.all(updatePromises);
    console.log(`✅ ${response.documents.length} 条通知已标记为已读`);
    
  } catch (error) {
    console.error("标记通知为已读失败:", error);
  }
}

// =================================================================================================
// CALL HISTORY & NOTIFICATIONS
// =================================================================================================

export interface ICallRecord {
  callerId: string;
  receiverId: string;
  callerName: string;
  receiverName: string;
  callerAvatar?: string;
  receiverAvatar?: string;
  status: 'completed' | 'missed' | 'rejected';
  duration?: number;
  initiatedAt: string;
}

export async function createCallRecord(callData: ICallRecord) {
  try {
    const record = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.callsCollectionId,
      ID.unique(),
      callData
    );
    return record;
  } catch (error) {
    console.error("Failed to create call record:", error);
    throw error;
  }
}

export async function createNotification(notificationData: {
  userId: string;
  type: 'missed_call' | 'new_message' | 'friend_request';
  message: string;
  relatedItemId?: string;
}) {
  try {
    const newNotification = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.notificationCollectionId,
      ID.unique(),
      {
        ...notificationData,
        isRead: false,
      }
    );
    console.log("🔔 通知创建成功:", newNotification);
    return newNotification;
  } catch (error) {
    console.error("创建通知失败:", error);
    throw new Error("创建通知时出错");
  }
}

// =================================================================================================
// MESSAGE REPAIR FUNCTIONS
// =================================================================================================

export async function diagnoseCorruptedMessages(chatId: string) {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.messageCollectionId,
      [
        Query.equal('chatId', chatId),
        Query.orderDesc('$createdAt'),
        Query.limit(50)
      ]
    );

    const corruptedMessages = response.documents.filter(msg => 
      msg.content === 'text' || 
      msg.content === '' || 
      !msg.content
    );

    const validMessages = response.documents.filter(msg => 
      msg.content && 
      msg.content !== 'text' && 
      msg.content.trim() !== ''
    );

    console.log('📊 Message Diagnosis Results:');
    console.log(`Total messages: ${response.documents.length}`);
    console.log(`Corrupted messages: ${corruptedMessages.length}`);
    console.log(`Valid messages: ${validMessages.length}`);
    
    console.log('\n🔍 Corrupted Messages:');
    corruptedMessages.forEach(msg => {
      console.log(`- ID: ${msg.$id}, Content: "${msg.content}", Sender: ${msg.sender}, Created: ${msg.$createdAt}`);
    });

    console.log('\n✅ Valid Messages:');
    validMessages.forEach(msg => {
      console.log(`- ID: ${msg.$id}, Content: "${msg.content}", Sender: ${msg.sender}, Created: ${msg.$createdAt}`);
    });

    return {
      total: response.documents.length,
      corrupted: corruptedMessages,
      valid: validMessages,
      corruptedCount: corruptedMessages.length,
      validCount: validMessages.length
    };
  } catch (error) {
    console.error('Failed to diagnose messages:', error);
    throw error;
  }
}

export async function repairCorruptedMessage(messageId: string, newContent: string) {
  try {
    const updatedMessage = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.messageCollectionId,
      messageId,
      { content: newContent }
    );
    
    console.log(`✅ Repaired message ${messageId}: "${newContent}"`);
    return updatedMessage;
  } catch (error) {
    console.error(`Failed to repair message ${messageId}:`, error);
    throw error;
  }
}

export async function batchRepairCorruptedMessages(chatId: string, defaultContent: string = "Fixed message") {
  try {
    const diagnosis = await diagnoseCorruptedMessages(chatId);
    
    if (diagnosis.corruptedCount === 0) {
      console.log('✅ No corrupted messages found!');
      return { success: true, repairedCount: 0 };
    }

    console.log(`🔧 Starting batch repair of ${diagnosis.corruptedCount} corrupted messages...`);
    
    let repairedCount = 0;
    for (const corruptedMsg of diagnosis.corrupted) {
      try {
        // Use a generic message or ask user for specific content
        const content = prompt(`Enter content for message ${corruptedMsg.$id} (sent at ${corruptedMsg.$createdAt}):`) || defaultContent;
        await repairCorruptedMessage(corruptedMsg.$id, content);
        repairedCount++;
      } catch (error) {
        console.error(`Failed to repair message ${corruptedMsg.$id}:`, error);
      }
    }

    console.log(`✅ Batch repair completed: ${repairedCount}/${diagnosis.corruptedCount} messages repaired`);
    
    return {
      success: true,
      repairedCount,
      totalCorrupted: diagnosis.corruptedCount
    };
  } catch (error) {
    console.error('Batch repair failed:', error);
    throw error;
  }
}

export async function autoRepairWithPlaceholders(chatId: string) {
  try {
    const diagnosis = await diagnoseCorruptedMessages(chatId);
    
    if (diagnosis.corruptedCount === 0) {
      console.log('✅ No corrupted messages found!');
      return { success: true, repairedCount: 0 };
    }

    console.log(`🔧 Auto-repairing ${diagnosis.corruptedCount} corrupted messages with placeholders...`);
    
    let repairedCount = 0;
    for (let i = 0; i < diagnosis.corrupted.length; i++) {
      const corruptedMsg = diagnosis.corrupted[i];
      try {
        // Create a meaningful placeholder based on position
        const content = `Message ${i + 1}`;
        await repairCorruptedMessage(corruptedMsg.$id, content);
        repairedCount++;
      } catch (error) {
        console.error(`Failed to repair message ${corruptedMsg.$id}:`, error);
      }
    }

    console.log(`✅ Auto-repair completed: ${repairedCount}/${diagnosis.corruptedCount} messages repaired`);
    
    return {
      success: true,
      repairedCount,
      totalCorrupted: diagnosis.corruptedCount
    };
  } catch (error) {
    console.error('Auto-repair failed:', error);
    throw error;
  }
}

// =================================================================================================
// SIMPLIFIED DATABASE OPERATIONS
// =================================================================================================

export async function getAllChatData(chatId: string) {
  try {
    // Get chat document
    const chat = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      chatId
    );

    // Get all messages for this chat
    const messagesResponse = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.messageCollectionId,
      [
        Query.equal('chatId', chatId),
        Query.orderAsc('$createdAt'),
        Query.limit(1000) // Get up to 1000 messages
      ]
    );

    return {
      chat,
      messages: messagesResponse.documents,
      totalMessages: messagesResponse.total
    };
  } catch (error) {
    console.error('Failed to get complete chat data:', error);
    throw error;
  }
}

export async function updateChatAndLastMessage(chatId: string, lastMessageContent: string) {
  try {
    const updatedChat = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      chatId,
      {
        lastMessage: lastMessageContent,
        lastMessageTime: new Date().toISOString()
      }
    );
    
    console.log(`✅ Updated chat ${chatId} with last message: "${lastMessageContent}"`);
    return updatedChat;
  } catch (error) {
    console.error('Failed to update chat last message:', error);
    throw error;
  }
}

export async function deleteEntireChat(chatId: string) {
  try {
    // First, delete all messages in the chat
    const messagesResponse = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.messageCollectionId,
      [Query.equal('chatId', chatId)]
    );

    // Delete messages in batches
    const deletePromises = messagesResponse.documents.map(msg =>
      databases.deleteDocument(
        appwriteConfig.databaseId,
        appwriteConfig.messageCollectionId,
        msg.$id
      )
    );
    
    await Promise.all(deletePromises);
    console.log(`✅ Deleted ${messagesResponse.documents.length} messages`);

    // Then delete the chat document
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      chatId
    );
    
    console.log(`✅ Deleted chat ${chatId}`);
    
    return {
      success: true,
      deletedMessages: messagesResponse.documents.length
    };
  } catch (error) {
    console.error('Failed to delete entire chat:', error);
    throw error;
  }
}

export async function recreateChatFromScratch(user1Id: string, user2Id: string, initialMessage?: string) {
  try {
    // Create new chat
    const newChat = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      ID.unique(),
      {
        participants: [user1Id, user2Id],
        lastMessage: initialMessage || '',
        lastMessageTime: new Date().toISOString()
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ]
    );

    // Add initial message if provided
    if (initialMessage) {
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.messageCollectionId,
        ID.unique(),
        {
          chatId: newChat.$id,
          sender: user1Id,
          content: initialMessage,
          messageType: 'text'
        },
        [
          Permission.read(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.users()),
        ]
      );
    }

    console.log(`✅ Created new chat ${newChat.$id} between ${user1Id} and ${user2Id}`);
    return newChat;
  } catch (error) {
    console.error('Failed to recreate chat:', error);
    throw error;
  }
}

// =================================================================================================
// EXISTING MESSAGE REPAIR FUNCTIONS
// =================================================================================================

// =================================================================================================
// 消息定时清理功能
// =================================================================================================

/**
 * 计算消息过期时间戳
 * 注意：这里计算的是消息应该被删除的时间点
 * 例如：设置保留7天，则当前时间往前推7天之前的消息都应该被删除
 */
export function calculateExpirationTimestamp(duration: DisappearingMessageDuration): string | null {
  if (duration === 'off') return null;
  
  const now = new Date();
  
  const durationMap = {
    '1day': 24 * 60 * 60 * 1000,      // 保留1天
    '3days': 3 * 24 * 60 * 60 * 1000, // 保留3天
    '7days': 7 * 24 * 60 * 60 * 1000, // 保留7天
    '30days': 30 * 24 * 60 * 60 * 1000, // 保留30天
  };
  
  const milliseconds = durationMap[duration];
  if (!milliseconds) return null;
  
  // 计算保留期限的截止时间：当前时间减去保留期限
  // 例如：现在是2024-01-08，保留7天，则2024-01-01之前的消息应该被删除
  const cutoffTime = new Date(now.getTime() - milliseconds).toISOString();
  
  return cutoffTime;
}

/**
 * 获取聊天的消息定时清理设置
 */
export async function getChatDisappearingSettings(chatId: string): Promise<IDisappearingMessageSettings | null> {
  try {
    const chat = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      chatId
    );
    
    if (chat.disappearingMessages) {
      const settings = typeof chat.disappearingMessages === 'string' 
        ? JSON.parse(chat.disappearingMessages) 
        : chat.disappearingMessages;
      return settings;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get disappearing message settings:', error);
    return null;
  }
}

/**
 * 更新聊天的消息定时清理设置
 */
export async function updateChatDisappearingSettings(
  chatId: string, 
  duration: DisappearingMessageDuration, 
  userId: string
): Promise<IDisappearingMessageSettings> {
  try {
    const settings: IDisappearingMessageSettings = {
      chatId,
      duration,
      enabledBy: userId,
      enabledAt: new Date().toISOString(),
      isEnabled: duration !== 'off'
    };
    
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      chatId,
      {
        disappearingMessages: JSON.stringify(settings)
      }
    );
    
    // 发送系统通知消息
    await sendDisappearingMessageNotification(chatId, userId, duration);
    
    return settings;
  } catch (error) {
    console.error('Failed to update disappearing message settings:', error);
    throw error;
  }
}

/**
 * 发送消息定时清理设置变更的系统通知
 */
export async function sendDisappearingMessageNotification(
  chatId: string, 
  userId: string, 
  duration: DisappearingMessageDuration
): Promise<void> {
  try {
    const user = await getUserById(userId);
    if (!user) return;
    
    let content: string;
    if (duration === 'off') {
      content = `${user.name} 已关闭消息定时清理。点击可开启。`;
    } else {
      const durationText = {
        '1day': '1天',
        '3days': '3天', 
        '7days': '7天',
        '30days': '30天'
      }[duration] || duration;
      
      content = `${user.name} 已开启消息定时清理。此聊天中的新消息将在发送 ${durationText} 后消失。点击可更改。`;
    }
    
    await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.messageCollectionId,
      ID.unique(),
      {
        chatId,
        sender: 'system',
        content,
        messageType: 'system_disappearing_message',
        expirationTimestamp: null, // 系统消息不过期
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ]
    );
  } catch (error) {
    console.error('Failed to send disappearing message notification:', error);
  }
}

/**
 * 清理过期消息（服务器端定时任务会调用）
 * 新逻辑：根据每个聊天的定时清理设置，删除超过保留期限的消息
 */
export async function cleanupExpiredMessages(): Promise<number> {
  try {
    // 1. 获取所有开启了消息定时清理的聊天
    const allChats = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      [
        Query.isNotNull('disappearingMessages'),
        Query.limit(100)
      ]
    );
    
    let totalDeletedCount = 0;
    
    // 2. 遍历每个聊天，根据其设置清理消息
    for (const chat of allChats.documents) {
      try {
        // 解析聊天的定时清理设置
        const settings = typeof chat.disappearingMessages === 'string' 
          ? JSON.parse(chat.disappearingMessages) 
          : chat.disappearingMessages;
        
        if (!settings || !settings.isEnabled || settings.duration === 'off') {
          continue; // 跳过未启用的聊天
        }
        
        // 3. 计算该聊天的保留截止时间
        const cutoffTime = calculateExpirationTimestamp(settings.duration);
        
        if (!cutoffTime) continue;
        
        // 4. 查询该聊天中超过保留期限的消息
        const expiredMessages = await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.messageCollectionId,
          [
            Query.equal('chatId', chat.$id),
            Query.lessThan('$createdAt', cutoffTime),
            Query.notEqual('messageType', 'system_disappearing_message'), // 不删除系统消息
            Query.limit(50) // 批量处理
          ]
        );
        
        // 5. 删除过期消息
        for (const message of expiredMessages.documents) {
          try {
            await databases.deleteDocument(
              appwriteConfig.databaseId,
              appwriteConfig.messageCollectionId,
              message.$id
            );
            totalDeletedCount++;
          } catch (error) {
            // 静默处理单个消息删除失败
          }
        }
        
      } catch (error) {
        // 静默处理单个聊天处理失败
      }
    }
    
    return totalDeletedCount;
  } catch (error) {
    return 0;
  }
}

/**
 * 获取聊天中所有消息的过期状态（调试用）
 */
export async function debugChatExpirationStatus(chatId: string) {
  try {
    // 1. 获取聊天的定时清理设置
    const chatSettings = await getChatDisappearingSettings(chatId);
    
    // 2. 获取聊天中的所有消息
    const messages = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.messageCollectionId,
      [
        Query.equal('chatId', chatId),
        Query.orderDesc('$createdAt'),
        Query.limit(50)
      ]
    );
    
    if (!chatSettings || !chatSettings.isEnabled) {
      return {
        total: messages.documents.length,
        hasSettings: false,
        expired: 0,
        messages: []
      };
    }
    
    // 3. 计算保留截止时间
    const cutoffTime = calculateExpirationTimestamp(chatSettings.duration);
    
    if (!cutoffTime) {
      return {
        total: messages.documents.length,
        hasSettings: true,
        expired: 0,
        messages: []
      };
    }
    
    // 4. 分析消息状态
    const expiredMessages = messages.documents.filter(msg => 
      msg.$createdAt < cutoffTime && msg.messageType !== 'system_disappearing_message'
    );
    const validMessages = messages.documents.filter(msg => 
      msg.$createdAt >= cutoffTime || msg.messageType === 'system_disappearing_message'
    );
    
    return {
      total: messages.documents.length,
      hasSettings: true,
      settings: chatSettings,
      cutoffTime,
      expired: expiredMessages.length,
      valid: validMessages.length,
      expiredMessages,
      validMessages
    };
  } catch (error) {
    throw error;
  }
}

// =================================================================================================
// GROUP CHAT FUNCTIONS
// =================================================================================================

/**
 * 创建群组聊天
 */
export async function createGroupChat(
  name: string,
  participantIds: string[],
  createdBy: string,
  avatar?: string
): Promise<ChatDocument> {
  try {
    if (participantIds.length < 2) {
      throw new Error('Group chat must have at least 2 participants besides the creator');
    }

    // 确保创建者也在参与者列表中
    const allParticipants = Array.from(new Set([createdBy, ...participantIds]));
    
    // 创建群组聊天，只使用数据库schema支持的字段
    const groupChat = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      ID.unique(),
      {
        participants: allParticipants,
        lastMessage: `群聊 "${name}" 已创建`,
        lastMessageTime: new Date().toISOString(),
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ]
    );

    // 发送群组创建的系统消息，包含群组元数据
    await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.messageCollectionId,
      ID.unique(),
      {
        chatId: groupChat.$id,
        sender: 'system',
        content: JSON.stringify({
          type: 'group_created',
          groupName: name || `群聊(${allParticipants.length})`,
          avatar: avatar || null,
          admins: [createdBy],
          createdBy,
          displayText: `群聊 "${name}" 已创建，可以开始聊天了。`
        }),
        messageType: 'system_group_created',
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ]
    );

    // 返回带有群组信息的聊天文档
    return {
      ...groupChat,
      isGroup: true,
      name: name || `群聊(${allParticipants.length})`,
      avatar: avatar || null,
      admins: [createdBy],
      createdBy,
    } as ChatDocument;
  } catch (error) {
    throw error;
  }
}

/**
 * 更新群组信息（仅管理员可操作）
 */
export async function updateGroupInfo(
  groupId: string,
  userId: string,
  updates: { name?: string; avatar?: string }
): Promise<ChatDocument> {
  try {
    // 获取群组详细信息
    const { group } = await getGroupChatDetails(groupId);

    // 检查用户是否为管理员
    if (!group.admins?.includes(userId)) {
      throw new Error('Only admins can update group information');
    }

    // 更新系统消息中的群组元数据
    try {
      const systemMessages = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.messageCollectionId,
        [
          Query.equal('chatId', groupId),
          Query.equal('messageType', 'system_group_created'),
          Query.limit(1)
        ]
      );
      
      if (systemMessages.documents.length > 0) {
        const systemMessage = systemMessages.documents[0];
        try {
          const metadata = JSON.parse(systemMessage.content);
          const updatedMetadata = {
            ...metadata,
            groupName: updates.name || metadata.groupName,
            avatar: updates.avatar !== undefined ? updates.avatar : metadata.avatar,
          };
          
          await databases.updateDocument(
            appwriteConfig.databaseId,
            appwriteConfig.messageCollectionId,
            systemMessage.$id,
            {
              content: JSON.stringify(updatedMetadata)
            }
          );
        } catch (e) {
          // 解析或更新失败
        }
      }
    } catch (e) {
      // 获取或更新系统消息失败
    }

    // 更新聊天的lastMessage以反映更改
    const lastMessage = updates.name 
      ? `群聊名称已更改为 "${updates.name}"`
      : '群聊信息已更新';
      
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      groupId,
      {
        lastMessage,
        lastMessageTime: new Date().toISOString()
      }
    );

    // 返回更新后的群组信息
    return {
      ...group,
      name: updates.name || group.name,
      avatar: updates.avatar !== undefined ? updates.avatar : group.avatar,
    } as ChatDocument;
  } catch (error) {
    throw error;
  }
}

/**
 * 添加成员到群组
 */
export async function addMembersToGroup(
  groupId: string,
  newMemberIds: string[],
  addedBy: string
): Promise<ChatDocument> {
  try {
    const group = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      groupId
    );

    const currentParticipants = group.participants || [];
    const updatedParticipants = Array.from(new Set([...currentParticipants, ...newMemberIds]));

    const updatedGroup = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      groupId,
      {
        participants: updatedParticipants,
        lastMessage: '有新成员加入群聊',
        lastMessageTime: new Date().toISOString()
      }
    );

    // 为每个新成员发送系统消息
    for (const memberId of newMemberIds) {
      if (!currentParticipants.includes(memberId)) {
        const newMember = await getUserById(memberId);
        const adder = await getUserById(addedBy);
        
        if (newMember && adder) {
          await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.messageCollectionId,
            ID.unique(),
            {
              chatId: groupId,
              sender: 'system',
              content: `${adder.name} 邀请 ${newMember.name} 加入了群聊`,
              messageType: 'system_member_added',
            },
            [
              Permission.read(Role.users()),
              Permission.update(Role.users()),
              Permission.delete(Role.users()),
            ]
          );
        }
      }
    }

    // 获取完整的群组信息并返回
    const { group: fullGroup } = await getGroupChatDetails(groupId);
    return fullGroup;
  } catch (error) {
    throw error;
  }
}

/**
 * 从群组中移除成员（仅管理员可操作）
 */
export async function removeMemberFromGroup(
  groupId: string,
  memberToRemove: string,
  removedBy: string
): Promise<ChatDocument> {
  try {
    // 获取群组详细信息
    const { group } = await getGroupChatDetails(groupId);

    // 检查操作者是否为管理员
    if (!group.admins?.includes(removedBy)) {
      throw new Error('Only admins can remove members');
    }

    // 不能移除创建者
    if (memberToRemove === group.createdBy) {
      throw new Error('Cannot remove the group creator');
    }

    const updatedParticipants = group.participants.filter((id: string) => id !== memberToRemove);

    // 更新参与者列表
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      groupId,
      {
        participants: updatedParticipants,
        lastMessage: '有成员离开群聊',
        lastMessageTime: new Date().toISOString()
      }
    );

    // 如果被移除的成员是管理员，需要更新系统消息中的管理员列表
    if (group.admins?.includes(memberToRemove)) {
      const updatedAdmins = group.admins.filter((id: string) => id !== memberToRemove);
      
      try {
        const systemMessages = await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.messageCollectionId,
          [
            Query.equal('chatId', groupId),
            Query.equal('messageType', 'system_group_created'),
            Query.limit(1)
          ]
        );
        
        if (systemMessages.documents.length > 0) {
          const systemMessage = systemMessages.documents[0];
          try {
            const metadata = JSON.parse(systemMessage.content);
            const updatedMetadata = {
              ...metadata,
              admins: updatedAdmins,
            };
            
            await databases.updateDocument(
              appwriteConfig.databaseId,
              appwriteConfig.messageCollectionId,
              systemMessage.$id,
              {
                content: JSON.stringify(updatedMetadata)
              }
            );
          } catch (e) {
            // 解析或更新失败
          }
        }
      } catch (e) {
        // 获取或更新系统消息失败
      }
    }

    // 发送系统消息
    const removedMember = await getUserById(memberToRemove);
    const remover = await getUserById(removedBy);
    
    if (removedMember && remover) {
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.messageCollectionId,
        ID.unique(),
        {
          chatId: groupId,
          sender: 'system',
          content: `${remover.name} 将 ${removedMember.name} 移出了群聊`,
          messageType: 'system_member_removed',
        },
        [
          Permission.read(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.users()),
        ]
      );
    }

    // 获取更新后的群组信息并返回
    const { group: updatedGroup } = await getGroupChatDetails(groupId);
    return updatedGroup;
  } catch (error) {
    throw error;
  }
}

/**
 * 离开群组
 */
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  try {
    // 获取群组详细信息
    const { group } = await getGroupChatDetails(groupId);

    // 如果是创建者离开，需要转让管理员权限
    if (group.createdBy === userId) {
      const otherAdmins = group.admins?.filter((id: string) => id !== userId) || [];
      const otherParticipants = group.participants.filter((id: string) => id !== userId);
      
      if (otherParticipants.length === 0) {
        // 如果没有其他成员，删除群组
        await databases.deleteDocument(
          appwriteConfig.databaseId,
          appwriteConfig.chatCollectionId,
          groupId
        );
        return;
      }
      
      // 如果没有其他管理员，将第一个成员设为管理员
      if (otherAdmins.length === 0 && otherParticipants.length > 0) {
        otherAdmins.push(otherParticipants[0]);
      }

      // 更新参与者列表
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.chatCollectionId,
        groupId,
        {
          participants: otherParticipants,
          lastMessage: '群主离开了群聊',
          lastMessageTime: new Date().toISOString()
        }
      );

      // 更新系统消息中的管理员和创建者信息
      try {
        const systemMessages = await databases.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.messageCollectionId,
          [
            Query.equal('chatId', groupId),
            Query.equal('messageType', 'system_group_created'),
            Query.limit(1)
          ]
        );
        
        if (systemMessages.documents.length > 0) {
          const systemMessage = systemMessages.documents[0];
          try {
            const metadata = JSON.parse(systemMessage.content);
            const updatedMetadata = {
              ...metadata,
              admins: otherAdmins,
              createdBy: otherAdmins[0] || otherParticipants[0]
            };
            
            await databases.updateDocument(
              appwriteConfig.databaseId,
              appwriteConfig.messageCollectionId,
              systemMessage.$id,
              {
                content: JSON.stringify(updatedMetadata)
              }
            );
          } catch (e) {
            // 解析或更新失败
          }
        }
      } catch (e) {
        // 获取或更新系统消息失败
      }
    } else {
      // 普通成员离开
      const updatedParticipants = group.participants.filter((id: string) => id !== userId);

      // 更新参与者列表
      await databases.updateDocument(
        appwriteConfig.databaseId,
        appwriteConfig.chatCollectionId,
        groupId,
        {
          participants: updatedParticipants,
          lastMessage: '有成员离开群聊',
          lastMessageTime: new Date().toISOString()
        }
      );

      // 如果离开的成员是管理员，需要更新系统消息中的管理员列表
      if (group.admins?.includes(userId)) {
        const updatedAdmins = group.admins.filter((id: string) => id !== userId);
        
        try {
          const systemMessages = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.messageCollectionId,
            [
              Query.equal('chatId', groupId),
              Query.equal('messageType', 'system_group_created'),
              Query.limit(1)
            ]
          );
          
          if (systemMessages.documents.length > 0) {
            const systemMessage = systemMessages.documents[0];
            try {
              const metadata = JSON.parse(systemMessage.content);
              const updatedMetadata = {
                ...metadata,
                admins: updatedAdmins,
              };
              
              await databases.updateDocument(
                appwriteConfig.databaseId,
                appwriteConfig.messageCollectionId,
                systemMessage.$id,
                {
                  content: JSON.stringify(updatedMetadata)
                }
              );
            } catch (e) {
              // 解析或更新失败
            }
          }
        } catch (e) {
          // 获取或更新系统消息失败
        }
      }
    }

    // 发送系统消息
    const leavingUser = await getUserById(userId);
    if (leavingUser) {
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.messageCollectionId,
        ID.unique(),
        {
          chatId: groupId,
          sender: 'system',
          content: `${leavingUser.name} 离开了群聊`,
          messageType: 'system_member_left',
        },
        [
          Permission.read(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.users()),
        ]
      );
    }
  } catch (error) {
    throw error;
  }
}

/**
 * 获取群组详细信息包括成员
 */
export async function getGroupChatDetails(groupId: string): Promise<{
  group: ChatDocument;
  members: (UserDocument & { role: 'admin' | 'member' })[];
}> {
  try {
    const group = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      groupId
    ) as ChatDocument;

    // 通过参与者数量判断是否为群组聊天
    const isGroupChat = group.participants?.length > 2;
    if (!isGroupChat) {
      throw new Error('This is not a group chat');
    }

    // 从系统消息中获取群组元数据
    let groupName = `群聊(${group.participants?.length || 0})`;
    let groupAvatar = null;
    let admins: string[] = [];
    let createdBy = '';
    
    try {
      const systemMessages = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.messageCollectionId,
        [
          Query.equal('chatId', groupId),
          Query.equal('messageType', 'system_group_created'),
          Query.limit(1)
        ]
      );
      
      if (systemMessages.documents.length > 0) {
        const systemMessage = systemMessages.documents[0];
        try {
          const metadata = JSON.parse(systemMessage.content);
          groupName = metadata.groupName || groupName;
          groupAvatar = metadata.avatar;
          admins = metadata.admins || [];
          createdBy = metadata.createdBy || '';
        } catch (e) {
          // 解析失败，使用默认值
        }
      }
    } catch (e) {
      // 获取系统消息失败，使用默认值
    }

    // 构建完整的群组信息
    const fullGroup = {
      ...group,
      isGroup: true,
      name: groupName,
      avatar: groupAvatar,
      admins,
      createdBy,
    } as ChatDocument;

    const memberPromises = group.participants.map(async (userId: string) => {
      const user = await getUserById(userId);
      if (user) {
        return {
          ...user,
          role: admins.includes(userId) ? 'admin' as const : 'member' as const
        };
      }
      return null;
    });

    const members = (await Promise.all(memberPromises)).filter(Boolean) as (UserDocument & { role: 'admin' | 'member' })[];

    return { group: fullGroup, members };
  } catch (error) {
    throw error;
  }
}

/**
 * 更新群组消息定时清理设置（仅管理员可操作）
 */
export async function updateGroupDisappearingSettings(
  groupId: string, 
  duration: DisappearingMessageDuration, 
  userId: string
): Promise<IDisappearingMessageSettings> {
  try {
    // 获取群组详细信息
    const { group } = await getGroupChatDetails(groupId);

    // 检查用户是否为管理员
    if (!group.admins?.includes(userId)) {
      throw new Error('Only admins can change disappearing message settings');
    }

    const settings: IDisappearingMessageSettings = {
      chatId: groupId,
      duration,
      enabledBy: userId,
      enabledAt: new Date().toISOString(),
      isEnabled: duration !== 'off'
    };
    
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      groupId,
      {
        disappearingMessages: JSON.stringify(settings),
        lastMessage: '消息定时清理设置已更新',
        lastMessageTime: new Date().toISOString()
      }
    );
    
    // 发送系统通知消息
    await sendGroupDisappearingMessageNotification(groupId, userId, duration);
    
    return settings;
  } catch (error) {
    throw error;
  }
}

/**
 * 发送群组消息定时清理设置变更的系统通知
 */
export async function sendGroupDisappearingMessageNotification(
  groupId: string, 
  userId: string, 
  duration: DisappearingMessageDuration
): Promise<void> {
  try {
    const user = await getUserById(userId);
    if (!user) return;
    
    let content: string;
    if (duration === 'off') {
      content = `管理员 ${user.name} 已关闭消息定时清理。`;
    } else {
      const durationText = {
        '1day': '1天',
        '3days': '3天', 
        '7days': '7天',
        '30days': '30天'
      }[duration] || duration;
      
      content = `管理员 ${user.name} 已将消息保留时间设置为 ${durationText}。`;
    }
    
    await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.messageCollectionId,
      ID.unique(),
      {
        chatId: groupId,
        sender: 'system',
        content,
        messageType: 'system_disappearing_message',
        expirationTimestamp: null, // 系统消息不过期
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ]
    );
  } catch (error) {
    // 静默处理错误
  }
}

