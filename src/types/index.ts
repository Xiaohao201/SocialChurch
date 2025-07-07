import { Models } from 'appwrite';

export type IContextType = {
  user: IUser;
  isLoading: boolean;
  setUser: React.Dispatch<React.SetStateAction<IUser>>;
  isAuthenticated: boolean;
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean>>;
  checkAuthUser: () => Promise<boolean>;
};


export type INavLink = {
  imgURL: string;
  route: string;
  label: string;
};

export type IUpdateUser = Partial<INewUser>;


export type IMinistry = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
};

export type IUserStatus = 'active' | 'disabled';

export type IUser = {
  $id: string;
  id?: string;
  accountId: string;
  email: string;
  name: string;
  username?: string;
  imageUrl?: string;
  gender?: 'male' | 'female' | 'unknown';
  dateOfFaith?: Date | string;
  faithTestimony?: string;
  testimony?: string;
  interests?: string[];
  ministry?: string;
  ministryId?: string;
  status?: 'active' | 'disabled';
  mustChangePassword?: boolean;
  isOnline?: boolean;
  lastSeen?: string;
};

export type INewUser = {
  accountId?: string;
  email: string;
  password: string;
  name: string;
  username?: string;
  imageUrl?: string;
  gender?: 'male' | 'female' | 'unknown';
  dateOfFaith?: Date | string;
  faithTestimony?: string;
  interests?: string[];
  ministry?: string;
  ministryId?: string;
  status?: 'active' | 'disabled';
  mustChangePassword?: boolean;
  isOnline?: boolean;
  lastSeen?: string;
  initialPassword?: string;
};

export type IMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: 'text' | 'emoji';
  createdAt: string;
};

export type IConversation = {
  id: string;
  participants: string[];
  lastMessage?: IMessage;
  updatedAt: string;
  createdAt: string;
  isGroup?: boolean;
  groupName?: string;
  groupAvatar?: string;
};

export type IChatUser = {
  id: string;
  name: string;
  username: string;
  imageUrl: string;
  isOnline: boolean;
  lastSeen?: string;
};

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface IFriendRequest {
  $id?: string;
  $createdAt?: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  message?: string;
  sender?: IUser;
  receiver?: IUser;
}

export interface IFriendship {
  $id?: string;
  $createdAt?: string;
  userId: string;
  friendId: string;
  conversationId?: string;
}

export interface IUserWithFriendship extends IUser {
  isFriend?: boolean;
  friendRequestId?: string;
  friendshipId?: string;
  friendRequestStatus?: 'pending' | 'accepted' | 'rejected';
}

export type NotificationType = 'friend_request' | 'friend_accept' | 'message' | 'system';

export interface INotification {
  $id?: string;
  $createdAt?: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  data?: {
    requestId?: string;
    senderId?: string;
    messageId?: string;
    conversationId?: string;
  };
}

export interface INotificationWithSender extends INotification {
  sender?: IUser;
}

export interface IFriend extends IUser {
  friendshipId: string;
}

export type INewPost = {
  userId: string;
  caption: string;
  file: File[];
  location: string;
  tags: string;
};

export type IUpdatePost = {
  postId: string;
  caption: string;
  imageId?: string;
  imageUrl?: string;
  file: File[];
  location: string;
  tags: string;
};

// 消息定时清理相关类型
export type DisappearingMessageDuration = 'off' | '1day' | '3days' | '7days' | '30days';

export interface IDisappearingMessageSettings {
  chatId: string;
  duration: DisappearingMessageDuration;
  enabledBy: string;
  enabledAt: string;
  isEnabled: boolean;
}

export interface IChatWithDisappearing {
  $id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: string;
  disappearingMessages?: IDisappearingMessageSettings;
}

export interface IMessageWithExpiration {
  $id: string;
  chatId: string;
  sender: string;
  content: string;
  messageType: string;
  fileData?: string;
  voiceData?: string;
  expirationTimestamp?: string;
  $createdAt: string;
}

export interface IGroupChat {
  $id: string;
  name: string;
  avatar?: string;
  participants: string[];
  admins: string[];
  createdBy: string;
  isGroup: true;
  lastMessage?: string;
  lastMessageTime?: string;
  disappearingMessages?: IDisappearingMessageSettings;
  $createdAt: string;
  $updatedAt: string;
}

export interface IGroupMember {
  $id: string;
  userId: string;
  groupId: string;
  role: 'admin' | 'member';
  joinedAt: string;
}

export interface IGroupChatWithMembers extends IGroupChat {
  members: (IUser & { role: 'admin' | 'member' })[];
}

export interface ICreateGroupRequest {
  name: string;
  avatar?: string;
  participantIds: string[];
  createdBy: string;
}