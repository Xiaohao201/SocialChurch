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
}

const IconButton: React.FC<{ icon: React.ElementType; onClick?: () => void; label: string }> = ({ icon: Icon, onClick, label }) => (
  <Button variant="ghost" size="icon" className="h-9 w-9 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg" onClick={onClick} aria-label={label}>
    <Icon className="h-5 w-5 text-muted-foreground" />
  </Button>
);

const ChatHeader: React.FC<ChatHeaderProps> = ({ id, avatar, name, onVoiceCall, onVideoCall, onInfo, className }) => {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!id) return;

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
        console.error(`Failed to fetch/subscribe to user ${id} status:`, error);
      }
    };

    fetchAndSubscribe();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [id]);

  return (
    <header className={cn('flex items-center justify-between border-b bg-background/60 px-6 py-3 backdrop-blur', className)}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <img
            src={avatar || '/assets/icons/profile-placeholder.svg'}
            alt={name}
            className="h-9 w-9 rounded-full object-cover"
          />
          <div
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
              isOnline ? 'bg-green-500' : 'bg-gray-400'
            }`}
          ></div>
        </div>
        <h2 className="text-lg font-semibold text-foreground">{name}</h2>
      </div>
      <div className="flex items-center gap-1">
        <IconButton icon={Phone} onClick={onVoiceCall} label="语音通话" />
        <IconButton icon={Video} onClick={onVideoCall} label="视频通话" />
        <IconButton icon={Info} onClick={onInfo} label="关于此人" />
      </div>
    </header>
  );
};

export default ChatHeader; 