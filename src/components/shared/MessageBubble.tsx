import React from 'react';
import { Clock, Check, CheckCheck } from 'lucide-react';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    type: 'text' | 'image' | 'file';
    senderId: string;
    timestamp: Date;
    status: 'sending' | 'sent' | 'delivered' | 'read';
    avatar?: string;
    isOnline?: boolean;
  };
  isMe: boolean;
  showTime?: boolean;
  showAvatar?: boolean;
  senderAvatar?: string;
  senderName?: string;
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMe,
  showTime,
  showAvatar,
  senderAvatar,
  senderName,
  onClick,
  onContextMenu
}) => {
  // 获取消息状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sending":
        return <Clock className="w-3 h-3 text-light-4 animate-pulse message-status-icon sending" />;
      case "sent":
        return <Check className="w-3 h-3 text-light-4 message-status-icon" />;
      case "delivered":
        return <CheckCheck className="w-3 h-3 text-light-4 message-status-icon" />;
      case "read":
        return <CheckCheck className="w-3 h-3 text-primary-500 message-status-icon" />;
      default:
        return null;
    }
  };

  // 格式化时间显示
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  // 格式化时间分隔显示
  const formatTimeDivider = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div
      onContextMenu={onContextMenu}
      className={`flex items-end gap-2 max-w-[75%] ${
        isMe ? "ml-auto flex-row-reverse" : "mr-auto"
      }`}
    >
      <div className="relative flex-shrink-0">
        {!isMe && (
          <div className="relative w-8 h-8 flex-shrink-0">
              <img 
                src={message.avatar || '/assets/icons/profile-placeholder.svg'} 
                alt={senderName}
                className="w-8 h-8 rounded-full object-cover border border-dark-4"
              />
              <div 
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                      message.isOnline ? 'bg-green-500' : 'bg-gray-400'
                  }`}
              ></div>
          </div>
        )}
        
        <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
          {!isMe && showAvatar && senderName && (
            <span className="text-xs text-light-4 mb-1 ml-1">{senderName}</span>
          )}
          
          <div 
            className={`group relative transition-all duration-200 ${
              isMe 
                ? 'message-bubble-me text-white ml-auto' 
                : 'message-bubble-other text-light-1'
            } ${
              message.type === 'image' ? 'p-1' : 'px-4 py-2'
            } ${
              onClick ? 'cursor-pointer' : ''
            }`}
            onClick={onClick}
          >
            {message.type === "text" && (
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                {message.content}
              </p>
            )}
            
            {message.type === "image" && (
              <div className="relative group">
                <img 
                  src={message.content} 
                  alt="shared image"
                  className="max-w-xs max-h-64 rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={onClick}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl" />
              </div>
            )}
            
            {message.type === "file" && (
              <div className="flex items-center gap-3 min-w-[200px]">
                <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-primary-500">📄</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{message.content}</p>
                  <p className="text-xs text-light-4">文件</p>
                </div>
              </div>
            )}
            
            <div className={`absolute top-2 w-0 h-0 ${
              isMe 
                ? 'right-0 transform translate-x-full border-l-8 border-l-primary-500 border-t-8 border-t-transparent border-b-8 border-b-transparent'
                : 'left-0 transform -translate-x-full border-r-8 border-r-dark-3 border-t-8 border-t-transparent border-b-8 border-b-transparent'
            }`} />
          </div>
          
          <div className={`flex items-center gap-2 mt-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-xs text-light-4 opacity-70">
              {formatTime(message.timestamp)}
            </span>
            {isMe && (
              <div className="opacity-70">
                {getStatusIcon(message.status)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble; 