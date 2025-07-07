import React, { useState, useEffect } from 'react';
import { Phone, Video, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { client, appwriteConfig } from '@/lib/appwrite/config';
import { getUserOnlineStatus } from '@/lib/appwrite/api';

interface ChatHeaderProps {
  id: string;
  avatar?: string | null;
  name: string;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onInfo?: () => void;
  className?: string;
  isGroup?: boolean;
  memberCount?: number;
}

const IconButton: React.FC<{ icon: React.ElementType; onClick?: () => void; label: string }> = ({ icon: Icon, onClick, label }) => (
  <Button variant="ghost" size="icon" className="h-9 w-9 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg" onClick={onClick} aria-label={label}>
    <Icon className="h-5 w-5 text-muted-foreground" />
  </Button>
);

const ChatHeader: React.FC<ChatHeaderProps> = ({ id, avatar, name, onVoiceCall, onVideoCall, onInfo, className, isGroup, memberCount }) => {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!id || isGroup) return; // 群组聊天不需要在线状态

    let unsubscribe: () => void;

    const fetchAndSubscribe = async () => {
      try {
        // 1. Fetch initial status
        const initialStatus = await getUserOnlineStatus(id);
        setIsOnline(initialStatus?.isOnline || false);

        // 2. Subscribe to real-time updates
        const documentId = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.userCollectionId}.documents.${id}`;
        unsubscribe = client.subscribe(documentId, (response) => {
          const updatedUser = response.payload as any;
          if (typeof updatedUser.isOnline === 'boolean') {
            setIsOnline(updatedUser.isOnline);
          }
        });
      } catch (error) {
        // 静默处理错误
      }
    };

    fetchAndSubscribe();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [id, isGroup]);

  return (
    <header className={cn('flex items-center justify-between border-b bg-background/60 px-6 py-3 backdrop-blur', className)}>
      <div 
        className="flex items-center gap-3 cursor-pointer hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 dark:hover:from-gray-800 dark:hover:to-gray-700 rounded-lg p-2 -m-2 transition-all duration-200"
        onClick={onInfo}
      >
        <div className="relative">
          {isGroup ? (
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              {avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
                </svg>
              )}
            </div>
          ) : (
            <>
              <img
                src={avatar || '/assets/icons/profile-placeholder.svg'}
                alt={name}
                className="h-9 w-9 rounded-full object-cover ring-2 ring-gray-200 dark:ring-gray-600"
              />
              <div
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                  isOnline ? 'bg-green-500' : 'bg-gray-400'
                }`}
              ></div>
            </>
          )}
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{name}</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {isGroup 
              ? `${memberCount || 0} 位成员` 
              : (isOnline ? '在线' : '离线')
            }
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <IconButton icon={Phone} onClick={onVoiceCall} label={isGroup ? "群组语音通话" : "语音通话"} />
        <IconButton icon={Video} onClick={onVideoCall} label={isGroup ? "群组视频通话" : "视频通话"} />
        <IconButton icon={Info} onClick={onInfo} label={isGroup ? "群组信息" : "关于此人"} />
      </div>
    </header>
  );
};

export default ChatHeader; 