import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IUserWithFriendship } from "@/types";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { getFriends, getUserById, getMinistryById, getUserOnlineStatus } from "@/lib/appwrite/api";
import { client, appwriteConfig } from "@/lib/appwrite/config";

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

interface SharedFile {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'video' | 'doc' | 'other';
  url: string;
  size: string;
  timestamp: string;
}

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
  
  const [activeTab, setActiveTab] = useState<'profile' | 'shared-files'>('profile');
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
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

  useEffect(() => {
    if (isOpen) {
      // 模拟共享文件数据
      setSharedFiles([
        {
          id: '1',
          name: '项目文档.pdf',
          type: 'pdf',
          url: '/path/to/document.pdf',
          size: '2.5MB',
          timestamp: '2024-01-20'
        },
        {
          id: '2',
          name: '设计稿.png',
          type: 'image',
          url: '/path/to/design.png',
          size: '1.8MB',
          timestamp: '2024-01-19'
        }
      ]);
    }
  }, [isOpen]);

  const handleStartChat = () => {
    if (user && user.$id) {
      onClose();
      navigate(`/home?chat=${user.$id}&name=${encodeURIComponent(user.name || '')}&avatar=${encodeURIComponent(user.imageUrl || '')}`);
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

              {/* 标签页导航 */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'profile'
                      ? 'border-primary-500 text-primary-500'
                      : 'border-transparent text-soft-gray hover:text-warm-gray'
                  }`}
                >
                  个人资料
                </button>
                <button
                  onClick={() => setActiveTab('shared-files')}
                  className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'shared-files'
                      ? 'border-primary-500 text-primary-500'
                      : 'border-transparent text-soft-gray hover:text-warm-gray'
                  }`}
                >
                  文件共享
                </button>
              </div>

              {/* 个人资料标签页 */}
              {activeTab === 'profile' && (
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
              )}

              {/* 文件共享标签页 */}
              {activeTab === 'shared-files' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-warm-gray font-medium">文件共享</h4>
                    <span className="text-soft-gray text-sm">{sharedFiles.length} 个文件</span>
                  </div>

                  {sharedFiles.length > 0 ? (
                    <div className="space-y-2">
                      {sharedFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                        >
                          <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-lg">
                            {getFileIcon(file.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-warm-gray text-sm font-medium truncate">{file.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-soft-gray text-xs">{file.timestamp}</span>
                              <span className="text-soft-gray text-xs">•</span>
                              <span className="text-soft-gray text-xs">{file.size}</span>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="text-soft-gray hover:text-warm-gray">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-200 rounded-lg">
                      <div className="text-4xl mb-2">📁</div>
                      <p className="text-soft-gray">暂无共享文件</p>
                    </div>
                  )}
                </div>
              )}
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