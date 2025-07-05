import { Account, ID, Query, Models, Permission, Role } from 'appwrite'

import { INewPost, INewUser, IUpdatePost, IUpdateUser, INotification, IUserWithFriendship } from "@/types";
import { account, appwriteConfig, avatars, client, databases, storage } from './config';

// =================================================================================================
// TYPE DEFINITIONS
// =================================================================================================

// Define an explicit type for a chat document
export type ChatDocument = Models.Document & {
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: string;
};

// Define an explicit type for a user document
export type UserDocument = Models.Document & {
  name: string;
  email: string;
  imageUrl: string;
};

// Define the shape of a chat object used in the UI
export type UIChat = ChatDocument & {
  otherUser: UserDocument;
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

      if (!newAccount) throw Error;
  
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
        await account.deleteSession('current');
        throw Error('Failed to save user to database');
      }

      return newAccount;
    } catch (error: any) {
      console.error("createUserAccount error:", error);
      if (error.code === 409) {
        throw new Error("邮箱已注册，请直接登录");
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
        ministryId: user.ministryId || '',
        initialPassword: user.initialPassword || 'DefaultPassword123',
        isOnline: false,
        lastSeen: new Date().toISOString(),
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users())
      ]
    );

    return newUser;
  } catch (error) {
    console.error('Error saving user to DB:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    throw error;
  }
}

async function checkSession() {
    try {
        const session = await account.get();
        return session;
    } catch (error) {
        return null;
    }
}

export async function signInAccount(credentials: { email: string; password: string }) {
    try {
        const session = await checkSession();
        if (session) {
            await logoutCurrentSession();
        }

        const newSession = await account.createEmailPasswordSession(credentials.email, credentials.password);
        const currentAccount = await account.get();
        
        const userInDB = await databases.listDocuments(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            [Query.equal('accountId', currentAccount.$id)]
        );

        if (userInDB.documents.length === 0) {
            const defaultMinistry = await initializeDefaultMinistry();
            const avatarUrl = avatars.getInitials(currentAccount.name).toString();
            await saveUserToDB({
                accountId: currentAccount.$id,
                name: currentAccount.name,
                email: currentAccount.email,
                ministryId: defaultMinistry.$id,
                imageUrl: avatarUrl,
                initialPassword: 'DefaultPassword123'
            });
        } else {
            await updateUserOnlineStatus(userInDB.documents[0].$id, true);
        }

        return newSession;
    } catch (error: any) {
        if (error.code === 401) {
            throw new Error('邮箱或密码错误');
        }
        throw error;
    }
}

async function logoutCurrentSession() {
    try {
        await account.deleteSession('current');
    } catch (error) {
        console.error('Error deleting session:', error);
    }
}

export async function getCurrentUser() {
  try {
    const currentAccount = await account.get();
    if (!currentAccount) throw new Error("No user account found.");

    const userQuery = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.equal('accountId', currentAccount.$id)]
    );

    if (userQuery.documents.length === 0) {
        const defaultMinistry = await initializeDefaultMinistry();
        return await saveUserToDB({
            accountId: currentAccount.$id,
            name: currentAccount.name,
            email: currentAccount.email,
            ministryId: defaultMinistry.$id,
            imageUrl: avatars.getInitials(currentAccount.name).toString(),
        });
    }

    const currentUser = userQuery.documents[0];
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
    console.error(error);
    return null;
  }
}

export async function signOutAccount() {
  try {
    const session = await account.getSession('current');
    if (session) {
      const user = await getCurrentUser();
      if(user) {
        await updateUserOnlineStatus(user.$id, false);
      }
      await account.deleteSession("current");
    }
  } catch (error) {
    console.error(error);
  }
}

export async function getUserById(userId: string) {
    try {
      const userDoc = await databases.getDocument(
        appwriteConfig.databaseId,
        appwriteConfig.userCollectionId,
        userId
      );
      if (!userDoc) throw new Error('User not found by direct ID');
      return userDoc;
    } catch (error) {
      console.error(`Failed to get user by ID ${userId}:`, error);
      return null;
    }
}

export async function searchUsers(keyword: string, currentUserId: string) {
  try {
    const users = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [
        Query.search('name', keyword),
        Query.notEqual('$id', currentUserId)
      ]
    );
    if (!users) throw new Error('Search failed');
    return users.documents;
  } catch (error) {
    console.error(error);
    return [];
  }
}

// =================================================================================================
// CHAT - The Corrected Implementation
// =================================================================================================

/**
 * Gets or creates a chat between two users.
 * This is now more robust and uses two `contains` queries to ensure the correct chat is found.
 */
export async function getOrCreateChat(user1Id: string, user2Id: string): Promise<ChatDocument> {
  try {
    console.log('--- API: getOrCreateChat ---');
    console.log(`[A] Received user IDs: user1=${user1Id}, user2=${user2Id}`);

    const chatQuery = [
      Query.contains('participants', user1Id),
      Query.contains('participants', user2Id),
    ];

    console.log(`[B] Executing query to find chat with participants:`, chatQuery);

    const existingChats = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      chatQuery
    );

    // Filter for chats with exactly two participants to be more specific
    const specificChat = existingChats.documents.find(doc => doc.participants.length === 2);

    if (specificChat) {
      console.log(`[C] Found existing specific chat: ${specificChat.$id}`);
      return specificChat as ChatDocument;
    }
    
    console.log('[D] No existing chat found. Creating a new one...');
    
    const newChat = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      ID.unique(),
      {
        participants: [user1Id, user2Id].sort(), // Store sorted for consistency
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
      }
    );

    if (!newChat) {
      throw new Error("Failed to create chat document.");
    }
    
    console.log(`[E] Successfully created chat document: ${newChat.$id}`);

    const permissions = [
      Permission.read(Role.user(user1Id)),
      Permission.read(Role.user(user2Id)),
      Permission.update(Role.user(user1Id)),
      Permission.update(Role.user(user2Id)),
    ];

    const updatedChat = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      newChat.$id,
      undefined,
      permissions
    );
    
    console.log(`[F] Successfully set permissions for chat ${updatedChat.$id}`);
    return updatedChat as ChatDocument;

  } catch (error: any) {
    console.error('❌ CRITICAL ERROR in getOrCreateChat:', error);
    throw new Error(`Failed to get or create chat: ${error.message}`);
  }
}

/**
 * Retrieves all chat threads for a given user.
 * This function is now correctly typed and structured.
 */
export async function getUserChats(userId: string): Promise<UIChat[]> {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.chatCollectionId,
      [Query.contains('participants', userId)],
    );

    const chatPromises = response.documents.map(async (chat) => {
      const otherUserId = chat.participants?.find((id: string) => id !== userId);
      if (!otherUserId) {
        console.warn(`Chat ${chat.$id} is missing a participant other than the current user.`);
        return null;
      }
      
      const otherUser = await getUserById(otherUserId) as UserDocument;
      if (!otherUser) {
        console.warn(`Could not fetch user data for ${otherUserId} in chat ${chat.$id}`);
        return null;
      }
      
      return {
        ...chat,
        otherUser,
      } as UIChat;
    });
    
    const chats = (await Promise.all(chatPromises)).filter(Boolean); // Filter out nulls
    
    // Sort by most recent message
    chats.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : new Date(a.$createdAt).getTime();
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : new Date(b.$createdAt).getTime();
      return timeB - timeA;
    });

    return chats as UIChat[];
  } catch (error) {
    console.error("Failed to get user chats:", error);
    return [];
  }
}

export async function sendMessage(chatId: string, senderId: string, content: string, type: string = 'text', fileData?: any) {
  try {
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
      },
      [
          Permission.read(Role.user(senderId)),
          // The other participant's read permission is added via a server function or trigger
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
        return response.documents;
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
    } catch (error) {
        console.error("Failed to delete message:", error);
        throw error;
    }
}


// =================================================================================================
// CHAT DEBUGGING AND REPAIR FUNCTIONS - All Corrected
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

// Dummy placeholder for any other functions that were in the file
export async function placeholder() {
    return true;
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

export async function createPostComment(post: INewPost) {
    try {
        const uploaderFile = await uploadFile(post.file[0]);

        if(!uploaderFile) throw Error;

        const fileUrl = getFilePreview(uploaderFile.$id);

        if(!fileUrl) {
            await deleteFile(uploaderFile.$id);
            throw Error;
        }

        const tags = post.tags?.replace(/ /g, '').split(',') || [];

        const newPost = await databases.createDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            ID.unique(),
            {
                creator: post.userId,
                caption: post.caption,
                imageUrl: fileUrl,
                imageId: uploaderFile.$id,
                location: post.location,
                tags: tags
            }
        );

        if(!newPost) {
            await deleteFile(uploaderFile.$id);
            throw Error;
        }

        return newPost;
    } catch (error) {
        console.log(error);
    }
}

export function getFilePreview(fileId: string): string {
    try {
        const fileUrl = storage.getFileView(
            appwriteConfig.storageId,
            fileId
        );
        return fileUrl.toString();
    } catch (error) {
        console.log("Error getting file preview:", error);
        throw error;
    }
}

export async function uploadFile(file: File) {
    try {
        const uploadedFile = await storage.createFile(
            appwriteConfig.storageId,
            ID.unique(),
            file,
            [
                Permission.read(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users())
            ]
        );

        return uploadedFile;
    } catch (error) {
        console.log(error);
        throw error;
    }
}

export async function deleteFile(fileId: string) {
    try {
        await storage.deleteFile(appwriteConfig.storageId, fileId);
    
        return {status: 'ok'};
    } catch (error) {
        console.log(error);
    }
}

export async function getRecentPosts() {
    try{
        const posts = await databases.listDocuments(
            appwriteConfig.databaseId,  
            appwriteConfig.postCollectionId,
            [Query.orderDesc('$createdAt'), Query.limit(20)]
    );
        return posts.documents;
    }    catch (error) {
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
        )

        if(!updatePost) throw Error;

        return updatePost
    } catch (error) {
        console.log(error);
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
        )

        if(!updatedPost) throw Error;

        return updatedPost
    } catch (error) {
        console.log(error);
    }
}

export async function deleteSavedPost(savedRecordId: string) {
    try {
        const statusCode = await databases.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.savesCollectionId,
            savedRecordId,
        )

        if(!statusCode) throw Error;

        return {status: 'ok'}
    } catch (error) {
        console.log(error);
    }
}

export async function getPostById(postId: string): Promise<Models.Document | null> {
    try {
        const post = await databases.getDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId
        );
        return post;
    } catch (error) {
        console.log("Error in getPostById:", error);
        // Depending on requirements, you might want to return null or rethrow
        // For now, rethrowing to make it explicit that an error occurred.
        // If you want to handle "not found" gracefully, you might check error.code
        throw error; 
    }
}

export async function updatePost(post: IUpdatePost): Promise<Models.Document> {
    const hasFileToUpdate = post.file.length > 0;
    let uploadedFileData: Models.File | undefined = undefined;

    try {
        if (hasFileToUpdate) {
            // Upload new file to storage
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

        // Failed to update
        if (!updatedPost) {
            // Delete new file that has been recently uploaded
            if (uploadedFileData) {
                await deleteFile(uploadedFileData.$id);
            }

            // If no new file uploaded, just throw error
            throw Error;
        }

        // Safely delete old file after successful update
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

export async function deletePost(postId: string, imageId: string) {
    if(!postId || !imageId) throw Error;
    try {
        await databases.deleteDocument(
            appwriteConfig.databaseId,
            appwriteConfig.postCollectionId,
            postId
        )
        
        return {status: 'ok'};
    } catch (error) {
        console.log(error);
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

// 事工管理API
export async function getMinistries() {
  try {
    const ministries = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.ministryCollectionId
    );
    return ministries.documents;
  } catch (error) {
    console.error(error);
  }
}

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

export async function createMinistry(name: string) {
  try {
    const newMinistry = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ministryCollectionId,
      ID.unique(),
      { name }
    );
    return newMinistry;
  } catch (error) {
    console.error('创建事工失败:', error);
    throw error;
  }
}

export async function updateMinistry(id: string, name: string) {
  try {
    const res = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ministryCollectionId,
      id,
      { name }
    );
    return res;
  } catch (error) {
    console.error('更新事工失败:', error);
    throw error;
  }
}

export async function deleteMinistry(id: string) {
  try {
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.ministryCollectionId,
      id
    );
    return true;
  } catch (error) {
    console.error('删除事工失败:', error);
    throw error;
  }
}

// 用户管理API
export async function getUsers() {
  try {
    const res = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId
    );
    return res.documents;
  } catch (error) {
    console.error('获取用户列表失败:', error);
    throw error;
  }
}

export async function createUserByAdmin(user: INewUser) {
    try {
        // 创建 Appwrite 账户
        const newAccount = await account.create(
            ID.unique(),
            user.email,
            user.password,
            user.name
        );

        if (!newAccount) throw Error;

        // 创建默认头像
        const avatarUrl = avatars.getInitials(user.name).toString();

        // 保存用户信息到数据库
        const newUser = await saveUserToDB({
            accountId: newAccount.$id,
            name: newAccount.name,
            email: newAccount.email,
            ministryId: user.ministryId,
            imageUrl: avatarUrl,
            initialPassword: user.password // 使用创建账户时的密码作为初始密码
        });

        if(!newUser) {
            await account.deleteSession('current');  // 如果保存失败，清理会话
            throw Error('Failed to save user to database');
        }

        return newAccount;
    } catch (error: any) {
        console.error("createUserByAdmin error:", error);
        if (error.code === 409) {
            throw new Error("邮箱已注册");
        }
        throw error;
    }
}

export async function updateUser(userId: string, user: IUpdateUser) {
  try {
    // 构建更新数据，只包含有值的字段
    const updateData: any = {};
    
    if (user.email !== undefined) updateData.email = user.email;
    if (user.name !== undefined) updateData.name = user.name;
    if (user.imageUrl !== undefined) updateData.imageUrl = user.imageUrl;
    if (user.ministryId !== undefined) updateData.ministryId = user.ministryId;
    if (user.gender !== undefined) updateData.gender = user.gender;
    if (user.dateOfFaith !== undefined) updateData.dateOfFaith = user.dateOfFaith;
    if (user.faithTestimony !== undefined) updateData.faithTestimony = user.faithTestimony;
    
    // 确保至少有一个字段需要更新
    if (Object.keys(updateData).length === 0) {
      throw new Error('没有字段需要更新');
    }

    console.log('Updating user with data:', updateData);

    const updatedUser = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      userId,
      updateData
    );

    if (!updatedUser) {
      throw new Error('更新用户失败');
    }

    return updatedUser;
  } catch (error) {
    console.error('更新用户失败:', error);
    throw error;
  }
}

export async function resetUserPassword(userId: string) {
    try {
        const user = await databases.getDocument(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            userId
        );

        if (!user) {
            throw new Error('用户不存在');
        }

        // 重置为初始密码
        await account.updatePassword(user.accountId, user.initialPassword);

        return true;
    } catch (error) {
        console.error('Reset password error:', error);
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
  console.log(`[STATUS_UPDATE] Attempting to set user ${userId} to isOnline: ${isOnline}`);
  try {
    await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      userId,
      {
        isOnline: isOnline,
        lastSeen: new Date().toISOString(),
      }
    );
    console.log(`[STATUS_UPDATE] SUCCESS for user ${userId}`);
  } catch (error) {
    console.error(`[STATUS_UPDATE] FAILED for user ${userId}:`, error);
  }
}

// Friend System API
export async function getFriendRequests(userId: string) {
  try {
    console.log('🔍 开始获取好友请求，userId:', userId);
    
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.friendRequestCollectionId,
      [
        Query.equal('receiverId', userId),
        Query.equal('status', 'pending'),
        Query.orderDesc('$createdAt'),
      ]
    );

    console.log('📋 获取到的好友请求原始数据:', response.documents);

    // 获取所有事工信息，用于映射事工名称
    let ministries: any[] = [];
    try {
      const ministriesResponse = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.ministryCollectionId,
        []
      );
      ministries = ministriesResponse.documents;
      console.log('📋 获取到的事工信息:', ministries);
    } catch (error) {
      console.error('Failed to fetch ministries for friend requests:', error);
    }

    // 获取发送者的详细信息
    const requestsWithSender = await Promise.all(
      response.documents.map(async (request) => {
        try {
          const sender = await databases.getDocument(
            appwriteConfig.databaseId,
            appwriteConfig.userCollectionId,
            request.senderId
          );

          // 根据 ministryId 查找对应的事工名称
          const userMinistry = ministries.find(ministry => ministry.$id === sender.ministryId);

          console.log('📋 发送者详细信息:', {
            senderId: sender.$id,
            senderName: sender.name,
            gender: sender.gender,
            ministryId: sender.ministryId,
            ministry: userMinistry?.name,
            dateOfFaith: sender.dateOfFaith,
            faithTestimony: sender.faithTestimony,
            interests: sender.interests,
            allFields: Object.keys(sender)
          });

          return {
            ...request,
            sender: {
              $id: sender.$id,
              id: sender.$id,
              name: sender.name,
              email: sender.email,
              imageUrl: sender.imageUrl,
              gender: sender.gender,
              dateOfFaith: sender.dateOfFaith,
              faithTestimony: sender.faithTestimony,
              interests: sender.interests || [],
              ministry: userMinistry ? userMinistry.name : null,
              ministryId: sender.ministryId,
              accountId: sender.accountId,
              status: sender.status,
              username: sender.username || sender.name,
              mustChangePassword: sender.mustChangePassword || false,
              isOnline: sender.isOnline || false,
              lastSeen: sender.lastSeen
            },
          };
        } catch (error) {
          console.error(`Failed to fetch sender info for request ${request.$id}:`, error);
          return {
            ...request,
            sender: {
              $id: request.senderId,
              id: request.senderId,
              name: '未知用户',
              email: '',
              imageUrl: null,
              gender: null,
              dateOfFaith: null,
              faithTestimony: null,
              interests: [],
              ministry: null,
              ministryId: null,
              accountId: '',
              status: 'active'
            }
          };
        }
      })
    );

    console.log('✅ 完整的好友请求数据:', requestsWithSender);
    return requestsWithSender;
  } catch (error) {
    console.error('Get friend requests error:', error);
    return [];
  }
}

export async function sendFriendRequest(senderId: string, receiverId: string, message?: string) {
  try {
    // 检查是否已经是好友
    const existingFriendship = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.friendRequestCollectionId,
      [
        Query.equal('senderId', [senderId, receiverId]),
        Query.equal('receiverId', [receiverId, senderId]),
        Query.equal('status', ['pending', 'accepted']),
      ]
    );

    if (existingFriendship.documents.length > 0) {
      throw new Error('Friend request already exists or users are already friends');
    }

    // 创建好友请求
    const friendRequest = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.friendRequestCollectionId,
      ID.unique(),
      {
        senderId,
        receiverId,
        status: 'pending',
        message,
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users())
      ]
    );

    return friendRequest;
  } catch (error) {
    console.error('Send friend request error:', error);
    throw error;
  }
}

export async function handleFriendRequest(requestId: string, status: 'accepted' | 'rejected', userId: string) {
  try {
    // 首先获取现有的好友请求记录
    const existingRequest = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.friendRequestCollectionId,
      requestId
    );

    // 直接删除好友请求记录（不管接受还是拒绝）
    await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.friendRequestCollectionId,
      requestId
    );

    if (status === 'accepted') {
      // 只有接受时才创建好友关系
      const currentTime = new Date().toISOString();
      
      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.friendshipCollectionId,
        ID.unique(),
        {
          userId: existingRequest.senderId,
          friendId: existingRequest.receiverId,
          status: 'active',
          createAt: currentTime,
        },
        [
          Permission.read(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.users())
        ]
      );

      await databases.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.friendshipCollectionId,
        ID.unique(),
        {
          userId: existingRequest.receiverId,
          friendId: existingRequest.senderId,
          status: 'active',
          createAt: currentTime,
        },
        [
          Permission.read(Role.users()),
          Permission.update(Role.users()),
          Permission.delete(Role.users())
        ]
      );
    }

    return { success: true, status };
  } catch (error) {
    console.error('Handle friend request error:', error);
    throw error;
  }
}

export async function getFriends(userId: string) {
  try {
    if (!appwriteConfig.friendshipCollectionId || !appwriteConfig.userCollectionId) {
      console.error('Missing collection IDs in configuration');
      return [];
    }

    console.log('🔍 开始获取好友列表，userId:', userId);
    console.log('Fetching friendships with config:', {
      databaseId: appwriteConfig.databaseId,
      friendshipCollectionId: appwriteConfig.friendshipCollectionId,
      userCollectionId: appwriteConfig.userCollectionId
    });

    // 首先获取好友关系记录
    const friendships = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.friendshipCollectionId,
      [Query.equal('userId', userId)]
    );

    console.log('📋 获取到的好友关系:', friendships);

    if (!friendships.documents.length) {
      return [];
    }

    // 获取所有好友的用户信息
    const friendIds = friendships.documents.map(fs => fs.friendId);
    console.log('📋 好友ID列表:', friendIds);

    const friends = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      [Query.equal('$id', friendIds)]
    );

    console.log('📋 获取到的好友用户信息:', friends);

    // 获取所有事工信息，用于映射事工名称
    let ministries: any[] = [];
    try {
      const ministriesResponse = await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.ministryCollectionId,
        []
      );
      ministries = ministriesResponse.documents;
    } catch (error) {
      console.error('Failed to fetch ministries for friends:', error);
    }

    // 将好友关系ID添加到用户信息中
    const result = friends.documents.map(friend => {
      // 根据 ministryId 查找对应的事工名称
      const userMinistry = ministries.find(ministry => ministry.$id === friend.ministryId);
      const ministryName = userMinistry ? userMinistry.name : null;

      return {
        ...friend,
        $id: friend.$id,
        id: friend.$id,
        email: friend.email,
        name: friend.name,
        username: friend.username,
        imageUrl: friend.imageUrl,
        gender: friend.gender,
        dateOfFaith: friend.dateOfFaith,
        faithTestimony: friend.faithTestimony,
        ministry: ministryName, // 使用事工名称而不是ID
        ministryId: friend.ministryId,
        accountId: friend.accountId,
        status: friend.status,
        mustChangePassword: friend.mustChangePassword,
        isOnline: friend.isOnline,
        lastSeen: friend.lastSeen,
        friendshipId: friendships.documents.find(fs => fs.friendId === friend.$id)?.$id
      };
    }) as IUserWithFriendship[];

    console.log('✅ 完整的好友列表数据:', result);
    return result;
  } catch (error) {
    console.error('Get friends error:', error);
    // 添加更详细的错误日志
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
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

// 获取用户通知
export async function getUserNotifications(userId: string): Promise<INotification[]> {
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
      type: doc.type as INotification['type'],
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

// 标记单个通知为已读
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

// 标记所有通知为已读
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

// User management functions
export const createUser = async (userData: INewUser) => {
  try {
    const newUser = await account.create(
      ID.unique(),
      userData.email,
      userData.password,
      userData.name
    );

    if (!newUser) throw Error;

    const avatarUrl = userData.imageUrl || '/assets/icons/profile-placeholder.svg';

    await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      ID.unique(),
      {
        accountId: newUser.$id,
        email: userData.email,
        name: userData.name,
        imageUrl: avatarUrl,
        ministryId: userData.ministryId || '',
        status: userData.status || 'active',
        mustChangePassword: userData.mustChangePassword || true
      },
      [
        Permission.read(Role.users()),
        Permission.update(Role.users()),
        Permission.delete(Role.users())
      ]
    );

    return newUser;
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
};

export const updateUserMinistry = async (userId: string, ministryId: string) => {
  try {
    const user = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      userId
    );

    if (!user) throw Error;

    const updatedUser = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userCollectionId,
      userId,
      {
        ministryId
      }
    );

    return updatedUser;
  } catch (error) {
    console.error("Error updating user ministry:", error);
    throw error;
  }
};

// =================================================================================================
// CHAT - The Corrected Implementation
// =================================================================================================

// 初始化聊天集合
export async function initializeChatCollections() {
  try {
    // 检查chats集合是否存在
    try {
      await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.chatCollectionId,
        [Query.limit(1)]
      );
      console.log('Chats collection exists');
    } catch (error) {
      console.log('Chats collection does not exist, this is expected in demo mode');
      // 在demo模式下，我们将使用现有的post collection来模拟聊天功能
      return false;
    }
    
    // 检查messages集合是否存在
    try {
      await databases.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.messageCollectionId,
        [Query.limit(1)]
      );
      console.log('Messages collection exists');
    } catch (error) {
      console.log('Messages collection does not exist, this is expected in demo mode');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing chat collections:', error);
    return false;
  }
}

// Duplicate function removed - using the original version at line 383

// 更新指定用户的聊天列表
async function updateUserChatList(userId: string, chatId: string, content: string, type: string, userInfo?: any) {
  try {
    const userChatKey = `user_chats_${userId}`;
    const chatList = JSON.parse(localStorage.getItem(userChatKey) || '[]');
    const chatIndex = chatList.findIndex((chat: any) => chat.$id === chatId);
    
    const lastMessage = type === 'text' ? content : `发送了${type === 'file' ? '文件' : '媒体'}`;
    const lastMessageTime = new Date().toISOString();

    if (chatIndex >= 0) {
      // 更新现有聊天记录
      chatList[chatIndex].lastMessage = lastMessage;
      chatList[chatIndex].lastMessageTime = lastMessageTime;
      
      // 更新或添加缓存的用户信息
      if (userInfo && userInfo.name) {
        chatList[chatIndex].cachedUserInfo = {
          id: userInfo.id,
          name: userInfo.name,
          avatar: userInfo.avatar || '/assets/icons/profile-placeholder.svg',
          online: userInfo.online || false
        };
        console.log('更新聊天记录中的缓存用户信息:', chatList[chatIndex].cachedUserInfo);
      }
    } else {
      // 创建新的聊天记录
      const newChatEntry: any = {
        $id: chatId,
        lastMessage: lastMessage,
        lastMessageTime: lastMessageTime
      };

      // 如果提供了用户信息，保存它
      if (userInfo && userInfo.name) {
        newChatEntry.cachedUserInfo = {
          id: userInfo.id,
          name: userInfo.name,
          avatar: userInfo.avatar || '/assets/icons/profile-placeholder.svg',
          online: userInfo.online || false
        };
        console.log('创建新聊天记录中的缓存用户信息:', newChatEntry.cachedUserInfo);
      }

      chatList.push(newChatEntry);
    }
    
    localStorage.setItem(userChatKey, JSON.stringify(chatList));
    console.log(`已更新用户 ${userId} 的聊天列表，聊天ID: ${chatId}`);
  } catch (error) {
    console.error('更新用户聊天列表失败:', error);
  }
}

// 为接收者获取发送者信息
async function getSenderInfoForReceiver(senderId: string, receiverId: string) {
  try {
    console.log(`获取发送者信息: senderId=${senderId}, receiverId=${receiverId}`);
    const sender = await getUserById(senderId);
    if (sender) {
      const senderInfo = {
        id: sender.$id,
        name: sender.name,
        avatar: sender.imageUrl,
        online: sender.isOnline || false
      };
      console.log('成功获取发送者信息:', senderInfo);
      return senderInfo;
    } else {
      console.warn('未找到发送者信息');
    }
  } catch (error) {
    console.error('获取发送者信息失败:', error);
  }
  return null;
}

// 确保双方用户都有聊天记录（用于URL参数启动聊天时）
export async function ensureChatExistsForBothUsers(chatId: string, user1Id: string, user2Id: string, user1Info: any, user2Info: any) {
  try {
    // 为用户1创建与用户2的聊天记录
    const user1ChatKey = `user_chats_${user1Id}`;
    const user1ChatList = JSON.parse(localStorage.getItem(user1ChatKey) || '[]');
    const user1ChatExists = user1ChatList.some((chat: any) => chat.$id === chatId);
    
    if (!user1ChatExists) {
      user1ChatList.push({
        $id: chatId,
        lastMessage: '开始对话吧...',
        lastMessageTime: new Date().toISOString(),
        cachedUserInfo: user2Info
      });
      localStorage.setItem(user1ChatKey, JSON.stringify(user1ChatList));
    }

    // 为用户2创建与用户1的聊天记录
    const user2ChatKey = `user_chats_${user2Id}`;
    const user2ChatList = JSON.parse(localStorage.getItem(user2ChatKey) || '[]');
    const user2ChatExists = user2ChatList.some((chat: any) => chat.$id === chatId);
    
    if (!user2ChatExists) {
      user2ChatList.push({
        $id: chatId,
        lastMessage: '开始对话吧...',
        lastMessageTime: new Date().toISOString(),
        cachedUserInfo: user1Info
      });
      localStorage.setItem(user2ChatKey, JSON.stringify(user2ChatList));
    }

    return true;
  } catch (error) {
    console.error('确保双方聊天记录失败:', error);
    return false;
  }
}

// Duplicate function removed - using the original version at line 419

  // Duplicate function removed - using the original version at line 340

// Duplicate function removed - using the original version at line 567

// Duplicate function removed - using the original version at line 519

// 标记消息为已读（全局存储版本）
export async function markMessagesAsRead(chatId: string, userId: string) {
  try {
    const messages = JSON.parse(localStorage.getItem(`global_chat_${chatId}`) || '[]');
    
    // 标记所有非当前用户发送的消息为已读
    const updatedMessages = messages.map((message: any) => {
      if (message.senderId !== userId) {
        return { ...message, isRead: true };
      }
      return message;
    });

    localStorage.setItem(`global_chat_${chatId}`, JSON.stringify(updatedMessages));
    return true;
  } catch (error) {
    console.error('标记消息为已读失败:', error);
    throw error;
  }
}

// Duplicate function removed - using the original version at line 437

// 清理聊天相关的本地存储数据
export function clearChatStorage() {
  try {
    // 清理所有聊天相关的键（user_chats_、global_chat_ 开头的键）
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('user_chats_') || key.startsWith('global_chat_') || key.startsWith('chat_'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log(`已清理 ${keysToRemove.length} 个聊天相关的存储项`);
    return true;
  } catch (error) {
    console.error('清理聊天存储失败:', error);
    return false;
  }
}

// Duplicate function removed - using the original version at line 488

// Duplicate function removed - using the original version at line 506

// 全面诊断聊天存储状态
export function comprehensiveChatDiagnosis() {
  console.log('=== 开始全面聊天存储诊断 ===');
  
  const diagnosis: {
    localStorage: { [key: string]: any },
    userChatKeys: string[],
    globalChatKeys: string[],
    issues: string[]
  } = {
    localStorage: {},
    userChatKeys: [],
    globalChatKeys: [],
    issues: []
  };

  // 扫描所有localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      if (key.startsWith('user_chats_')) {
        diagnosis.userChatKeys.push(key);
        const userId = key.replace('user_chats_', '');
        try {
          const data = JSON.parse(localStorage.getItem(key) || '[]');
          diagnosis.localStorage[key] = data;
          console.log(`用户聊天列表 ${userId}:`, data);
          
          // 检查每个聊天记录
          data.forEach((chat: any, index: number) => {
            console.log(`  聊天 ${index + 1}: ${chat.$id}`);
            console.log(`    最后消息: ${chat.lastMessage}`);
            console.log(`    缓存用户信息:`, chat.cachedUserInfo);
            
            if (!chat.cachedUserInfo) {
              diagnosis.issues.push(`用户 ${userId} 的聊天 ${chat.$id} 缺少缓存用户信息`);
            } else if (!chat.cachedUserInfo.name || chat.cachedUserInfo.name === '未知用户') {
              diagnosis.issues.push(`用户 ${userId} 的聊天 ${chat.$id} 用户信息不完整: ${JSON.stringify(chat.cachedUserInfo)}`);
            }
          });
        } catch (error) {
          diagnosis.issues.push(`解析用户聊天列表失败: ${key} - ${error}`);
        }
      } else if (key.startsWith('global_chat_')) {
        diagnosis.globalChatKeys.push(key);
        const chatId = key.replace('global_chat_', '');
        try {
          const messages = JSON.parse(localStorage.getItem(key) || '[]');
          console.log(`全局聊天消息 ${chatId}: ${messages.length} 条消息`);
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            console.log(`  最新消息:`, lastMessage);
          }
        } catch (error) {
          diagnosis.issues.push(`解析全局聊天消息失败: ${key} - ${error}`);
        }
      }
    }
  }

  console.log('=== 诊断结果 ===');
  console.log('发现的问题:', diagnosis.issues);
  console.log('用户聊天列表数量:', diagnosis.userChatKeys.length);
  console.log('全局聊天数量:', diagnosis.globalChatKeys.length);
  
  return diagnosis;
}

// 获取当前用户的完整信息用于调试
export async function debugCurrentUserInfo() {
  try {
    console.log('🧪 获取当前用户完整信息...');
    const currentUser = await getCurrentUser();
    
    if (currentUser) {
      console.log('✅ 当前用户信息:');
      console.log('📝 用户名:', currentUser.name);
      console.log('🆔 文档ID:', currentUser.$id);
      console.log('🔑 账户ID:', currentUser.accountId);
      console.log('📧 邮箱:', currentUser.email);
      console.log('🖼️ 头像:', currentUser.imageUrl);
      console.log('📦 完整对象:', JSON.stringify(currentUser, null, 2));
      return currentUser;
    } else {
      console.error('❌ 当前用户为空');
      return null;
    }
  } catch (error) {
    console.error('❌ 获取当前用户信息失败:', error);
    throw error;
  }
}

// 测试用户信息获取功能
export async function testUserInfoRetrieval(userId: string) {
  console.log('🧪 开始测试用户信息获取功能...');
  console.log('🔍 测试用户ID:', userId);
  
  try {
    console.log('🌐 调用 getUserById...');
    const user = await getUserById(userId);
    
    console.log('📦 返回结果:', JSON.stringify(user, null, 2));
    
    if (user) {
      console.log('✅ 用户信息获取成功');
      console.log('📝 用户名:', user.name);
      console.log('🆔 文档ID:', user.$id);
      console.log('🔑 账户ID:', user.accountId);
      console.log('📧 邮箱:', user.email);
      console.log('🖼️ 头像:', user.imageUrl);
      console.log('🌐 在线状态:', user.isOnline);
      return user;
    } else {
      console.error('❌ 用户信息为空');
      return null;
    }
  } catch (error) {
    console.error('❌ 用户信息获取失败:', error);
    throw error;
  }
}

// 强制刷新所有聊天记录的用户信息
export async function forceRefreshAllChatUsers(userId: string) {
  try {
    console.log('🔄 开始强制刷新所有聊天记录的用户信息...');
    console.log('🔍 当前用户ID:', userId);
    
    const userChatKey = `user_chats_${userId}`;
    const chatList = JSON.parse(localStorage.getItem(userChatKey) || '[]');
    
    console.log(`📊 发现 ${chatList.length} 个聊天记录需要刷新`);
    console.log('📋 完整聊天列表:', JSON.stringify(chatList, null, 2));
    
    for (let i = 0; i < chatList.length; i++) {
      const chat = chatList[i];
      console.log(`\n🔄 处理聊天记录 ${i + 1}/${chatList.length}:`);
      console.log('📝 聊天ID:', chat.$id);
      console.log('💬 当前最后消息:', chat.lastMessage);
      console.log('👤 当前缓存用户信息:', chat.cachedUserInfo);
      
      // 从聊天ID中提取对方用户ID
      const chatIdParts = chat.$id.split('_');
      console.log('🔧 聊天ID分割结果:', chatIdParts);
      
      if (chatIdParts.length === 2) {
        const [user1, user2] = chatIdParts;
        const otherUserId = user1 === userId ? user2 : user1;
        
        console.log(`🎯 确定对方用户ID: ${otherUserId} (user1: ${user1}, user2: ${user2}, 当前用户: ${userId})`);
        
        try {
          console.log(`🌐 开始从数据库获取用户信息: ${otherUserId}`);
          const otherUser = await getUserById(otherUserId);
          
          console.log('📦 数据库返回的用户信息:', JSON.stringify(otherUser, null, 2));
          
          if (otherUser && otherUser.name) {
            const newUserInfo = {
              id: otherUser.$id,
              name: otherUser.name,
              avatar: otherUser.imageUrl,
              online: otherUser.isOnline || false
            };
            
            chatList[i].cachedUserInfo = newUserInfo;
            console.log(`✅ 成功刷新用户信息:`, newUserInfo);
          } else {
            const fallbackInfo = {
              id: otherUserId,
              name: `用户_${otherUserId.slice(-4)}`,
              avatar: '/assets/icons/profile-placeholder.svg',
              online: false
            };
            
            console.warn(`⚠️ 用户信息不完整，使用备用信息:`, fallbackInfo);
            console.warn('原始用户数据:', otherUser);
            chatList[i].cachedUserInfo = fallbackInfo;
          }
        } catch (error) {
          const errorInfo = {
            id: otherUserId,
            name: `用户_${otherUserId.slice(-4)}`,
            avatar: '/assets/icons/profile-placeholder.svg',
            online: false
          };
          
          console.error(`❌ 获取用户 ${otherUserId} 信息失败:`, error);
          console.log('🔄 使用错误备用信息:', errorInfo);
          chatList[i].cachedUserInfo = errorInfo;
        }
      } else {
        console.error(`❌ 聊天ID格式不正确: ${chat.$id}`);
      }
    }
    
    // 保存更新的聊天列表
    localStorage.setItem(userChatKey, JSON.stringify(chatList));
    console.log('✅ 所有聊天记录用户信息刷新完成');
    console.log('📋 最终聊天列表:', JSON.stringify(chatList, null, 2));
    
    return chatList;
  } catch (error) {
    console.error('❌ 强制刷新聊天用户信息失败:', error);
    throw error;
  }
}

// 修复函数：更新现有聊天记录中的用户信息
export async function fixChatUserInfo(userId: string) {
  try {
    console.log('开始修复用户聊天记录中的用户信息...');
    
    // 先做诊断
    const diagnosis = comprehensiveChatDiagnosis();
    
    const userChatKey = `user_chats_${userId}`;
    const chatList = JSON.parse(localStorage.getItem(userChatKey) || '[]');
    
    console.log(`当前用户 ${userId} 的聊天列表:`, chatList);
    
    let updated = false;
    
    for (let i = 0; i < chatList.length; i++) {
      const chat = chatList[i];
      console.log(`处理聊天记录 ${i + 1}:`, chat);
      
      if (!chat.cachedUserInfo || !chat.cachedUserInfo.name || chat.cachedUserInfo.name === '未知用户') {
        // 从聊天ID中提取对方用户ID
        const chatIdParts = chat.$id.split('_');
        if (chatIdParts.length === 2) {
          const [user1, user2] = chatIdParts;
          const otherUserId = user1 === userId ? user2 : user1;
          
          console.log(`尝试修复聊天记录: ${chat.$id}, 对方用户ID: ${otherUserId}`);
          
          try {
            const otherUser = await getUserById(otherUserId);
            console.log(`获取到的用户信息:`, otherUser);
            
            if (otherUser && otherUser.name) {
              chatList[i].cachedUserInfo = {
                id: otherUser.$id,
                name: otherUser.name,
                avatar: otherUser.imageUrl,
                online: otherUser.isOnline || false
              };
              console.log('成功修复用户信息:', chatList[i].cachedUserInfo);
              updated = true;
            } else {
              console.warn('获取到的用户信息不完整或为空');
            }
          } catch (error) {
            console.error('修复用户信息失败:', error);
          }
        } else {
          console.warn('聊天ID格式不正确:', chat.$id);
        }
      } else {
        console.log('聊天记录已有有效的用户信息:', chat.cachedUserInfo);
      }
    }
    
    if (updated) {
      localStorage.setItem(userChatKey, JSON.stringify(chatList));
      console.log('聊天记录修复完成，已保存更新。新的聊天列表:');
      console.log(JSON.stringify(chatList, null, 2));
      return true;
    } else {
      console.log('没有需要修复的聊天记录');
      return false;
    }
  } catch (error) {
    console.error('修复聊天用户信息失败:', error);
    return false;
  }
}

// 添加专门处理用户头像URL的函数
export function getUserAvatarUrl(imageUrl: string | null | undefined): string {
    try {
        // 如果没有图片URL，返回默认头像
        if (!imageUrl) {
            return '/assets/icons/profile-placeholder.svg';
        }
        
        // 如果已经是完整的URL（包含http/https），直接返回
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            console.log('🖼️ 使用完整URL头像:', imageUrl);
            return imageUrl;
        }
        
        // 如果是相对路径（如 /assets/），直接返回
        if (imageUrl.startsWith('/')) {
            console.log('🖼️ 使用相对路径头像:', imageUrl);
            return imageUrl;
        }
        
        // 如果看起来像文件ID（没有协议和路径），尝试作为Storage文件处理
        if (imageUrl.length > 10 && !imageUrl.includes('/')) {
            console.log('🖼️ 检测到Storage文件ID，生成预览URL:', imageUrl);
            const fileUrl = storage.getFileView(
                appwriteConfig.storageId,
                imageUrl
            );
            const finalUrl = fileUrl.toString();
            console.log('🖼️ 生成的Storage URL:', finalUrl);
            return finalUrl;
        }
        
        // 其他情况，尝试直接使用
        console.log('🖼️ 直接使用头像URL:', imageUrl);
        return imageUrl;
        
    } catch (error) {
        console.error("获取用户头像URL失败:", error);
        console.log('🖼️ 使用默认头像作为备用');
        return '/assets/icons/profile-placeholder.svg';
    }
}

// ============================================================
// CALL HISTORY
// ============================================================

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

// 创建通话记录
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

// 获取用户的通话记录
export async function getCallHistoryForUser(userId: string) {
  try {
    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.callsCollectionId,
      [
        Query.or([
          Query.equal('callerId', userId),
          Query.equal('receiverId', userId)
        ]),
        Query.orderDesc('initiatedAt'),
        Query.limit(50)
      ]
    );
    return response.documents as (Models.Document & ICallRecord)[];
  } catch (error) {
    console.error("Failed to get call history:", error);
    throw error;
  }
}

// ============================================================
// NOTIFICATIONS
// ============================================================
export interface IAppNotification {
  userId: string;
  type: 'missed_call' | 'new_message' | 'friend_request';
  message: string;
  relatedItemId?: string;
  isRead: boolean;
}

// 创建通知
export async function createNotification(notificationData: Omit<IAppNotification, 'isRead'>) {
  try {
    const newNotification = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.notificationCollectionId,
      ID.unique(),
      {
        ...notificationData,
        isRead: false, // 确保初始状态为未读
      }
    );
    console.log("🔔 通知创建成功:", newNotification);
    return newNotification;
  } catch (error) {
    console.error("创建通知失败:", error);
    throw new Error("创建通知时出错");
  }
}

// 获取用户未读通知数量
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

// 将通知标记为已读
export async function markNotificationsAsRead(userId: string, type?: 'missed_call') {
  try {
    // 1. 先查询所有未读通知
    const queries = [Query.equal('userId', userId), Query.equal('isRead', false)];
    if (type) {
      queries.push(Query.equal('type', type));
    }

    const response = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.notificationCollectionId,
      queries
    );

    // 2. 遍历并更新每一条为已读
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

// ============================================================
// SEARCH
// ============================================================
// ============================================================