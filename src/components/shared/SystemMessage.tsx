import React from 'react';
import { Clock, Settings, Users, UserPlus, UserMinus, Crown } from 'lucide-react';

interface SystemMessageProps {
  content: string;
  timestamp: string;
  type: 'system_disappearing_message' | 'system_general' | 'system_group_created' | 'system_member_added' | 'system_member_removed' | 'system_member_left';
  onClick?: () => void;
}

const SystemMessage: React.FC<SystemMessageProps> = ({
  content,
  timestamp,
  type,
  onClick
}) => {
  const isDisappearingMessage = type === 'system_disappearing_message';
  const isGroupMessage = type.startsWith('system_group_') || type.startsWith('system_member_');

  // 解析群组系统消息内容
  const getDisplayContent = () => {
    if (type === 'system_group_created') {
      try {
        const metadata = JSON.parse(content);
        return metadata.displayText || content;
      } catch (e) {
        return content;
      }
    }
    return content;
  };

  // 获取系统消息图标
  const getSystemIcon = () => {
    switch (type) {
      case 'system_disappearing_message':
        return <Clock className="h-4 w-4 text-primary-500" />;
      case 'system_group_created':
        return <Users className="h-4 w-4 text-green-500" />;
      case 'system_member_added':
        return <UserPlus className="h-4 w-4 text-blue-500" />;
      case 'system_member_removed':
        return <UserMinus className="h-4 w-4 text-red-500" />;
      case 'system_member_left':
        return <UserMinus className="h-4 w-4 text-orange-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex justify-center my-4">
      <div 
        className={`max-w-[80%] bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl p-4 text-center border border-gray-200 dark:border-gray-600 shadow-sm ${
          isDisappearingMessage && onClick ? 'cursor-pointer hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 hover:border-blue-200 dark:hover:border-blue-600 transition-all duration-200' : ''
        }`}
        onClick={onClick}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          {getSystemIcon()}
          <p className="text-sm text-gray-800 dark:text-gray-100 font-semibold">
            {getDisplayContent()}
          </p>
          {isDisappearingMessage && onClick && (
            <Settings className="h-3 w-3 text-gray-500 dark:text-gray-400" />
          )}
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {new Date(timestamp).toLocaleTimeString('zh-CN', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </p>
      </div>
    </div>
  );
};

export default SystemMessage; 