import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useUserContext } from '@/context/AuthContext';
import SearchBar from '@/components/chat/SearchBar';
import MessageList, { MessageThread } from '@/components/chat/MessageList';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatInput from '@/components/chat/ChatInput';
import MessageBubble from '@/components/shared/MessageBubble';
import Loader from '@/components/shared/Loader';
import { getUserChats, getChatMessages, sendMessage, uploadFile, getFilePreview, getUserOnlineStatus, getOrCreateChat, deleteMessage, getUserById, uploadVoiceMessage, getChatDisappearingSettings, updateChatDisappearingSettings, updateGroupDisappearingSettings } from '@/lib/appwrite/api';
import { useToast } from '@/components/ui/use-toast';
import { AttachmentType } from '@/components/chat/AttachmentMenu';

import UserProfileModal from '@/components/shared/UserProfileModal';
import ChatInfoModal from '@/components/shared/ChatInfoModal';
import GroupInfoModal from '@/components/shared/GroupInfoModal';
import GroupCallMemberSelector from '@/components/shared/GroupCallMemberSelector';
import SystemMessage from '@/components/shared/SystemMessage';
import FileMessage from '@/components/shared/FileMessage';
import { client, appwriteConfig } from '@/lib/appwrite/config';

import FileAggregation from '@/components/shared/FileAggregation';
import { downloadMultipleFiles } from '@/utils/downloadUtils';
import AudioPlayer from '@/components/shared/AudioPlayer';
import { useCall } from '@/context/CallContext';
import { useSearchParams } from 'react-router-dom';
import { useChatContext } from '@/context/ChatContext';
import { Models } from 'appwrite';
import { UIChat } from '@/lib/appwrite/api';
import { DisappearingMessageDuration } from '@/types';
import { messageCleanupService } from '@/utils/messageCleanup';
import VoiceMessage from '@/components/chat/VoiceMessage';

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

// Format message content for preview
const formatMessageForPreview = (message: any) => {
  if (!message) return 'No recent messages';
  
  const content = message.content || '';
  const messageType = message.messageType || message.type || 'text';
  
  // Handle voice messages
  if (messageType === 'voice') {
    return '🎤 语音消息';
  }
  
  // Handle file messages
  if (messageType === 'file') {
    const fileName = content.toLowerCase();
    
    // Check file type by extension
    if (fileName.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/)) {
      return '📷 Photo';
    } else if (fileName.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/)) {
      return '🎥 Video';
    } else if (fileName.match(/\.(mp3|wav|m4a|ogg|flac|aac|wma)$/)) {
      return '🎵 Audio';
    } else if (fileName.match(/\.(pdf)$/)) {
      return '📄 PDF';
    } else if (fileName.match(/\.(doc|docx|txt|rtf)$/)) {
      return '📝 Document';
    } else if (fileName.match(/\.(xls|xlsx|csv)$/)) {
      return '📊 Spreadsheet';
    } else if (fileName.match(/\.(ppt|pptx)$/)) {
      return '📈 Presentation';
    } else if (fileName.match(/\.(zip|rar|7z|tar|gz)$/)) {
      return '📦 Archive';
    } else {
      return '📎 File';
    }
  }
  
  // Handle placeholder/corrupted content - if content is just "text", treat as no meaningful message
  if (content.trim() === 'text') {
    return 'Start a conversation';
  }
  
  // Handle text messages
  if (isEmojiOnly(content)) {
    return content;
  }
  
  if (containsUrl(content)) {
    return '🔗 Shared a link';
  }
  
  // Regular text message - truncate if too long
  const maxLength = 45;
  const truncatedMessage = content.length > maxLength 
    ? content.substring(0, maxLength) + '...' 
    : content;
  
  return truncatedMessage || 'No recent messages';
};

// Format last message preview for conversation list (fallback for database lastMessage)
const formatLastMessagePreview = (lastMessage: string) => {
  if (!lastMessage || lastMessage === 'text') {
    return 'No recent messages';
  }
  
  // Check if the message starts with "Attachment:" (from backend)
  if (lastMessage.startsWith('Attachment:')) {
    const fileName = lastMessage.replace('Attachment: ', '').toLowerCase();
    
    // Check file type by extension
    if (fileName.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/)) {
      return '📷 Photo';
    } else if (fileName.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/)) {
      return '🎥 Video';
    } else if (fileName.match(/\.(mp3|wav|m4a|ogg|flac|aac|wma)$/)) {
      return '🎵 Audio';
    } else if (fileName.match(/\.(pdf)$/)) {
      return '📄 PDF';
    } else if (fileName.match(/\.(doc|docx|txt|rtf)$/)) {
      return '📝 Document';
    } else if (fileName.match(/\.(xls|xlsx|csv)$/)) {
      return '📊 Spreadsheet';
    } else if (fileName.match(/\.(ppt|pptx)$/)) {
      return '📈 Presentation';
    } else if (fileName.match(/\.(zip|rar|7z|tar|gz)$/)) {
      return '📦 Archive';
    } else {
      return '📎 File';
    }
  }
  
  // Handle text messages
  if (isEmojiOnly(lastMessage)) {
    return lastMessage;
  }
  
  if (containsUrl(lastMessage)) {
    return '🔗 Shared a link';
  }
  
  // Regular text message - truncate if too long
  const maxLength = 45;
  const truncatedMessage = lastMessage.length > maxLength 
    ? lastMessage.substring(0, maxLength) + '...' 
    : lastMessage;
  
  return truncatedMessage;
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
  
  const [chats, setChats] = useState<UIChat[]>([]);
  const [onlineStatusMap, setOnlineStatusMap] = useState<Map<string, boolean>>(new Map());
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [chatLastMessages, setChatLastMessages] = useState<Map<string, any>>(new Map());

  const [currentChat, setCurrentChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isPeerOnline, setIsPeerOnline] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // 新增：聊天保存状态指示
  const [chatSaveStatus, setChatSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Voice / Video / Info modal states
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showGroupCallSelector, setShowGroupCallSelector] = useState(false);
  const [groupCallType, setGroupCallType] = useState<'audio' | 'video'>('audio');
  
  // 消息定时清理相关状态
  const [currentDisappearingDuration, setCurrentDisappearingDuration] = useState<DisappearingMessageDuration>('off');

  // Hidden file input for attachments
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Ref to bottom of message list for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const isProcessingVoiceRef = useRef(false);

  // 选中聊天 - 移到前面定义
  const selectChat = useCallback(async (chat: any) => {
    // Reset unread count for this specific chat
    const countToReset = unreadCounts[chat.$id] || 0;
    if (countToReset > 0) {
      resetChatUnreadCount(countToReset);
      setUnreadCounts(prev => ({ ...prev, [chat.$id]: 0 }));
    }
    
    // Clear any active search so the full thread list becomes visible again
    setSearch('');

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

  useEffect(() => {
    // 处理从URL参数启动聊天（支持both 'chat' 和 'with' 参数）
    const friendId = searchParams.get('chat') || searchParams.get('with');
    const groupId = searchParams.get('id'); // 群组聊天ID
    
    if (groupId) {
      // 如果是群组聊天，延迟处理直到chats加载完成
      if (chats.length > 0) {
        const targetGroup = chats.find(chat => chat.$id === groupId && chat.isGroup);
        if (targetGroup) {
          selectChat(targetGroup);
          // Clean up the URL parameters
          searchParams.delete('id');
          setSearchParams(searchParams);
        }
      }
    } else if (friendId) {
      getUserById(friendId).then((friendUser) => {
        if (friendUser) {
          handleSelectUserFromSearch(friendUser);
        }
      }).catch(err => {
        toast({ title: "无法打开聊天", description: "找不到指定的用户。", variant: "destructive" });
      });
      // Clean up the URL parameters
      searchParams.delete('chat');
      searchParams.delete('with');
      searchParams.delete('name');
      searchParams.delete('avatar');
      setSearchParams(searchParams);
    }
  }, [searchParams, user.$id, chats, selectChat]);

  // Effect: 启动消息清理服务
  useEffect(() => {
    if (user?.$id) {
      messageCleanupService.start();
    }

    return () => {
      messageCleanupService.stop();
    };
  }, [user?.$id]);



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



  // Effect 1: Load chats from cache, then fetch from network
  useEffect(() => {
    if (!user?.$id) return;

    const CHATS_CACHE_KEY = `chats_cache_${user.$id}`;
    let isMounted = true;

    const loadAndSyncChats = async () => {
      // 1. Load from cache for instant UI
      try {
        let cachedChats = localStorage.getItem(CHATS_CACHE_KEY);
        
        // 如果当前用户没有缓存，尝试通过邮箱恢复
        if (!cachedChats) {
          const lastUserEmail = localStorage.getItem('last_user_email');
          if (lastUserEmail === user.email) {
            // 查找所有聊天缓存，尝试恢复
            const allKeys = Object.keys(localStorage);
            const chatCacheKeys = allKeys.filter(k => k.startsWith('chats_cache_'));
            
            for (const key of chatCacheKeys) {
              try {
                const data = localStorage.getItem(key);
                if (data) {
                  const parsedChats = JSON.parse(data);
                  if (parsedChats.length > 0) {
                    localStorage.setItem(CHATS_CACHE_KEY, data);
                    cachedChats = data;
                    break;
                  }
                }
              } catch (e) {
                // 静默处理解析错误
              }
            }
          }
        }
        
        if (cachedChats && isMounted) {
          setChats(JSON.parse(cachedChats));
        }
      } catch (error) {
        // 静默处理加载缓存错误
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
      } catch (e: any) {
        toast({ title: 'Loading Failed', description: e.message || 'Could not load chat list.', variant: 'destructive' });
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
    const peerIds = chats.map(chat => chat.otherUser?.$id).filter((id): id is string => Boolean(id));

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
        // 静默处理获取初始在线状态错误
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

    // Effect: Fetch last messages for each chat
  useEffect(() => {
    const fetchLastMessages = async () => {
      const newLastMessages = new Map();
      
      for (const chat of chats) {
        try {
          // Fetch more messages to find the last meaningful one
          const dbMessages = await getChatMessages(chat.$id, 20);
          
          if (dbMessages.length > 0) {
            // Look for the most recent message with meaningful content
            let meaningfulMessage = null;
            
            for (let i = dbMessages.length - 1; i >= 0; i--) {
              const msg = dbMessages[i];
              const content = msg.content?.trim();
              
              // Skip corrupted/placeholder messages
              if (content && 
                  content !== 'text' && 
                  content !== '' &&
                  content !== 'undefined' &&
                  content !== 'null' &&
                  content.length > 0) {
                meaningfulMessage = msg;
                break;
              }
            }
            
            if (meaningfulMessage) {
              newLastMessages.set(chat.$id, meaningfulMessage);
            } else {
              newLastMessages.set(chat.$id, null);
            }
          } else {
            newLastMessages.set(chat.$id, null);
          }
        } catch (error) {
          newLastMessages.set(chat.$id, null);
        }
      }
      
      setChatLastMessages(newLastMessages);
    };

    if (chats.length > 0) {
      fetchLastMessages();
    }
  }, [chats]);

  // Effect: 获取当前聊天的消息定时清理设置
  useEffect(() => {
    if (!currentChat?.$id) {
      setCurrentDisappearingDuration('off');
      return;
    }

    const fetchDisappearingSettings = async () => {
      try {
        const settings = await getChatDisappearingSettings(currentChat.$id);
        setCurrentDisappearingDuration(settings?.duration || 'off');
      } catch (error) {
        setCurrentDisappearingDuration('off');
      }
    };

    fetchDisappearingSettings();
  }, [currentChat?.$id]);

  // Computed: Filter threads based on search
  const filteredThreads = useMemo(() => {
    if (!search.trim()) {
      return threads;
    }
    
    const searchLower = search.toLowerCase();
    return threads.filter(thread => 
      thread.name.toLowerCase().includes(searchLower) ||
      (thread.preview && thread.preview.toLowerCase().includes(searchLower))
    );
  }, [threads, search]);

  // Effect 3: Derive UI threads from raw data and status map
  useEffect(() => {
    const mapped: MessageThread[] = chats.map((c: any) => {
      // 获取消息定时清理设置
      let disappearingDuration: DisappearingMessageDuration = 'off';
      if (c.disappearingMessages) {
        try {
          const settings = typeof c.disappearingMessages === 'string' 
            ? JSON.parse(c.disappearingMessages) 
            : c.disappearingMessages;
          disappearingDuration = settings.duration || 'off';
        } catch (error) {
          // 静默处理解析消失消息设置错误
        }
      }
      // Try to get the actual last message first, fallback to database lastMessage
      const actualLastMessage = chatLastMessages.get(c.$id);
      let preview;
      
      // Check if we have tried to fetch messages for this chat
      if (chatLastMessages.has(c.$id)) {
        // We have tried to fetch - use the result (could be null if no messages)
        if (actualLastMessage) {
          preview = formatMessageForPreview(actualLastMessage);
        } else {
          // We tried but found no meaningful messages
          preview = '';
        }
      } else {
        // We haven't tried to fetch yet - use database fallback but avoid "text"
        if (c.lastMessage && c.lastMessage !== 'text') {
          preview = formatLastMessagePreview(c.lastMessage);
        } else {
          preview = '';
        }
      }
      
              return {
          id: c.$id,
          name: c.isGroup ? (c.name || `群聊(${c.participants?.length || 0})`) : (c.otherUser?.name || 'Unknown User'),
          avatar: c.isGroup ? (c.avatar || null) : c.otherUser?.imageUrl,
          preview: preview,
          isOnline: c.isGroup ? false : (onlineStatusMap.get(c.otherUser?.$id) ?? false),
          unread: unreadCounts[c.$id] || 0,
          // 使用全局状态和本地状态的组合来确定选中状态
          selected: (globalCurrentChat?.id === c.$id) || (currentChat?.$id === c.$id),
          onClick: () => selectChat(c),
          otherUser: c.otherUser,
          disappearingDuration: disappearingDuration,
          isGroup: c.isGroup,
          memberCount: c.participants?.length,
        };
    });
    setThreads(mapped);
  }, [chats, onlineStatusMap, currentChat, globalCurrentChat, unreadCounts, selectChat, chatLastMessages]);

  // Effect: 同步全局状态到本地状态
  useEffect(() => {
    if (globalCurrentChat && !currentChat) {
      // 如果全局状态有值但本地状态没有，尝试从chats中找到对应的chat
      const matchingChat = chats.find(c => c.$id === globalCurrentChat.id);
      if (matchingChat) {
        setCurrentChat(matchingChat);
      }
    }
  }, [globalCurrentChat, currentChat, chats]);

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

          // Update the last message map
          setChatLastMessages(prev => new Map(prev).set(newMessage.chatId, newMessage));

          // Also update the preview text and ordering in the thread list so it reflects in real-time
          setChats(prevChats => {
            const chatToUpdate = prevChats.find(c => c.$id === newMessage.chatId);
            if (!chatToUpdate) return prevChats;
            const otherChats = prevChats.filter(c => c.$id !== newMessage.chatId);
            const lastMessageText = newMessage.messageType === 'file' ? `Attachment: ${newMessage.content}` : newMessage.content;
            const updatedChats = [{ ...chatToUpdate, lastMessage: lastMessageText, lastMessageTime: newMessage.$createdAt }, ...otherChats];
            
            // Save the updated list to cache
            try {
              if (user?.$id) {
                localStorage.setItem(`chats_cache_${user.$id}`, JSON.stringify(updatedChats));
              }
            } catch (error) {
              // 静默处理缓存更新错误
            }

            return updatedChats;
          });

        } else {
          // If the incoming message is for another, inactive chat
          setUnreadCounts(prev => ({ ...prev, [newMessage.chatId]: (prev[newMessage.chatId] || 0) + 1 }));
          incrementTotalUnreadCount();
          
          // Update the last message map for the inactive chat
          setChatLastMessages(prev => new Map(prev).set(newMessage.chatId, newMessage));
          
          // Re-fetch, then update state and cache
          if (user?.$id) {
            const CHATS_CACHE_KEY = `chats_cache_${user.$id}`;
            getUserChats(user.$id).then(freshChats => {
              setChats(freshChats);
              try {
                localStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(freshChats));
              } catch (error) {
                // 静默处理保存聊天到缓存错误
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
    setSearch('');
    setLoadingMessages(true);

    try {
        const chatDoc = await getOrCreateChat(user.$id, searchedUser.$id);

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
    } finally {
        setLoadingMessages(false);
    }
  };

  // 发送文本消息
  const handleSend = async (text: string) => {
    if (!currentChat) return;
    if (!currentChat.isGroup && !currentChat.otherUser?.$id) return;
    
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
        messageType: 'text',
        timestamp: new Date().toISOString(),
        status: 'sending',
      };
      setMessages((prev) => [...prev, newMsg]);
      
      // Update the last message map optimistically
      setChatLastMessages(prev => new Map(prev).set(currentChat.$id, newMsg));

      // Optimistically update the chat list on the left
      setChats(prevChats => {
        const chatToUpdate = prevChats.find(c => c.$id === currentChat.$id);
        if (!chatToUpdate) return prevChats;
        const otherChats = prevChats.filter(c => c.$id !== currentChat.$id);
        const updatedChats = [{...chatToUpdate, lastMessage: text, lastMessageTime: new Date().toISOString()}, ...otherChats];
        
        // Update cache
        try {
          if (user?.$id) {
            localStorage.setItem(`chats_cache_${user.$id}`, JSON.stringify(updatedChats));
          }
        } catch (error) {
          // 静默处理缓存更新错误
        }
        
        return updatedChats;
      });

      // Send the message to the backend
      const receiverId = currentChat.isGroup ? '' : currentChat.otherUser.$id;
      await sendMessage(currentChat.$id, user.$id, receiverId, text, 'text');
      
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

  // 发送语音消息
  const handleSendVoice = async (audioBlob: Blob, duration: number) => {
    if (!currentChat) return;
    if (!currentChat.isGroup && !currentChat.otherUser?.$id) return;
    
    // Prevent duplicate processing
    if (isProcessingVoiceRef.current) {
      return;
    }
    
    isProcessingVoiceRef.current = true;
    
    setChatSaveStatus('saving');
    
    // Generate unique message ID
    const tempMessageId = Date.now().toString();
    
    try {
      // Upload voice message to storage
      const audioFileId = await uploadVoiceMessage(audioBlob, `voice_${tempMessageId}.webm`);
      const audioUrl = getFilePreview(audioFileId);
      
      // Create voice message data
      const voiceData = {
        id: audioFileId,
        name: `voice_${tempMessageId}.webm`,
        size: audioBlob.size,
        type: 'audio/webm',
        url: audioUrl,
        duration: Math.floor(duration / 1000), // Convert to seconds
      };
      
      // Optimistically add the message to the UI
      const newMsg = {
        $id: tempMessageId,
        senderId: user.$id,
        content: `语音消息 (${Math.floor(duration / 1000)}s)`,
        type: 'voice',
        messageType: 'voice',
        voiceData: voiceData,
        timestamp: new Date().toISOString(),
        status: 'sending',
      };
      setMessages((prev) => [...prev, newMsg]);
      
      // Update the last message map optimistically
      setChatLastMessages(prev => new Map(prev).set(currentChat.$id, newMsg));

      // Optimistically update the chat list on the left
      setChats(prevChats => {
        const chatToUpdate = prevChats.find(c => c.$id === currentChat.$id);
        if (!chatToUpdate) return prevChats;
        const otherChats = prevChats.filter(c => c.$id !== currentChat.$id);
        const updatedChats = [{
          ...chatToUpdate, 
          lastMessage: `🎤 语音消息 (${Math.floor(duration / 1000)}s)`, 
          lastMessageTime: new Date().toISOString()
        }, ...otherChats];
        
        // Update cache
        try {
          if (user?.$id) {
            localStorage.setItem(`chats_cache_${user.$id}`, JSON.stringify(updatedChats));
          }
        } catch (error) {
          // 静默处理缓存更新错误
        }
        
        return updatedChats;
      });

      // Send the message to the backend
      const receiverId = currentChat.isGroup ? '' : currentChat.otherUser.$id;
      await sendMessage(
        currentChat.$id, 
        user.$id, 
        receiverId, 
        `语音消息 (${Math.floor(duration / 1000)}s)`, 
        'voice',
        voiceData
      );
      
      setChatSaveStatus('saved');
      
      // Update message status to sent
      setMessages((prev) => 
        prev.map(msg => 
          msg.$id === tempMessageId ? { ...msg, status: 'sent' } : msg
        )
      );
      
      // Reset status after short delay
      setTimeout(() => setChatSaveStatus('idle'), 2000);
      
    } catch (e) {
      setChatSaveStatus('error');
      toast({ 
        title: '发送失败', 
        description: '无法发送语音消息', 
        variant: 'destructive' 
      });
      
      // Mark message as failed
      setMessages((prev) => 
        prev.map(msg => 
          msg.$id === tempMessageId ? { ...msg, status: 'failed' } : msg
        )
      );
      
      setTimeout(() => setChatSaveStatus('idle'), 3000);
    } finally {
      // Always reset the processing flag
      isProcessingVoiceRef.current = false;
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

  // 处理消息定时清理设置变更
  const handleDisappearingDurationChange = async (duration: DisappearingMessageDuration) => {
    if (!currentChat?.$id) return;
    
    try {
      if (currentChat.isGroup) {
        // 使用群组特定的API
        const { updateGroupDisappearingSettings } = await import('@/lib/appwrite/api');
        await updateGroupDisappearingSettings(currentChat.$id, duration, user.$id);
      } else {
        // 使用一对一聊天的API
        await updateChatDisappearingSettings(currentChat.$id, duration, user.$id);
      }
      
      setCurrentDisappearingDuration(duration);
      
      toast({
        title: duration === 'off' ? '已关闭消息定时清理' : '已开启消息定时清理',
        description: duration === 'off' 
          ? '新消息将不会自动删除' 
          : `新消息将在${duration === '1day' ? '1天' : duration === '3days' ? '3天' : duration === '7days' ? '7天' : '30天'}后自动删除`,
      });
    } catch (error) {
      toast({
        title: '设置失败',
        description: currentChat.isGroup ? '只有管理员可以修改群组消息定时清理设置' : '无法更新消息定时清理设置，请重试',
        variant: 'destructive',
      });
    }
  };

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentChat) return;
    if (!currentChat.isGroup && !currentChat.otherUser?.$id) return;
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

        const receiverId = currentChat.isGroup ? '' : currentChat.otherUser.$id;
        await sendMessage(currentChat.$id, user.$id, receiverId, file.name, 'file', fileMeta);
        const newMsg = {
          $id: Date.now().toString() + Math.random(),
          senderId: user.$id,
          content: file.name,
          type: 'file',
          messageType: 'file',
          fileData: fileMeta,
          timestamp: new Date().toISOString(),
          status: 'sent',
        };
        setMessages((prev) => [...prev, newMsg]);
        
        // Update the last message map optimistically
        setChatLastMessages(prev => new Map(prev).set(currentChat.$id, newMsg));
        
        // Update chat list with file message preview (using the same format as backend)
        setChats(prevChats => {
          const chatToUpdate = prevChats.find(c => c.$id === currentChat.$id);
          if (!chatToUpdate) return prevChats;
          const otherChats = prevChats.filter(c => c.$id !== currentChat.$id);
          const updatedChats = [{
            ...chatToUpdate, 
            lastMessage: `Attachment: ${file.name}`, 
            lastMessageTime: new Date().toISOString()
          }, ...otherChats];
          
          // Update cache
          try {
            if (user?.$id) {
              localStorage.setItem(`chats_cache_${user.$id}`, JSON.stringify(updatedChats));
            }
          } catch (error) {
            // 静默处理缓存更新错误
          }
          
          return updatedChats;
        });
      } catch (err) {
        toast({ title: '发送失败', description: '无法发送文件', variant: 'destructive' });
      }
    }
    // 清空输入值，确保下次 change 触发
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Auto scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loadingMessages]);

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
          {/* 只显示过滤后的对话列表，不再显示搜索新用户的功能 */}
          {loadingThreads ? (
            <div className="flex h-full items-center justify-center">
              <Loader />
            </div>
          ) : filteredThreads.length === 0 && search ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <p className="text-sm">没有找到匹配的对话</p>
              <p className="text-xs mt-1">尝试搜索其他联系人姓名</p>
            </div>
          ) : (
            <MessageList threads={filteredThreads} />
          )}
        </div>
      </aside>

      {/* Right column */}
      <section className="flex flex-1 flex-col">
        {currentChat ? (
          <>
            {/* Header */}
            <ChatHeader
              id={currentChat.isGroup ? currentChat.$id : currentChat.otherUser?.$id}
              avatar={currentChat.isGroup ? currentChat.avatar : currentChat.otherUser?.imageUrl}
              name={currentChat.isGroup ? (currentChat.name || `群聊(${currentChat.participants?.length || 0})`) : (currentChat.otherUser?.name || '聊天')}
              isGroup={currentChat.isGroup}
              memberCount={currentChat.participants?.length}
              onVoiceCall={() => {
                if (currentChat.isGroup) {
                  // 群组语音通话 - 显示成员选择界面
                  setGroupCallType('audio');
                  setShowGroupCallSelector(true);
                } else if (currentChat?.otherUser) {
                  initiateCall(currentChat.otherUser.$id, currentChat.otherUser.name, 'audio', currentChat.otherUser.imageUrl);
                }
              }}
              onVideoCall={() => {
                if (currentChat.isGroup) {
                  // 群组视频通话 - 显示成员选择界面
                  setGroupCallType('video');
                  setShowGroupCallSelector(true);
                } else if (currentChat?.otherUser) {
                  initiateCall(currentChat.otherUser.$id, currentChat.otherUser.name, 'video', currentChat.otherUser.imageUrl);
                }
              }}
              onInfo={() => currentChat.isGroup ? setShowGroupInfo(true) : setShowChatInfo(true)}
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
                                toast({
                                  title: 'Download Failed',
                                  description: 'Failed to download files, please try again',
                                  variant: 'destructive',
                                });
                              }
                            }}
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
                            showAvatar={msg.isLastInGroup}
                            isFirstInGroup={msg.isFirstInGroup}
                            isLastInGroup={msg.isLastInGroup}
                            timestamp={msg.formattedTime}
                          />
                        </React.Fragment>
                      );
                    }
                    
                    // Render voice message
                    if (msg.type === 'voice') {
                      const vd = msg.voiceData || msg.voice_data || msg.voiceMeta;
                      const voiceData = typeof vd === 'string' ? JSON.parse(vd) : vd;
                      
                      if (voiceData && voiceData.url) {
                        return (
                          <React.Fragment key={msg.$id || msg.id}>
                            {showDateSeparator}
                            <div className={`flex ${msg.senderId === user.$id ? 'justify-end' : 'justify-start'} mb-2`}>
                              <div className={`max-w-[320px] ${msg.senderId === user.$id ? 'ml-auto' : 'mr-auto'}`}>
                                <VoiceMessage
                                  audioUrl={voiceData.url}
                                  duration={voiceData.duration || 0}
                                  isMyMessage={msg.senderId === user.$id}
                                  isUnread={false} // TODO: Implement unread voice message tracking
                                  onPlay={() => {
                                    // Mark as played if needed
                                  }}
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
                    }
                    
                    // Render system message
                    if (msg.messageType === 'system_disappearing_message' || 
                        msg.messageType === 'system_group_created' ||
                        msg.messageType === 'system_member_added' ||
                        msg.messageType === 'system_member_removed' ||
                        msg.messageType === 'system_member_left') {
                      return (
                        <React.Fragment key={msg.$id || msg.id}>
                          {showDateSeparator}
                          <SystemMessage
                            content={msg.content}
                            timestamp={msg.$createdAt || msg.timestamp}
                            type={msg.messageType}
                            onClick={() => currentChat.isGroup ? setShowGroupInfo(true) : setShowChatInfo(true)}
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
              <ChatInput onSend={handleSend} onSendVoice={handleSendVoice} onAttach={handleAttach} />
              
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
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Modals */}
      {showUserProfile && currentChat && (
        <UserProfileModal
          isOpen={showUserProfile}
          user={currentChat.otherUser}
          onClose={() => setShowUserProfile(false)}
        />
      )}

      {/* Chat Info Modal */}
      {showChatInfo && currentChat && !currentChat.isGroup && (
        <ChatInfoModal
          isOpen={showChatInfo}
          onClose={() => setShowChatInfo(false)}
          user={{
            $id: currentChat.otherUser.$id,
            name: currentChat.otherUser.name,
            imageUrl: currentChat.otherUser.imageUrl,
            isOnline: isPeerOnline,
          }}
          currentDisappearingDuration={currentDisappearingDuration}
          onDisappearingDurationChange={handleDisappearingDurationChange}
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
        />
      )}

      {/* Group Info Modal */}
      {showGroupInfo && currentChat && currentChat.isGroup && (
        <GroupInfoModal
          open={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          groupId={currentChat.$id}
          onGroupLeft={() => {
            setCurrentChat(null);
            setShowGroupInfo(false);
            // 重新加载聊天列表
            if (user?.$id) {
              getUserChats(user.$id).then(setChats);
            }
          }}
          onGroupUpdated={() => {
            // 重新加载聊天列表
            if (user?.$id) {
              getUserChats(user.$id).then(setChats);
            }
          }}
        />
      )}

      {/* Group Call Member Selector */}
      {showGroupCallSelector && currentChat && currentChat.isGroup && (
        <GroupCallMemberSelector
          open={showGroupCallSelector}
          onClose={() => setShowGroupCallSelector(false)}
          groupId={currentChat.$id}
          callType={groupCallType}
          onCallMember={(memberId, memberName, memberAvatar) => {
            initiateCall(memberId, memberName, groupCallType, memberAvatar);
          }}
        />
      )}

      {/* Debug Panel (开发环境) */}

    </div>
  );
};

export default ModernChat; 