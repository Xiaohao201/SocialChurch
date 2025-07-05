import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CurrentChatInfo {
  id: string;
  otherUser: {
    $id: string;
    name: string;
    imageUrl?: string;
  };
}

interface ChatContextType {
  totalUnreadCount: number;
  setTotalUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  incrementTotalUnreadCount: () => void;
  resetChatUnreadCount: (countToSubtract: number) => void;
  
  // 新增：当前聊天状态管理
  currentChat: CurrentChatInfo | null;
  setCurrentChat: (chat: CurrentChatInfo | null) => void;
  clearCurrentChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const [currentChat, setCurrentChat] = useState<CurrentChatInfo | null>(null);

  const incrementTotalUnreadCount = () => {
    setTotalUnreadCount(prev => prev + 1);
  };

  const resetChatUnreadCount = (countToSubtract: number) => {
    setTotalUnreadCount(prev => Math.max(0, prev - countToSubtract));
  };

  const clearCurrentChat = () => {
    setCurrentChat(null);
  };

  const value = {
    totalUnreadCount,
    setTotalUnreadCount,
    incrementTotalUnreadCount,
    resetChatUnreadCount,
    currentChat,
    setCurrentChat,
    clearCurrentChat,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}; 