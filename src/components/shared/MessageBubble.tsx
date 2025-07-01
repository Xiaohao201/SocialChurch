import React from 'react';
import { Clock, Check, CheckCheck, Link } from 'lucide-react';

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    type: 'text' | 'emoji' | 'url' | 'image' | 'file';
    senderId: string;
    timestamp: string | Date;
    status: 'sending' | 'sent' | 'delivered' | 'read';
    avatar?: string;
    isOnline?: boolean;
  };
  isMe: boolean;
  showTime?: boolean;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  senderAvatar?: string;
  senderName?: string;
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMe,
  showTime,
  showAvatar = true,
  isFirstInGroup = true,
  isLastInGroup = true,
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

  // Render URL content with clickable links
  const renderUrlContent = () => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = message.content.split(urlRegex);
    
    return (
      <div className="text-sm leading-relaxed break-words whitespace-pre-wrap">
        {parts.map((part, index) => {
          if (part.match(urlRegex)) {
            return (
              <a 
                key={index} 
                href={part} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-500 underline hover:text-blue-700 inline-flex items-center gap-1"
              >
                <span>{part}</span>
                <Link className="w-3 h-3" />
              </a>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </div>
    );
  };

  return (
    <div
      onContextMenu={onContextMenu}
      className={`flex items-end gap-2 ${isFirstInGroup ? 'mt-2' : 'mt-0.5'} ${
        isMe ? "ml-auto flex-row-reverse" : "mr-auto"
      } ${isLastInGroup ? 'mb-1.5' : 'mb-0.5'} max-w-[75%]`}
    >
      {/* Avatar - Only show for other users and if it's the last message in a group */}
      {!isMe && showAvatar && isLastInGroup ? (
        <div className="relative w-8 h-8 flex-shrink-0">
          <img 
            src={message.avatar || '/assets/icons/profile-placeholder.svg'} 
            alt={senderName || "User avatar"}
            className="w-8 h-8 rounded-full object-cover border border-dark-4"
          />
          <div 
            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white ${
                message.isOnline ? 'bg-green-500' : 'bg-gray-400'
            }`}
          ></div>
        </div>
      ) : !isMe ? (
        // Placeholder to maintain alignment
        <div className="w-8 flex-shrink-0"></div>
      ) : null}
      
      <div className={`max-w-full ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isMe && isFirstInGroup && senderName && (
          <span className="text-xs text-light-4 mb-1 ml-1">{senderName}</span>
        )}
        
        <div 
          className={`group relative transition-all duration-200 ${
            isMe 
              ? 'message-bubble-me text-white ml-auto bg-primary-500 rounded-t-2xl rounded-bl-2xl rounded-br-md'
              : 'message-bubble-other text-dark-1 bg-light-2 dark:bg-dark-3 dark:text-light-1 rounded-t-2xl rounded-br-2xl rounded-bl-md'
          } ${
            message.type === 'image' ? 'p-1' : 'px-4 py-2'
          } ${
            message.type === 'emoji' ? 'bg-transparent !px-0 !py-0 text-4xl' : ''
          } ${
            !isFirstInGroup ? (isMe ? 'rounded-tr-md' : 'rounded-tl-md') : ''
          } ${
            !isLastInGroup ? (isMe ? 'rounded-br-2xl rounded-bl-md' : 'rounded-bl-2xl rounded-br-md') : ''
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
          
          {message.type === "emoji" && (
            <p className="text-2xl sm:text-3xl md:text-4xl">{message.content}</p>
          )}
          
          {message.type === "url" && renderUrlContent()}
          
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
        </div>
        
        {isLastInGroup && (
          <div className={`flex items-center gap-2 mt-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-xs text-light-4 opacity-70">
              {typeof message.timestamp === 'string' 
                ? message.timestamp 
                : message.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
              }
            </span>
            {isMe && (
              <div className="opacity-70">
                {getStatusIcon(message.status)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble; 