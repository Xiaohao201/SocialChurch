import React from 'react';
import { cn } from '@/lib/utils';

export interface MessageThread {
  id: string;
  name: string;
  avatar?: string | null;
  preview?: string | null;
  unread?: boolean;
  selected?: boolean;
  isOnline?: boolean;
  onClick?: () => void;
  otherUser?: any;
}

interface MessageListProps {
  threads: MessageThread[];
  className?: string;
}

/**
 * Vertical list of message threads for the left sidebar.
 */
const MessageList: React.FC<MessageListProps> = ({ threads, className }) => {
  return (
    <ul className={cn('space-y-1', className)}>
      {threads.map((t) => (
        <li
          key={t.id}
          onClick={t.onClick}
          className={cn(
            'group flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 transition-colors',
            t.selected ? 'bg-accent-blue/10' : 'hover:bg-black/5',
          )}
        >
          <div className="relative h-12 w-12 flex-shrink-0">
            <img
              src={t.avatar || '/assets/icons/profile-placeholder.svg'}
              alt={t.name}
              className="h-full w-full rounded-full object-cover"
            />
            <div
              className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
                t.isOnline ? 'bg-green-500' : 'bg-gray-400'
              }`}
            ></div>
          </div>
          <div className="min-w-0 flex-1 group-hover:text-warm-gold">
            <p className={cn('truncate text-base', t.unread ? 'font-semibold text-foreground' : 'font-medium text-foreground')}>{t.name}</p>
            {t.preview && (
              <p className="truncate text-sm text-muted-foreground">{t.preview}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

export default MessageList; 