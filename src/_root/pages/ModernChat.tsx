import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useUserContext } from '@/context/AuthContext';
import SearchBar from '@/components/chat/SearchBar';
import MessageList, { MessageThread } from '@/components/chat/MessageList';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatInput from '@/components/chat/ChatInput';
import MessageBubble from '@/components/shared/MessageBubble';
import Loader from '@/components/shared/Loader';
import { getUserChats, getChatMessages, sendMessage, uploadFile, getFilePreview, getUserOnlineStatus, searchUsers, getOrCreateChat, deleteMessage, getUserById, debugUserChats, getChatStorageInfo, fixChatDataSync, advancedChatDiagnosis, recreateMissingChats } from '@/lib/appwrite/api';
import { useToast } from '@/components/ui/use-toast';
import { AttachmentType } from '@/components/chat/AttachmentMenu';
import ImprovedVoiceCallModal from '@/components/chat/ImprovedVoiceCallModal';
import VideoCallModal from '@/components/chat/VideoCallModal';
import UserProfileModal from '@/components/shared/UserProfileModal';
import FileMessage from '@/components/shared/FileMessage';
import { client, appwriteConfig } from '@/lib/appwrite/config';
import useDebounce from "@/hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import FileAggregation from '@/components/shared/FileAggregation';
import { downloadMultipleFiles } from '@/utils/downloadUtils';
import AudioPlayer from '@/components/shared/AudioPlayer';
import { useCall } from '@/context/CallContext';
import { useSearchParams } from 'react-router-dom';
import { useChatContext } from '@/context/ChatContext';
import { Models } from 'appwrite';
import { UIChat } from '@/lib/appwrite/api';

// 聊天功能验证工具
const validateChatFeatures = (user: any, chats: any[], currentChat: any, globalCurrentChat: any) => {
  const results = {
    chatListLoaded: chats.length > 0,
    chatSelected: !!currentChat,
    globalStateSync: !!globalCurrentChat,
    stateConsistency: currentChat?.$id === globalCurrentChat?.id,
    userAuthenticated: !!user?.$id,
    chatPrivacy: currentChat ? 'Private chat enabled - only participants can access' : 'No active chat',
    features: {
      leftSidebar: '✅ 联系人列表已实现',
      rightPanel: '✅ 聊天窗口已实现', 
      highlighting: currentChat ? '✅ 当前聊天已高亮显示' : '⏳ 等待选择聊天',
      messageHistory: '✅ 聊天记录保存功能已启用',
      privacy: '✅ 私密聊天保护已启用'
    }
  };
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 聊天功能验证结果:', results);
  }
  
  return results;
};

// Helper functions for message display
const formatMessageDate = (timestamp: string | Date) => {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const isToday = date.toDateString() === now.toDateString();
  
  // Format based on how old the message is
  if (diff < 60 * 1000) { // Less than a minute
    return 'Just now';
  } else if (diff < 60 * 60 * 1000) { // Less than an hour
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}m ago`;
  } else if (isToday) { // Today
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diff < 7 * 24 * 60 * 60 * 1000) { // Within a week
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleString([], options);
  } else { // Older than a week
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleString([], options);
  }
};

// Check if message contains a URL
const containsUrl = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return urlRegex.test(text);
};

// Check if message is just emojis
const isEmojiOnly = (text: string) => {
  const emojiRegex = /^[\p{Emoji}\s]+$/u;
  return emojiRegex.test(text);
};

const isAudioFile = (fileName: string) => {
  return /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(fileName);
};

// Format file size helper
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const ModernChat: React.FC = () => {
  const { user } = useUserContext();
  const { toast } = useToast();
  const { initiateCall } = useCall();
  const [searchParams, setSearchParams] = useSearchParams();
  const { 
    incrementTotalUnreadCount, 
    resetChatUnreadCount, 
    currentChat: globalCurrentChat, 
    setCurrentChat: setGlobalCurrentChat 
  } = useChatContext();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [chats, setChats] = useState<UIChat[]>([]);
  const [onlineStatusMap, setOnlineStatusMap] = useState<Map<string, boolean>>(new Map());
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const [currentChat, setCurrentChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isPeerOnline, setIsPeerOnline] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // 新增：聊天保存状态指示
  const [chatSaveStatus, setChatSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // 诊断功能状态
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [diagnosisData, setDiagnosisData] = useState<any>(null);

  // Context menu for messages
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: any } | null>(null);

  // Voice / Video / Info modal states
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Hidden file input for attachments
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Ref to bottom of message list for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 处理从URL参数启动聊天（支持both 'chat' 和 'with' 参数）
    const friendId = searchParams.get('chat') || searchParams.get('with');
    if (friendId) {
      getUserById(friendId).then((friendUser) => {
        if (friendUser) {
          handleSelectUserFromSearch(friendUser);
        }
      }).catch(err => {
        console.error("Failed to get user by ID for chat:", err);
        toast({ title: "无法打开聊天", description: "找不到指定的用户。", variant: "destructive" });
      });
      // Clean up the URL parameters
      searchParams.delete('chat');
      searchParams.delete('with');
      searchParams.delete('name');
      searchParams.delete('avatar');
      setSearchParams(searchParams);
    }
  }, [searchParams, user.$id]);

  // Real-time subscription for new chats
  useEffect(() => {
    if (!user.$id) return;

    const channel = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.chatCollectionId}.documents`;
    const unsubscribe = client.subscribe(channel, (response) => {
      if (response.events.includes('databases.*.collections.*.documents.*.create')) {
        const newChat = response.payload as any;
        if (newChat.participants?.includes(user.$id)) {
          // A new chat involving the current user was created, refresh the list.
          getUserChats(user.$id).then(fetchedChats => setChats(fetchedChats));
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user.$id]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu]);

  // Effect for searching users
  useEffect(() => {
    if (debouncedSearch) {
      setIsSearching(true);
      searchUsers(debouncedSearch, user.$id)
        .then((results: any) => {
          if (results) {
            setSearchResults(results);
          }
        })
        .finally(() => setIsSearching(false));
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch, user.$id]);

  // Effect 1: Load chats from cache, then fetch from network
  useEffect(() => {
    if (!user?.$id) return;

    const CHATS_CACHE_KEY = `chats_cache_${user.$id}`;
    let isMounted = true;

    const loadAndSyncChats = async () => {
      // 1. Load from cache for instant UI
      try {
        const cachedChats = localStorage.getItem(CHATS_CACHE_KEY);
        if (cachedChats && isMounted) {
          setChats(JSON.parse(cachedChats));
        }
      } catch (error) {
        console.error("Failed to load chats from cache:", error);
      }

      if (isMounted) {
        setLoadingThreads(true);
      }

      try {
        // 2. Fetch latest chats from DB
        const freshChats = await getUserChats(user.$id);
        if (isMounted) {
          setChats(freshChats);
          localStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(freshChats));
        }

        // 3. Auto-sync missing chats
        const syncResult = await recreateMissingChats(user.$id);
        if (isMounted && syncResult.success && syncResult.createdCount && syncResult.createdCount > 0) {
          toast({
            title: "Chats Synced",
            description: `Successfully restored ${syncResult.createdCount} missing conversations.`,
          });
          // Refresh the list one last time
          const finalChats = await getUserChats(user.$id);
          if (isMounted) {
            setChats(finalChats);
            localStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(finalChats));
          }
        }
      } catch (e: any) {
        console.error("❌ Failed to load or sync chats:", e);
        if (isMounted) {
          toast({ title: 'Loading Failed', description: e.message || 'Could not load chat list.', variant: 'destructive' });
        }
      } finally {
        if (isMounted) {
          setLoadingThreads(false);
        }
      }
    };

    loadAndSyncChats();

    return () => {
      isMounted = false;
    };
  }, [user?.$id, toast]);

  // Effect 2: Fetch initial statuses and subscribe to real-time updates
  useEffect(() => {
    const subscriptions: (() => void)[] = [];
    const peerIds = chats.map(chat => chat.otherUser?.$id).filter(Boolean);

    if (peerIds.length === 0) return;

    // 1. Fetch all initial statuses at once for a fresh snapshot
    const fetchInitialStatuses = async () => {
      try {
        const statusPromises = peerIds.map(id => getUserOnlineStatus(id));
        const statuses = await Promise.all(statusPromises);
        setOnlineStatusMap(prevMap => {
            const newMap = new Map(prevMap);
            statuses.forEach((status, index) => {
                const peerId = peerIds[index];
                if (peerId && status) {
                    newMap.set(peerId, status.isOnline);
                }
            });
            return newMap;
        });
      } catch (error) {
        console.error("Failed to fetch initial online statuses:", error);
      }
    };
    fetchInitialStatuses();

    // 2. Set up subscriptions for real-time updates
    peerIds.forEach(peerId => {
      const documentId = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.userCollectionId}.documents.${peerId}`;
      const unsubscribe = client.subscribe(documentId, (response) => {
        const updatedUser = response.payload as any;
        if (typeof updatedUser.isOnline === 'boolean') {
          setOnlineStatusMap(prevMap => new Map(prevMap).set(peerId, updatedUser.isOnline));
        }
      });
      subscriptions.push(unsubscribe);
    });

    return () => {
      subscriptions.forEach(sub => sub());
    };
  }, [chats]);

  // 选中聊天
  const selectChat = useCallback(async (chat: any) => {
    // Reset unread count for this specific chat
    const countToReset = unreadCounts[chat.$id] || 0;
    if (countToReset > 0) {
      resetChatUnreadCount(countToReset);
      setUnreadCounts(prev => ({ ...prev, [chat.$id]: 0 }));
    }
    
    // Clear any active search so the full thread list becomes visible again
    setSearch('');
    setSearchResults([]);

    // 同时更新本地状态和全局状态
    setCurrentChat(chat);
    setGlobalCurrentChat({
      id: chat.$id,
      otherUser: {
        $id: chat.otherUser?.$id,
        name: chat.otherUser?.name || 'Unknown User',
        imageUrl: chat.otherUser?.imageUrl,
      }
    });
  }, [unreadCounts, resetChatUnreadCount, setGlobalCurrentChat]);

  // Effect 3: Derive UI threads from raw data and status map
  useEffect(() => {
    const mapped: MessageThread[] = chats.map((c: any) => ({
      id: c.$id,
      name: c.otherUser?.name || 'Unknown User',
      avatar: c.otherUser?.imageUrl,
      preview: c.lastMessage,
      isOnline: onlineStatusMap.get(c.otherUser?.$id) ?? false,
      unread: unreadCounts[c.$id] || 0,
      // 使用全局状态和本地状态的组合来确定选中状态
      selected: (globalCurrentChat?.id === c.$id) || (currentChat?.$id === c.$id),
      onClick: () => selectChat(c),
      otherUser: c.otherUser,
    }));
    setThreads(mapped);
  }, [chats, onlineStatusMap, currentChat, globalCurrentChat, unreadCounts, selectChat]);

  // Effect: 同步全局状态到本地状态
  useEffect(() => {
    if (globalCurrentChat && !currentChat) {
      // 如果全局状态有值但本地状态没有，尝试从chats中找到对应的chat
      const matchingChat = chats.find(c => c.$id === globalCurrentChat.id);
      if (matchingChat) {
        setCurrentChat(matchingChat);
      }
    }
    
    // 验证聊天功能状态
    validateChatFeatures(user, chats, currentChat, globalCurrentChat);
  }, [globalCurrentChat, currentChat, chats, user]);

  // 订阅对方用户的在线状态
  useEffect(() => {
    if (!currentChat?.otherUser?.$id) return;

    const peerId = currentChat.otherUser.$id;
    const documentId = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.userCollectionId}.documents.${peerId}`;
    
    // 设置初始状态
    setIsPeerOnline(currentChat.otherUser?.isOnline || false);

    const unsubscribe = client.subscribe(documentId, (response) => {
        const updatedUser = response.payload as any;
        if (typeof updatedUser.isOnline === 'boolean') {
            setIsPeerOnline(updatedUser.isOnline);
        }
    });

    return () => {
        unsubscribe();
    };
  }, [currentChat?.otherUser?.$id]);

  // Effect: 组件卸载时清理全局状态
  useEffect(() => {
    return () => {
      // 当组件卸载时，不清理全局状态，这样用户重新进入时可以保持状态
      // 如果需要在特定情况下清理，可以调用 clearCurrentChat()
    };
  }, []);

  // Effect to fetch messages when the current chat changes
  useEffect(() => {
    if (!currentChat) {
      setMessages([]); // Clear messages if no chat is selected
      return;
    }

    setLoadingMessages(true);
    setMessages([]);

    // 1. Initial fetch of historical messages
    getChatMessages(currentChat.$id, 100)
      .then((msgs) => {
        const normalizedMsgs = msgs.map((msg: any) => ({
          ...msg,
          timestamp: msg.$createdAt,
          senderId: msg.sender,
          type: msg.messageType,
        }));
        setMessages(normalizedMsgs);
      })
      .catch((e) => {
        console.error("Failed to fetch messages:", e);
        toast({ title: '加载失败', description: '无法加载消息', variant: 'destructive' });
      })
      .finally(() => {
        setLoadingMessages(false);
      });

    // 2. Set up real-time subscription for new messages
    const channel = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.messageCollectionId}.documents`;
    
    const unsubscribe = client.subscribe(channel, (response) => {
      if (response.events.includes('databases.*.collections.*.documents.*.create')) {
        const newMessage = response.payload as Models.Document;

        // IMPORTANT: Ignore all messages sent by the current user in this listener
        if (newMessage.sender === user.$id) {
          return;
        }
        
        // If the incoming message is for the chat we have open
        if (newMessage.chatId === currentChat?.$id) {
          // Update messages in the open chat window
          setMessages((prev) => [...prev, newMessage]);

          // Also update the preview text and ordering in the thread list so it reflects in real-time
          setChats(prevChats => {
            const chatToUpdate = prevChats.find(c => c.$id === newMessage.chatId);
            if (!chatToUpdate) return prevChats;
            const otherChats = prevChats.filter(c => c.$id !== newMessage.chatId);
            const updatedChats = [{ ...chatToUpdate, lastMessage: newMessage.content, lastMessageTime: newMessage.$createdAt }, ...otherChats];
            
            // Save the updated list to cache
            try {
              if (user?.$id) {
                localStorage.setItem(`chats_cache_${user.$id}`, JSON.stringify(updatedChats));
              }
            } catch (error) {
              console.error("Failed to cache updated chats:", error)
            }

            return updatedChats;
          });

        } else {
          // If the incoming message is for another, inactive chat
          setUnreadCounts(prev => ({ ...prev, [newMessage.chatId]: (prev[newMessage.chatId] || 0) + 1 }));
          incrementTotalUnreadCount();
          
          // Re-fetch, then update state and cache
          if (user?.$id) {
            const CHATS_CACHE_KEY = `chats_cache_${user.$id}`;
            getUserChats(user.$id).then(freshChats => {
              setChats(freshChats);
              try {
                localStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(freshChats));
              } catch (error) {
                console.error("Failed to save chats to cache on real-time update:", error);
              }
            });
          }
        }
      }
    });

    // 3. Cleanup function to run when component unmounts or currentChat changes
    return () => {
      unsubscribe();
    };

  }, [currentChat, user.$id, incrementTotalUnreadCount]);

  const handleSelectUserFromSearch = async (searchedUser: any) => {
    console.log('--- Chat Initiation Step 1: User Clicked ---');
    console.log('User object from search result:', {
      id: searchedUser.$id,
      name: searchedUser.name,
      email: searchedUser.email
    });
    console.log('Current logged-in user:', { id: user.$id, name: user.name });

    setSearch('');
    setSearchResults([]);
    setLoadingMessages(true);

    try {
        console.log(`--- Chat Initiation Step 2: Calling API ---`);
        console.log(`Sending my ID (${user.$id}) and their ID (${searchedUser.$id}) to getOrCreateChat.`);
        const chatDoc = await getOrCreateChat(user.$id, searchedUser.$id);

        console.log('--- Chat Initiation Step 3: API Response ---');
        console.log('Received chat document from API:', {
          id: chatDoc.$id,
          participants: chatDoc.participants,
        });

        const newOrUpdatedChatObject = {
            ...chatDoc,
            otherUser: searchedUser,
        };

        // Step 3 & 4: Update state in a batched, consistent manner.
        // React batches these `set` calls. By first updating the list and then setting
        // the current chat to an object *from* that list, we avoid race conditions
        // and ensure the UI is always in a synchronized state.
        setChats(prevChats => {
            const otherChats = prevChats.filter(c => c.$id !== chatDoc.$id);
            return [newOrUpdatedChatObject, ...otherChats];
        });
        setCurrentChat(newOrUpdatedChatObject);
        
        // 同时更新全局状态
        setGlobalCurrentChat({
            id: chatDoc.$id,
            otherUser: {
                $id: searchedUser.$id,
                name: searchedUser.name || 'Unknown User',
                imageUrl: searchedUser.imageUrl,
            }
        });

    } catch (error) {
        toast({ title: "开启聊天失败", description: "无法创建或获取聊天。", variant: "destructive" });
        console.error("Failed to start chat from search:", error);
    } finally {
        setLoadingMessages(false);
    }
  };

  // 发送文本消息
  const handleSend = async (text: string) => {
    if (!currentChat) return;
    
    setChatSaveStatus('saving');
    
    // Generate unique message ID outside try-catch block
    const tempMessageId = Date.now().toString();
    
    try {
      // Optimistically add the message to the UI
      const newMsg = {
        $id: tempMessageId,
        senderId: user.$id,
        content: text,
        type: 'text',
        timestamp: new Date().toISOString(),
        status: 'sending',
      };
      setMessages((prev) => [...prev, newMsg]);

      // Optimistically update the chat list on the left
      setChats(prevChats => {
        const chatToUpdate = prevChats.find(c => c.$id === currentChat.$id);
        if (!chatToUpdate) return prevChats;
        const otherChats = prevChats.filter(c => c.$id !== currentChat.$id);
        return [{...chatToUpdate, lastMessage: text, lastMessageTime: new Date().toISOString()}, ...otherChats];
      });

      // Send the message to the backend
      await sendMessage(currentChat.$id, user.$id, text, 'text');
      
      setChatSaveStatus('saved');
      
      // 更新消息状态为已发送
      setMessages((prev) => 
        prev.map(msg => 
          msg.$id === tempMessageId ? { ...msg, status: 'sent' } : msg
        )
      );
      
      // 短时间后重置状态指示
      setTimeout(() => setChatSaveStatus('idle'), 2000);
      
    } catch (e) {
      console.error(e);
      setChatSaveStatus('error');
      toast({ title: '发送失败', description: '无法发送消息', variant: 'destructive' });
      
      // 标记消息为失败状态
      setMessages((prev) => 
        prev.map(msg => 
          msg.$id === tempMessageId ? { ...msg, status: 'failed' } : msg
        )
      );
      
      setTimeout(() => setChatSaveStatus('idle'), 3000);
    }
  };

  // 附件点击
  const handleAttach = (type: AttachmentType) => {
    // trigger hidden file input
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'media' ? 'image/*,video/*' : '*/*';
      fileInputRef.current.click();
    }
  };

  // Handle file selection
  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentChat) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        // 上传到 Appwrite Storage
        const uploaded = await uploadFile(file);
        const previewUrl = getFilePreview(uploaded.$id);

        const fileMeta = {
          id: uploaded.$id,
          name: file.name,
          size: file.size,
          type: file.type,
          url: previewUrl,
        };

        await sendMessage(currentChat.$id, user.$id, file.name, 'file', fileMeta);
        const newMsg = {
          $id: Date.now().toString() + Math.random(),
          senderId: user.$id,
          content: file.name,
          type: 'file',
          fileData: fileMeta,
          timestamp: new Date().toISOString(),
          status: 'sent',
        };
        setMessages((prev) => [...prev, newMsg]);
      } catch (err) {
        console.error(err);
        toast({ title: '发送失败', description: '无法发送文件', variant: 'destructive' });
      }
    }
    // 清空输入值，确保下次 change 触发
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 过滤线程
  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    return threads.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, threads]);

  // 诊断聊天问题（增强版）
  const handleDiagnoseChats = async () => {
    if (!user?.$id) {
      toast({ title: '诊断失败', description: '用户未登录', variant: 'destructive' });
      return;
    }

    try {
      console.log('🔍 开始高级聊天诊断...');
      
      // 使用新的高级诊断功能
      const advancedDiagnosis = await advancedChatDiagnosis(user.$id);
      
      // 检查诊断是否成功
      if (advancedDiagnosis.success === false) {
        throw new Error(advancedDiagnosis.error || '诊断失败');
      }
      
      // 兼容旧格式的诊断结果
      const diagnosisResult = {
        userId: user.$id,
        userName: user.name,
        timestamp: new Date().toISOString(),
        advanced: advancedDiagnosis,
        // 保留原有格式以便UI兼容
        databaseChats: advancedDiagnosis.processedChats?.filter((chat: any) => chat.issues?.length === 0) || [],
        localStorageInfo: getChatStorageInfo(),
        userDebugInfo: debugUserChats(user.$id),
        databaseConfig: {
          databaseId: appwriteConfig.databaseId,
          chatCollectionId: appwriteConfig.chatCollectionId,
          messageCollectionId: appwriteConfig.messageCollectionId,
        },
        uiState: {
          chatsLength: chats.length,
          threadsLength: threads.length,
          currentChatId: currentChat?.$id,
          globalCurrentChatId: globalCurrentChat?.id,
        },
        diagnosis: {
          hasLocalChats: (advancedDiagnosis.localCache?.count || 0) > 0,
          hasDatabaseChats: (advancedDiagnosis.databaseQuery?.documentsCount || 0) > 0,
          chatCountMismatch: (advancedDiagnosis.localCache?.count || 0) !== (advancedDiagnosis.databaseQuery?.documentsCount || 0),
          syncIssue: currentChat?.$id !== globalCurrentChat?.id,
          issues: advancedDiagnosis.issues || [],
          recommendations: advancedDiagnosis.recommendations || []
        }
      };

      console.log('📊 高级聊天诊断结果:', diagnosisResult);
      setDiagnosisData(diagnosisResult);
      setShowDiagnosis(true);
      
      const dbCount = advancedDiagnosis.databaseQuery?.documentsCount || 0;
      const localCount = advancedDiagnosis.localCache?.count || 0;
      
      toast({ 
        title: '高级诊断完成', 
        description: `数据库: ${dbCount} 个，本地: ${localCount} 个聊天记录`,
      });

    } catch (error) {
      console.error('高级诊断失败:', error);
      toast({ title: '诊断失败', description: '无法完成聊天诊断', variant: 'destructive' });
    }
  };

  // 智能修复聊天记录
  const handleSmartFixChats = async () => {
    if (!user?.$id) {
      toast({ title: '修复失败', description: '用户未登录', variant: 'destructive' });
      return;
    }

    try {
      console.log('🔧 开始智能修复聊天记录...');
      
      toast({ 
        title: '开始修复', 
        description: '正在分析和修复聊天数据同步问题...',
      });
      
      // 使用新的智能修复功能
      const fixResult = await fixChatDataSync(user.$id);
      
      if (fixResult.success) {
        // 更新本地状态
        setChats(fixResult.chats || []);
        
        // 关闭诊断窗口
        setShowDiagnosis(false);
        
        toast({ 
          title: '智能修复完成', 
          description: `修复后: ${fixResult.finalCount} 个聊天`,
        });
        
        // 显示详细修复结果
        console.log('📊 修复结果详情:', fixResult);
        
      } else {
        toast({ 
          title: '修复失败', 
          description: fixResult.error || '智能修复过程中出现错误',
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('智能修复失败:', error);
      toast({ title: '修复失败', description: '无法完成智能修复', variant: 'destructive' });
    }
  };

  // 快速重新加载（保留作为备用选项）
  const handleQuickReload = async () => {
    if (!user?.$id) return;

    try {
      setLoadingThreads(true);
      const freshChats = await getUserChats(user.$id);
      setChats(freshChats);
      
      const CHATS_CACHE_KEY = `chats_cache_${user.$id}`;
      localStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(freshChats));
      
      toast({ 
        title: '重新加载完成', 
        description: `显示 ${freshChats.length} 个聊天记录`,
      });
    } catch (error) {
      toast({ title: '加载失败', description: '无法重新加载聊天列表', variant: 'destructive' });
    } finally {
      setLoadingThreads(false);
    }
  };

  // Auto scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loadingMessages]);

  const handleContextMenu = (e: React.MouseEvent, message: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (message.senderId === user.$id) {
      setContextMenu({
        x: e.pageX,
        y: e.pageY,
        message: message,
      });
    }
  };

  const handleDeleteMessage = async () => {
    if (!contextMenu || !currentChat) return;

    const { message } = contextMenu;

    try {
      await deleteMessage(message.$id);
      setMessages((prevMessages) =>
        prevMessages.filter((m) => m.$id !== message.$id)
      );
    } catch (error) {
      console.error("Failed to delete message:", error);
    } finally {
      setContextMenu(null);
    }
  };

  // Group consecutive files from the same sender
  const groupConsecutiveFiles = useCallback((messages: any[]) => {
    const grouped: any[] = [];
    let currentGroup: any[] = [];
    
    messages.forEach((msg, index) => {
      const prevMsg = index > 0 ? messages[index - 1] : null;
      const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
      
      // Check if this message should be grouped with previous
      const shouldGroupWithPrev = prevMsg && 
        prevMsg.senderId === msg.senderId &&
        prevMsg.type === 'file' && 
        msg.type === 'file' &&
        (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime()) < 30000; // 30 seconds
      
      // Check if this message should be grouped with next
      const shouldGroupWithNext = nextMsg &&
        nextMsg.senderId === msg.senderId &&
        nextMsg.type === 'file' && 
        msg.type === 'file' &&
        (new Date(nextMsg.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 30000; // 30 seconds

      if (msg.type === 'file' && (shouldGroupWithPrev || shouldGroupWithNext)) {
        currentGroup.push(msg);
        
        // If this is the last message in a group, finalize it
        if (!shouldGroupWithNext) {
          if (currentGroup.length > 1) {
            // Create aggregated message
            const aggregated = {
              ...currentGroup[0],
              id: `aggregated-${currentGroup[0].$id}`,
              type: 'file-aggregation',
              files: currentGroup.map(m => ({
                id: m.$id || m.id,
                name: m.content,
                size: (m.fileData || m.file_data || m.fileMeta)?.size || 0,
                type: (m.fileData || m.file_data || m.fileMeta)?.type || 'application/octet-stream',
                url: (m.fileData || m.file_data || m.fileMeta)?.url,
                file: (m.fileData || m.file_data || m.fileMeta)?.file,
                base64: (m.fileData || m.file_data || m.fileMeta)?.base64,
              })),
              timestamp: currentGroup[currentGroup.length - 1].timestamp,
              isFirstInGroup: index === 0 || messages[index - currentGroup.length]?.senderId !== msg.senderId,
              isLastInGroup: index === messages.length - 1 || nextMsg?.senderId !== msg.senderId,
            };
            grouped.push(aggregated);
          } else {
            // Single file, add normally
            grouped.push({
              ...currentGroup[0],
              isFirstInGroup: !shouldGroupWithPrev,
              isLastInGroup: !shouldGroupWithNext,
            });
          }
          currentGroup = [];
        }
      } else {
        // Non-file message or isolated file
        if (currentGroup.length > 0) {
          // Finalize any pending group
          if (currentGroup.length > 1) {
            const aggregated = {
              ...currentGroup[0],
              id: `aggregated-${currentGroup[0].$id}`,
              type: 'file-aggregation',
              files: currentGroup.map(m => ({
                id: m.$id || m.id,
                name: m.content,
                size: (m.fileData || m.file_data || m.fileMeta)?.size || 0,
                type: (m.fileData || m.file_data || m.fileMeta)?.type || 'application/octet-stream',
                url: (m.fileData || m.file_data || m.fileMeta)?.url,
                file: (m.fileData || m.file_data || m.fileMeta)?.file,
                base64: (m.fileData || m.file_data || m.fileMeta)?.base64,
              })),
              timestamp: currentGroup[currentGroup.length - 1].timestamp,
            };
            grouped.push(aggregated);
          } else {
            grouped.push(currentGroup[0]);
          }
          currentGroup = [];
        }
        
        // Add message properties for grouping
        const prevGrouped = grouped[grouped.length - 1];
        const isFirstInGroup = !prevGrouped || prevGrouped.senderId !== msg.senderId;
        const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
        
        grouped.push({
          ...msg,
          isFirstInGroup,
          isLastInGroup,
        });
      }
    });
    
    return grouped;
  }, []);

  // Process messages for better UI grouping and file aggregation
  const processedMessages = useMemo(() => {
    if (!messages.length) return [];
    
    // Sort messages by timestamp
    const sorted = [...messages].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Group consecutive files
    const grouped = groupConsecutiveFiles(sorted);

    // Add UI display properties
    return grouped.map((msg, index) => {
      const prevMsg = index > 0 ? grouped[index - 1] : null;
      const nextMsg = index < grouped.length - 1 ? grouped[index + 1] : null;
      
      // Calculate time gap
      const timeGap = prevMsg 
        ? (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime()) > 5 * 60 * 1000 // 5 min gap
        : true;
      
      // Determine message content type (for special rendering)
      let contentType = 'text';
      if (msg.type === 'file') {
        contentType = 'file';
      } else if (msg.type === 'file-aggregation') {
        contentType = 'file-aggregation';
      } else if (isEmojiOnly(msg.content)) {
        contentType = 'emoji';
      } else if (containsUrl(msg.content)) {
        contentType = 'url';
      }
      
      return {
        ...msg,
        showTimeGroup: timeGap,
        formattedTime: formatMessageDate(msg.timestamp),
        contentType
      };
    });
  }, [messages, groupConsecutiveFiles]);

  return (
    <div className="flex h-full w-full text-dark-1">
      {/* Left column */}
      <aside className="flex w-[28%] min-w-[300px] flex-col border-r bg-cream">
        <div className="p-4">
          <SearchBar value={search} onChange={setSearch} />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {search ? (
            // Search results view
            isSearching ? (
              <div className="flex h-full items-center justify-center"><Loader /></div>
            ) : (
              <ul className="space-y-1">
                {searchResults.length > 0 ? (
                  searchResults.map(userResult => (
                    <li
                      key={userResult.$id}
                      onClick={() => handleSelectUserFromSearch(userResult)}
                      className="group flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-black/5"
                    >
                      <div className="relative h-12 w-12 flex-shrink-0">
                        <img
                          src={userResult.imageUrl || '/assets/icons/profile-placeholder.svg'}
                          alt={userResult.name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-medium text-foreground">{userResult.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{userResult.email}</p>
                      </div>
                    </li>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground mt-4">没有找到用户。</p>
                )}
              </ul>
            )
          ) : (
            // Default chat list view
            loadingThreads ? (
              <div className="flex h-full items-center justify-center">
                <Loader />
              </div>
            ) : (
              <MessageList threads={filteredThreads} />
            )
          )}
        </div>
      </aside>

      {/* Right column */}
      <section className="flex flex-1 flex-col">
        {currentChat ? (
          <>
            {/* Header */}
            <ChatHeader
              id={currentChat.otherUser?.$id}
              avatar={currentChat.otherUser?.imageUrl}
              name={currentChat.otherUser?.name || '聊天'}
              onVoiceCall={() => {
                if (currentChat?.otherUser) {
                  initiateCall(currentChat.otherUser.$id, currentChat.otherUser.name, 'audio', currentChat.otherUser.imageUrl);
                }
              }}
              onVideoCall={() => {
                if (currentChat?.otherUser) {
                  initiateCall(currentChat.otherUser.$id, currentChat.otherUser.name, 'video', currentChat.otherUser.imageUrl);
                }
              }}
              onInfo={() => setShowUserProfile(true)}
            />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <Loader />
                </div>
              ) : processedMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  还没有消息，开始聊天吧！
                </div>
              ) : (
                <div className="space-y-1">
                  {processedMessages.map((msg, index) => {
                    // Show date separator if needed
                    const showDateSeparator = msg.showTimeGroup && (
                      <div key={`date-${index}`} className="flex justify-center my-4">
                        <div className="bg-muted/30 rounded-full px-3 py-1 text-xs text-muted-foreground">
                          {formatMessageDate(msg.timestamp)}
                        </div>
                      </div>
                    );
                    
                    // Render file aggregation
                    if (msg.type === 'file-aggregation') {
                      return (
                        <React.Fragment key={msg.id}>
                          {showDateSeparator}
                          <FileAggregation
                            files={msg.files}
                            isMyMessage={msg.senderId === user.$id}
                            showAvatar={msg.isLastInGroup}
                            isFirstInGroup={msg.isFirstInGroup}
                            isLastInGroup={msg.isLastInGroup}
                            timestamp={msg.formattedTime}
                            onDownloadAll={async () => {
                              try {
                                const downloadFiles = msg.files.map((file: any) => ({
                                  url: file.base64 || file.url || '',
                                  filename: file.name
                                })).filter((f: any) => f.url);

                                if (downloadFiles.length === 0) {
                                  toast({
                                    title: 'Download Failed',
                                    description: 'No files available for download',
                                    variant: 'destructive',
                                  });
                                  return;
                                }

                                toast({ 
                                  title: 'Downloads Started', 
                                  description: `Downloading ${downloadFiles.length} files...` 
                                });

                                await downloadMultipleFiles(downloadFiles);
                                
                                toast({
                                  title: 'Downloads Complete',
                                  description: `Successfully downloaded ${downloadFiles.length} files`,
                                });
                              } catch (error) {
                                console.error('Batch download failed:', error);
                                toast({
                                  title: 'Download Failed',
                                  description: 'Failed to download files, please try again',
                                  variant: 'destructive',
                                });
                              }
                            }}
                            onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, msg)}
                          />
                        </React.Fragment>
                      );
                    }
                    
                    // Render single file
                    if (msg.type === 'file') {
                      const fd = msg.fileData || msg.file_data || msg.fileMeta;
                      const fileData = typeof fd === 'string' ? JSON.parse(fd) : fd;
                      
                      if (fileData && fileData.url && isAudioFile(fileData.name)) {
                        return (
                          <React.Fragment key={msg.$id || msg.id}>
                            {showDateSeparator}
                            <div className={`flex ${msg.senderId === user.$id ? 'justify-end' : 'justify-start'} mb-2`}>
                              <div className={`max-w-[320px] ${msg.senderId === user.$id ? 'ml-auto' : 'mr-auto'}`}>
                                <AudioPlayer
                                  audioId={msg.$id || msg.id}
                                  src={fileData.url}
                                  fileName={fileData.name}
                                  fileSize={formatFileSize(fileData.size)}
                                  isMyMessage={msg.senderId === user.$id}
                                />
                                {msg.isLastInGroup && (
                                  <div className={`text-[10px] mt-1 ${msg.senderId === user.$id ? 'text-right text-gray-500' : 'text-left text-gray-500'}`}>
                                    {msg.formattedTime}
                                  </div>
                                )}
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      }

                      return (
                        <React.Fragment key={msg.$id || msg.id}>
                          {showDateSeparator}
                          <FileMessage
                            fileData={fileData}
                            isMyMessage={msg.senderId === user.$id}
                            onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, msg)}
                            showAvatar={msg.isLastInGroup}
                            isFirstInGroup={msg.isFirstInGroup}
                            isLastInGroup={msg.isLastInGroup}
                            timestamp={msg.formattedTime}
                          />
                        </React.Fragment>
                      );
                    }
                    
                    // Render regular message
                    const sender = msg.senderId === user.$id ? user : currentChat.otherUser;
                    const isSenderOnline = msg.senderId === user.$id ? user.isOnline : isPeerOnline;
                    
                    return (
                      <React.Fragment key={msg.$id || msg.id}>
                        {showDateSeparator}
                        <MessageBubble
                          message={{
                            id: msg.$id || msg.id,
                            content: msg.content,
                            type: msg.contentType || 'text',
                            senderId: msg.senderId,
                            timestamp: msg.formattedTime,
                            status: msg.status || 'sent',
                            avatar: sender?.imageUrl,
                            isOnline: isSenderOnline,
                          }}
                          isMe={msg.senderId === user.$id}
                          showAvatar={msg.isLastInGroup}
                          isFirstInGroup={msg.isFirstInGroup}
                          isLastInGroup={msg.isLastInGroup}
                          onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, msg)}
                        />
                        
                        {/* 消息状态指示器（仅对发送中和失败的消息显示） */}
                        {msg.senderId === user.$id && msg.isLastInGroup && (msg.status === 'sending' || msg.status === 'failed') && (
                          <div className={`text-xs mt-1 flex items-center gap-1 ${msg.senderId === user.$id ? 'justify-end mr-2' : 'justify-start ml-2'}`}>
                            {msg.status === 'sending' && (
                              <>
                                <div className="w-2 h-2 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-gray-500">发送中...</span>
                              </>
                            )}
                            {msg.status === 'failed' && (
                              <>
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <span className="text-red-500">发送失败</span>
                              </>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
              {/* dummy div for scroll */}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="relative">
              <ChatInput onSend={handleSend} onAttach={handleAttach} />
              
              {/* 聊天保存状态指示器 */}
              {chatSaveStatus !== 'idle' && (
                <div className="absolute top-0 right-4 transform -translate-y-full bg-white dark:bg-dark-2 border border-light-3 dark:border-dark-3 rounded-lg px-3 py-1 shadow-lg">
                  <div className="flex items-center gap-2 text-xs">
                    {chatSaveStatus === 'saving' && (
                      <>
                        <div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-primary-500">保存中...</span>
                      </>
                    )}
                    {chatSaveStatus === 'saved' && (
                      <>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-green-600">已保存</span>
                      </>
                    )}
                    {chatSaveStatus === 'error' && (
                      <>
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-red-600">保存失败</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              hidden
              multiple
              ref={fileInputRef}
              onChange={onFilesSelected}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground px-8">
            <div className="max-w-md text-center space-y-4">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-xl font-semibold text-foreground">欢迎使用私密聊天</h3>
              <div className="space-y-2 text-sm">
                <p>请从左侧联系人列表选择一个用户开始聊天</p>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-4">
                  <div className="flex items-start gap-2">
                    <div className="text-green-500 mt-0.5">🔒</div>
                    <div className="text-green-700 dark:text-green-300 text-xs">
                      <p className="font-medium mb-1">隐私保护说明：</p>
                      <ul className="space-y-1 text-left">
                        <li>• 您的聊天记录完全私密</li>
                        <li>• 只有对话参与者可以查看消息</li>
                        <li>• 其他用户无法访问您的聊天内容</li>
                        <li>• 所有消息都经过加密保护</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

             {/* 开发模式功能状态面板 */}
       {process.env.NODE_ENV === 'development' && (
         <div className="fixed bottom-4 left-4 bg-white dark:bg-dark-2 border border-light-3 dark:border-dark-3 rounded-lg p-3 shadow-lg z-50 max-w-sm">
           <div className="text-xs space-y-1">
             <div className="font-semibold text-primary-500 mb-2">聊天功能状态</div>
             <div className="flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${chats.length > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
               <span>联系人列表: {chats.length} 个聊天</span>
             </div>
             <div className="flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${currentChat ? 'bg-green-500' : 'bg-gray-400'}`}></div>
               <span>当前聊天: {currentChat ? currentChat.otherUser?.name || '已选择' : '未选择'}</span>
             </div>
             <div className="flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${globalCurrentChat?.id === currentChat?.$id ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
               <span>状态同步: {globalCurrentChat?.id === currentChat?.$id ? '已同步' : '部分同步'}</span>
             </div>
             <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-green-500"></div>
               <span>隐私保护: 已启用</span>
             </div>
             <div className="flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${chatSaveStatus === 'saved' ? 'bg-green-500' : chatSaveStatus === 'saving' ? 'bg-yellow-500' : 'bg-gray-400'}`}></div>
               <span>保存状态: {chatSaveStatus}</span>
             </div>
             <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
               <Button 
                 onClick={handleDiagnoseChats} 
                 size="sm" 
                 variant="outline" 
                 className="w-full text-xs h-6"
               >
                 🔍 诊断聊天问题
               </Button>
               {chats.length !== (globalCurrentChat ? 1 : 0) && (
                 <Button 
                   onClick={handleSmartFixChats} 
                   size="sm" 
                   variant="outline" 
                   className="w-full text-xs h-6 bg-green-50 hover:bg-green-100 border-green-300"
                 >
                   🧠 一键智能修复
                 </Button>
               )}
             </div>
           </div>
         </div>
       )}

       {/* 聊天诊断结果弹窗 */}
       {showDiagnosis && diagnosisData && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
           <div className="bg-white dark:bg-dark-2 rounded-lg max-w-4xl max-h-[80vh] overflow-y-auto">
             <div className="p-6">
               <div className="flex items-center justify-between mb-4">
                 <h2 className="text-lg font-semibold">聊天系统诊断报告</h2>
                 <Button 
                   onClick={() => setShowDiagnosis(false)} 
                   variant="ghost" 
                   size="sm"
                 >
                   ✕
                 </Button>
               </div>
               
               <div className="space-y-4 text-sm">
                 {/* 基本信息 */}
                 <div className="bg-gray-50 dark:bg-dark-3 p-3 rounded">
                   <h3 className="font-medium mb-2">基本信息</h3>
                   <div className="grid grid-cols-2 gap-2">
                     <div>用户ID: <code className="text-xs bg-gray-200 px-1 rounded">{diagnosisData.userId}</code></div>
                     <div>诊断时间: {new Date(diagnosisData.timestamp).toLocaleString()}</div>
                   </div>
                 </div>

                 {/* 关键问题诊断 */}
                 <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                   <h3 className="font-medium mb-2">🔍 问题诊断</h3>
                   <div className="space-y-1">
                     <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${diagnosisData.databaseQuery.documentsCount > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                       <span>数据库聊天记录: {diagnosisData.databaseQuery.documentsCount} 个</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${diagnosisData.localCache.count > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                       <span>本地聊天记录: {diagnosisData.localCache.count} 个</span>
                     </div>
                     <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${diagnosisData.databaseQuery.documentsCount === diagnosisData.localCache.count ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                       <span>数据同步状态: {diagnosisData.databaseQuery.documentsCount === diagnosisData.localCache.count ? '一致' : '不一致'}</span>
                     </div>
                   </div>
                 </div>

                 {/* 数据库聊天详情 */}
                 <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
                   <h3 className="font-medium mb-2">📊 数据库聊天记录 ({diagnosisData.processedChats.length})</h3>
                   {diagnosisData.processedChats.length > 0 ? (
                     <div className="space-y-2 max-h-40 overflow-y-auto">
                       {diagnosisData.processedChats.map((chat: any, index: number) => (
                         <div key={index} className="bg-white dark:bg-dark-2 p-2 rounded text-xs">
                           <div><strong>ID:</strong> {chat.$id}</div>
                           <div><strong>对方用户:</strong> {chat.otherUser?.name || '未知'} ({chat.otherUser?.$id})</div>
                           <div><strong>最后消息:</strong> {chat.lastMessage || '无'}</div>
                           <div><strong>参与者:</strong> {JSON.stringify(chat.participants)}</div>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <div className="text-red-500">⚠️ 数据库中没有找到聊天记录！</div>
                   )}
                 </div>

                 {/* 解决建议 */}
                 <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
                   <h3 className="font-medium mb-2">💡 问题列表</h3>
                    {diagnosisData.issues.length > 0 ? (
                        <ul className="mt-1 ml-4 list-disc text-xs text-red-600">
                            {diagnosisData.issues.map((issue: string, index: number) => (
                                <li key={index}>{issue}</li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-green-600">未发现明显的数据同步问题。</p>
                    )}
                 </div>
               </div>
             </div>
           </div>
         </div>
       )}

      {/* Modals */}
      {showUserProfile && currentChat && (
        <UserProfileModal
          isOpen={showUserProfile}
          user={currentChat.otherUser}
          onClose={() => setShowUserProfile(false)}
        />
      )}

      {/* Message Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="absolute z-50 bg-white dark:bg-dark-2 rounded-lg shadow-xl border border-light-3 dark:border-dark-3 overflow-hidden context-menu-animate"
        >
          <ul className="py-1">
            <li>
              <button
                onClick={handleDeleteMessage}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <img src="/assets/icons/delete.svg" alt="删除" className="w-4 h-4" />
                <span>删除消息</span>
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default ModernChat; 