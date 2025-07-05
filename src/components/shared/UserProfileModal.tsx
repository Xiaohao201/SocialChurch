import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IUserWithFriendship } from "@/types";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/ui/use-toast";
import { getFriends, getUserById, getMinistryById, getUserOnlineStatus } from "@/lib/appwrite/api";
import { client, appwriteConfig } from "@/lib/appwrite/config";
import ImprovedFilePreview from "./ImprovedFilePreview.tsx";

type UserProfileModalProps = {
  user: IUserWithFriendship | null;
  isOpen: boolean;
  onClose: () => void;
  onSendFriendRequest?: (userId: string) => void;
  onRemoveFriend?: (friendshipId: string) => void;
  onStartChat?: (userId: string) => void;
  onStartVideoCall?: (userId: string) => void;
  onStartVoiceCall?: (userId: string) => void;
  currentUserId?: string;
  showActions?: boolean;
};

const UserProfileModal = ({ 
  user, 
  isOpen, 
  onClose, 
  onSendFriendRequest,
  onRemoveFriend,
  onStartChat,
  onStartVideoCall,
  onStartVoiceCall,
  currentUserId,
  showActions = true 
}: UserProfileModalProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [detailedUser, setDetailedUser] = useState<IUserWithFriendship | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ministryName, setMinistryName] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(false);
  
  const isCurrentUser = currentUserId === user?.$id;

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const fetchAndSubscribe = async () => {
      if (!isOpen) return;
      if (!user?.$id) {
        toast({ title: "错误", description: "无法获取用户ID以加载详细信息。", variant: "destructive" });
        return;
      }
      
      setIsLoading(true);
      try {
        // 1. 获取初始数据
        const fullUserData = await getUserById(user.$id);
        if (fullUserData) {
          setDetailedUser({
            ...fullUserData,
            accountId: fullUserData.accountId,
            email: fullUserData.email,
            name: fullUserData.name,
          } as IUserWithFriendship);
          
          // 设置初始在线状态
          setIsOnline(fullUserData.isOnline || false);

          // 获取事工名称
          if (fullUserData.ministryId) {
            const ministryData = await getMinistryById(fullUserData.ministryId);
            setMinistryName(ministryData?.name || '');
          }
        }
        
        // 2. 实时订阅用户状态变化
        const documentId = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.userCollectionId}.documents.${user.$id}`;
        unsubscribe = client.subscribe(documentId, (response) => {
          console.log(`[REALTIME_UPDATE] Received for user ${user?.$id}`, response.payload);
          const updatedUser = response.payload as any;
          if (typeof updatedUser.isOnline === 'boolean') {
            console.log(`[REALTIME_UPDATE] Updating online status to: ${updatedUser.isOnline}`);
            setIsOnline(updatedUser.isOnline);
          }
        });

      } catch (error) {
        console.error("Failed to fetch/subscribe to user details:", error);
        toast({
          title: "加载失败",
          description: "无法获取或订阅用户信息。",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndSubscribe();

    // 清理函数：组件卸载或弹窗关闭时取消订阅
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isOpen, user?.$id, toast]);

  const handleStartChat = () => {
    if (user && user.$id) {
      onClose();
      navigate(`/home?with=${user.$id}`);
    }
  };

  const handleVideoCall = () => {
    if (!user?.$id) return;
    
    if (onStartVideoCall) {
      onStartVideoCall(user.$id);
    } else {
      toast({ title: "视频通话功能", description: `正在呼叫 ${user.name || '用户'}` });
    }
    onClose();
  };

  const handleVoiceCall = () => {
    if (!user?.$id) return;
    
    if (onStartVoiceCall) {
      onStartVoiceCall(user.$id);
    } else {
      toast({ title: "语音通话功能", description: `正在呼叫 ${user.name || '用户'}` });
    }
    onClose();
  };

  const getGenderDisplay = (gender: string) => {
    switch (gender) {
      case 'male': return '男';
      case 'female': return '女';
      case 'unknown':
      default: return '不愿透露';
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return '📄';
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'doc': return '📝';
      default: return '📎';
    }
  };

  const renderFileThumbnail = (file: any) => {
    const fileType = file.fileData?.type || '';
    const fileUrl = file.fileData?.url || '';

    if (fileType.startsWith('image/')) {
      return <img src={fileUrl} alt={file.content} className="w-full h-full object-cover" />;
    }
    if (fileType.startsWith('video/')) {
      return (
        <div className="relative w-full h-full">
          <video src={fileUrl} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="w-8 h-8 bg-white/80 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm3.5 2.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 13H5a1 1 0 00-1 1v.5a1.5 1.5 0 001.5 1.5h9A1.5 1.5 0 0016 14.5V14a1 1 0 00-1-1z"></path></svg>
            </div>
          </div>
        </div>
      );
    }
    return getFileIcon(fileType);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('zh-CN');
    } catch {
      return dateString;
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] bg-cream border-gray-200 flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-warm-gray text-center">
              {isCurrentUser ? '我的个人信息' : `${user?.name || ''} 的个人信息`}
            </DialogTitle>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-6 overflow-y-auto p-6">
              {/* 用户基本信息 */}
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <img 
                    src={detailedUser?.imageUrl || user?.imageUrl || `https://api.dicebear.com/6.x/initials/svg?seed=${user?.name}`}
                    alt={user?.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                  />
                  {/* 在线状态指示器 */}
                  <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-cream"></div>
                </div>
                
                <div className="text-center">
                  <h3 className="text-xl font-bold text-warm-gray">{detailedUser?.name || user?.name}</h3>
                  {ministryName ? (
                    <p className="text-primary-500 text-sm mt-1">📋 {ministryName}</p>
                  ) : (
                    <p className="text-soft-gray text-sm mt-1">暂无事工分配</p>
                  )}
                </div>

                {/* 快速操作按钮 - 只有当用户是好友时才显示语音和视频通话 */}
                {showActions && !isCurrentUser && detailedUser?.isFriend && (
                  <div className="flex gap-2 w-full max-w-sm">
                    <Button 
                      size="sm"
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                      onClick={handleVoiceCall}
                    >
                      📞 语音通话
                    </Button>
                    <Button 
                      size="sm"
                      variant="outline"
                      className="flex-1 border-gray-300 text-warm-gray hover:bg-gray-100"
                      onClick={handleVideoCall}
                    >
                      📹 视频通话
                    </Button>
                  </div>
                )}
              </div>

              {/* 个人资料 */}
              <div className="space-y-6">
                {/* 基本信息 */}
                <div>
                  <h4 className="text-warm-gray font-medium mb-3">
                    基本信息
                  </h4>
                  <div className="space-y-3 bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between">
                      <span className="text-soft-gray">性别:</span>
                      <span className="text-warm-gray">{getGenderDisplay(detailedUser?.gender || 'unknown')}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-soft-gray">事工:</span>
                      <span className="text-warm-gray">{ministryName || '暂无'}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-soft-gray">状态:</span>
                      <span className={`text-warm-gray ${isOnline ? 'text-green-500' : 'text-gray-500'}`}>
                        {isOnline ? '🟢 在线' : '⚫ 离线'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 信仰经历 */}
                <div>
                  <h4 className="text-warm-gray font-medium mb-3">信仰经历</h4>
                  <div className="space-y-3 bg-white rounded-lg p-4 border border-gray-200">
                    {detailedUser?.dateOfFaith && (
                      <div className="flex justify-between">
                        <span className="text-soft-gray">信主日期:</span>
                        <span className="text-warm-gray">{formatDate(detailedUser.dateOfFaith.toString())}</span>
                      </div>
                    )}
                    <div>
                        <p className="text-warm-gray text-sm leading-relaxed mt-1">
                          {detailedUser?.faithTestimony || '暂无见证分享'}
                        </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 底部操作区 */}
          <div className="flex-shrink-0 border-t border-gray-200 p-4 -mx-6 -mb-6 mt-auto bg-cream">
            {showActions && !isCurrentUser && (
              <div className="flex gap-3">
                {detailedUser?.isFriend ? (
                  <>
                    <Button 
                      className="flex-1 bg-primary-500 hover:bg-primary-600 text-white"
                      onClick={handleStartChat}
                    >
                      开始聊天
                    </Button>
                    {user?.friendshipId && onRemoveFriend && (
                      <Button 
                        variant="outline" 
                        className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                        onClick={() => onRemoveFriend(user.friendshipId!)}
                      >
                        删除好友
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button 
                      className="flex-1 bg-primary-500 hover:bg-primary-600 text-white"
                      onClick={handleStartChat}
                    >
                      开始聊天
                    </Button>
                    {onSendFriendRequest && (
                      <Button 
                        variant="outline"
                        className="flex-1 border-primary-500 text-primary-500 hover:bg-primary-500 hover:text-white"
                        onClick={() => onSendFriendRequest && user?.$id && onSendFriendRequest(user.$id)}
                      >
                        添加好友
                      </Button>
                    )}
                  </>
                )}
                
                <Button 
                  variant="outline" 
                  className="border-gray-300 text-soft-gray hover:text-warm-gray hover:bg-gray-100"
                  onClick={onClose}
                >
                  关闭
                </Button>
              </div>
            )}
            
            {(isCurrentUser || !showActions) && (
              <Button 
                variant="outline" 
                onClick={onClose} 
                className="w-full border-gray-300 text-soft-gray hover:text-warm-gray hover:bg-gray-100"
              >
                关闭
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UserProfileModal; 