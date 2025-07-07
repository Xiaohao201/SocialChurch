import { useState } from 'react';
import { IUserWithFriendship } from '@/types';
import { Button } from '@/components/ui/button';
import { onlineStatusService } from '@/lib/webrtc/onlineStatusService';
import { getMinistryName } from '@/lib/utils';

interface UserPreviewCardProps {
  user: IUserWithFriendship;
  onViewProfile: (user: IUserWithFriendship) => void;
  onSendFriendRequest: (user: IUserWithFriendship) => void;
  onStartChat?: (userId: string) => void;
  isSending?: boolean;
  compact?: boolean;
}

const UserPreviewCard = ({
  user,
  onViewProfile,
  onSendFriendRequest,
  onStartChat,
  isSending = false,
  compact = false
}: UserPreviewCardProps) => {
  const [showPreview, setShowPreview] = useState(false);

  // 获取用户在线状态
  const getUserOnlineStatus = (userId: string) => {
    const isOnline = onlineStatusService.isUserOnline(userId);
    return {
      isOnline,
      indicator: isOnline ? 'bg-green-500' : 'bg-gray-500',
      text: isOnline ? '在线' : '离线',
      textColor: isOnline ? 'text-green-400' : 'text-gray-400'
    };
  };

  const status = getUserOnlineStatus(user.$id);

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-lg bg-dark-4 hover:bg-dark-3 cursor-pointer transition-all border border-dark-4 hover:border-primary-500/30 group"
        onClick={() => onViewProfile(user)}
      >
        <div className="relative">
          <img
            src={user.imageUrl || "/assets/icons/profile-placeholder.svg"}
            alt={user.name}
            className="w-10 h-10 rounded-full object-cover border-2 border-dark-4 group-hover:border-primary-500 transition-colors"
          />
          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 ${status.indicator} rounded-full border border-dark-4`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-light-1 text-sm font-medium truncate group-hover:text-primary-500 transition-colors">
            {user.name}
          </h4>
          <p className="text-light-4 text-xs truncate">
            {getMinistryName(user.ministry)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onViewProfile(user);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          👁️
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className="flex items-center gap-3 p-4 rounded-lg bg-dark-4 cursor-pointer hover:bg-dark-2 transition-all border border-dark-4 hover:border-primary-500/30 group relative"
        onMouseEnter={() => setShowPreview(true)}
        onMouseLeave={() => setShowPreview(false)}
        onClick={() => onViewProfile(user)}
        title={`点击查看 ${user.name} 的详细信息`}
      >
        {/* 查看提示图标 */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-primary-500/20 rounded-full p-1">
            <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
        </div>

        <div className="relative">
          <img
            src={user.imageUrl || "/assets/icons/profile-placeholder.svg"}
            alt={user.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-dark-4 group-hover:border-primary-500 transition-colors"
          />
          {/* 在线状态指示器 */}
          <span className={`absolute bottom-0 right-0 w-3 h-3 ${status.indicator} rounded-full border-2 border-dark-4`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-light-1 text-sm font-medium truncate group-hover:text-primary-500 transition-colors">
              {user.name}
            </h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${status.textColor} bg-dark-3 border border-current`}>
              {status.text}
            </span>
          </div>
          <p className="text-light-3 text-xs truncate">
            📋 {getMinistryName(user.ministry)}
          </p>
          {user.gender && (
            <p className="text-light-4 text-xs">
              {user.gender === 'male' ? '👨 弟兄' : user.gender === 'female' ? '👩 姐妹' : '👤'}
            </p>
          )}
          {/* 悬停提示 */}
          <p className="text-primary-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity mt-1">
            👆 点击查看详细信息
          </p>
        </div>
        
        <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
          {user.isFriend ? (
            <div className="space-y-1">
              <span className="text-green-400 text-xs text-center bg-green-500/20 px-2 py-1 rounded-full border border-green-500/50 block">
                ✅ 已是好友
              </span>
              {onStartChat && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartChat(user.$id);
                  }}
                  className="text-xs px-3 py-1 h-auto bg-blue-500/20 border-blue-500/50 text-blue-400 hover:bg-blue-500/30 hover:text-blue-300 w-full"
                  title="开始聊天"
                >
                  💬 聊天
                </Button>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSendFriendRequest(user);
              }}
              disabled={isSending}
              className="text-xs px-3 py-1 h-auto bg-primary-500/20 border-primary-500/50 text-primary-400 hover:bg-primary-500/30 hover:text-primary-300 disabled:opacity-50"
              title="快速发送好友请求"
            >
              {isSending ? '发送中...' : '➕ 加好友'}
            </Button>
          )}
        </div>
      </div>

      {/* 悬停预览卡片 */}
      {showPreview && (
        <div className="absolute left-full top-0 ml-2 z-50 w-72 bg-dark-2 border border-dark-3 rounded-lg shadow-xl p-4 pointer-events-none">
          <div className="flex items-center gap-3 mb-3">
            <img
              src={user.imageUrl || "/assets/icons/profile-placeholder.svg"}
              alt={user.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-primary-500/30"
            />
            <div>
              <h3 className="text-light-1 font-semibold">{user.name}</h3>
              <p className="text-light-3 text-sm">{getMinistryName(user.ministry)}</p>
              <p className={`text-xs ${status.textColor}`}>{status.text}</p>
            </div>
          </div>
          
          {user.email && (
            <div className="mb-2">
              <span className="text-light-4 text-xs">📧 {user.email}</span>
            </div>
          )}
          
          {user.faithTestimony && (
            <div>
              <h4 className="text-light-2 text-sm font-medium mb-1">信仰见证</h4>
              <p className="text-light-3 text-xs leading-relaxed line-clamp-3">
                {user.faithTestimony}
              </p>
            </div>
          )}
          
          {!user.faithTestimony && (
            <p className="text-light-4 text-xs">点击查看更多详细信息</p>
          )}
        </div>
      )}
    </div>
  );
};

export default UserPreviewCard; 