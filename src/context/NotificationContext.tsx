import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUserContext } from './AuthContext';
import { client, appwriteConfig } from '@/lib/appwrite/config';
import { getFriendRequests } from '@/lib/appwrite/api';

interface NotificationContextType {
  friendRequestCount: number;
  setFriendRequestCount: React.Dispatch<React.SetStateAction<number>>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUserContext();
  const [friendRequestCount, setFriendRequestCount] = useState(0);

  useEffect(() => {
    if (user.$id) {
      // Initial fetch of friend requests
      getFriendRequests(user.$id).then(requests => {
        setFriendRequestCount(requests.length);
      });

      // Subscribe to real-time updates
      const unsubscribe = client.subscribe(`databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.friendRequestCollectionId}.documents`, response => {
        const payload = response.payload as any;
        if (response.events.includes('databases.*.collections.*.documents.*.create')) {
            if (payload.receiverId === user.$id) {
                setFriendRequestCount(prevCount => prevCount + 1);
            }
        } else if (response.events.includes('databases.*.collections.*.documents.*.delete')) {
            getFriendRequests(user.$id).then(requests => {
                setFriendRequestCount(requests.length);
            });
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [user.$id]);

  return (
    <NotificationContext.Provider value={{ friendRequestCount, setFriendRequestCount }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotificationContext must be used within a NotificationProvider');
  }
  return context;
}; 