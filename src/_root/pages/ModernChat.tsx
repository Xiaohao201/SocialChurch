import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useUserContext } from '@/context/AuthContext';
import SearchBar from '@/components/chat/SearchBar';
import MessageList, { MessageThread } from '@/components/chat/MessageList';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatInput from '@/components/chat/ChatInput';
import MessageBubble from '@/components/shared/MessageBubble';
import Loader from '@/components/shared/Loader';
import { getUserChats, getChatMessages, sendMessage, uploadFile, getFilePreview, getUserOnlineStatus, searchUsers, getOrCreateChat, deleteMessage } from '@/lib/appwrite/api';
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

const ModernChat: React.FC = () => {
  const { user } = useUserContext();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [chats, setChats] = useState<any[]>([]);
  const [onlineStatusMap, setOnlineStatusMap] = useState<Map<string, boolean>>(new Map());
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const [currentChat, setCurrentChat] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isPeerOnline, setIsPeerOnline] = useState(false);

  // Context menu for messages
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: any } | null>(null);

  // Voice / Video / Info modal states
  const [showAudioCall, setShowAudioCall] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);

  // Hidden file input for attachments
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Ref to bottom of message list for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  // Effect 1: Fetch raw chat list
  useEffect(() => {
    if (!user.$id) return;
    setLoadingThreads(true);
    getUserChats(user.$id)
      .then(setChats)
      .catch(e => {
        console.error("Failed to load chats:", e);
        toast({ title: '加载失败', description: '无法加载聊天列表', variant: 'destructive' });
      })
      .finally(() => setLoadingThreads(false));
  }, [user.$id, toast]);

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

  // Effect 3: Derive UI threads from raw data and status map
  useEffect(() => {
    const mapped: MessageThread[] = chats.map((c: any) => ({
      id: c.$id,
      name: c.otherUser?.name || '未知用户',
      avatar: c.otherUser?.imageUrl,
      preview: c.lastMessage,
      isOnline: onlineStatusMap.get(c.otherUser?.$id) ?? false,
      unread: false,
      selected: currentChat?.$id === c.$id,
      onClick: () => selectChat(c),
      otherUser: c.otherUser,
    }));
    setThreads(mapped);
  }, [chats, onlineStatusMap, currentChat?.$id]);

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

  // 选中聊天
  const selectChat = async (chat: any) => {
    setCurrentChat(chat);
    // 标记选中状态
    setThreads((prev) =>
      prev.map((t) => ({ ...t, selected: t.id === chat.$id }))
    );

    setLoadingMessages(true);
    try {
      const msgs = await getChatMessages(chat.$id, 100);
      setMessages(msgs);
    } catch (e) {
      console.error(e);
      toast({ title: '加载失败', description: '无法加载消息', variant: 'destructive' });
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectUserFromSearch = async (searchedUser: any) => {
    setSearch('');
    setSearchResults([]);
    setCurrentChat(null);
    setLoadingMessages(true);

    try {
        const chatDoc = await getOrCreateChat(user.$id, searchedUser.$id);
        
        const chatObject = {
            ...chatDoc,
            otherUser: searchedUser,
        };

        await selectChat(chatObject);
        
        getUserChats(user.$id).then(setChats);
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
    try {
      await sendMessage(currentChat.$id, user.$id, text, 'text');
      const newMsg = {
        $id: Date.now().toString(),
        senderId: user.$id,
        content: text,
        type: 'text',
        timestamp: new Date().toISOString(),
        status: 'sent',
      };
      setMessages((prev) => [...prev, newMsg]);
    } catch (e) {
      console.error(e);
      toast({ title: '发送失败', description: '无法发送消息', variant: 'destructive' });
    }
  };

  // 附件点击
  const handleAttach = (type: AttachmentType) => {
    if (type === 'location') {
      if (!navigator.geolocation) {
        toast({ title: '定位失败', description: '浏览器不支持地理定位', variant: 'destructive' });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          handleSend(`[位置] https://maps.google.com/?q=${latitude},${longitude}`);
        },
        () => toast({ title: '定位失败', description: '无法获取位置', variant: 'destructive' })
      );
    } else {
      // trigger hidden file input
      if (fileInputRef.current) {
        fileInputRef.current.accept = type === 'media' ? 'image/*,video/*' : '*/*';
        fileInputRef.current.click();
      }
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
      await deleteMessage(currentChat.$id, message.$id);
      setMessages((prevMessages) =>
        prevMessages.filter((m) => m.$id !== message.$id)
      );
    } catch (error) {
      console.error("Failed to delete message:", error);
    } finally {
      setContextMenu(null);
    }
  };

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
              onVoiceCall={() => setShowAudioCall(true)}
              onVideoCall={() => setShowVideoCall(true)}
              onInfo={() => setShowUserProfile(true)}
            />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <Loader />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  还没有消息，开始聊天吧！
                </div>
              ) : (
                messages.map((msg) => {
                  if (msg.type === 'file') {
                    const fd = msg.fileData || msg.file_data || msg.fileMeta;
                    const fileData = typeof fd === 'string' ? JSON.parse(fd) : fd;
                    return (
                      <FileMessage
                        key={msg.$id || msg.id}
                        fileData={fileData}
                        isMyMessage={msg.senderId === user.$id}
                        onContextMenu={(e) => handleContextMenu(e, msg)}
                      />
                    );
                  }
                  const sender = msg.senderId === user.$id ? user : currentChat.otherUser;
                  const isSenderOnline = msg.senderId === user.$id ? user.isOnline : isPeerOnline;
                  return (
                    <MessageBubble
                      key={msg.$id || msg.id}
                      message={{
                        id: msg.$id || msg.id,
                        content: msg.content,
                        type: msg.type || 'text',
                        senderId: msg.senderId,
                        timestamp: new Date(msg.timestamp),
                        status: msg.status || 'sent',
                        avatar: sender?.imageUrl,
                        isOnline: isSenderOnline,
                      }}
                      isMe={msg.senderId === user.$id}
                      onContextMenu={(e) => handleContextMenu(e, msg)}
                    />
                  );
                })
              )}
              {/* dummy div for scroll */}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <ChatInput onSend={handleSend} onAttach={handleAttach} />

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
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            请选择一个聊天
          </div>
        )}
      </section>

      {/* Modals */}
      {showAudioCall && currentChat && (
        <ImprovedVoiceCallModal
          isOpen={showAudioCall}
          onClose={() => setShowAudioCall(false)}
          targetUser={{
            id: currentChat.otherUser?.$id || '',
            name: currentChat.otherUser?.name || '',
            avatar: currentChat.otherUser?.imageUrl,
          }}
          mode="outgoing"
        />
      )}

      {showVideoCall && currentChat && (
        <VideoCallModal
          isOpen={showVideoCall}
          onClose={() => setShowVideoCall(false)}
          targetUser={currentChat.otherUser}
          mode="outgoing"
        />
      )}

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