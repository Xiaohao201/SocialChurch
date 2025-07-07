import React from 'react';
import { Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DisappearingMessageDuration } from '@/types';

export interface MessageThread {
  id: string;
  name: string;
  avatar?: string | null;
  preview?: string | null;
  unread: number;
  selected?: boolean;
  isOnline?: boolean;
  onClick?: () => void;
  otherUser?: any;
  disappearingDuration?: DisappearingMessageDuration;
  isGroup?: boolean;
  memberCount?: number;
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
            {t.isGroup ? (
              <div className="h-full w-full rounded-full bg-blue-500 flex items-center justify-center">
                {t.avatar ? (
                  <img
                    src={t.avatar}
                    alt={t.name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <Users className="h-6 w-6 text-white" />
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
            {/* 消息定时清理指示器 */}
            {t.disappearingDuration && t.disappearingDuration !== 'off' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 rounded-full flex items-center justify-center">
                <Clock className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 relative">
            <div className="flex items-center gap-2">
              <p className={cn('truncate text-base', t.unread > 0 ? 'font-semibold text-charcoal' : 'font-medium text-charcoal')}>{t.name}</p>
              {/* 群组成员数量指示器 */}
              {t.isGroup && t.memberCount && (
                <span className="text-xs text-gray-500 flex-shrink-0">({t.memberCount})</span>
              )}
              {/* 消息定时清理文本指示器 */}
              {t.disappearingDuration && t.disappearingDuration !== 'off' && (
                <Clock className="w-3 h-3 text-primary-500 flex-shrink-0" />
              )}
            </div>
            {t.preview && (
              <p className="truncate text-sm text-warm-gray">{t.preview}</p>
            )}
            {t.unread > 0 && (
              <span className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 text-xs flex items-center justify-center bg-notification-red text-white rounded-full">
                {t.unread}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

export default MessageList; 