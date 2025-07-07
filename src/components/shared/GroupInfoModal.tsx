import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUserContext } from '@/context/AuthContext';
import { 
  getGroupChatDetails, 
  updateGroupInfo, 
  addMembersToGroup, 
  removeMemberFromGroup, 
  leaveGroup,
  updateGroupDisappearingSettings,
  getFriends
} from '@/lib/appwrite/api';
import { IUserWithFriendship } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { 
  X, 
  Edit2, 
  UserPlus, 
  UserMinus, 
  LogOut, 
  Crown, 
  Users,
  Settings,
  Clock,
  ChevronRight,
  Plus,
  Minus,
  QrCode,
  Search,
  MessageSquare
} from 'lucide-react';
import { DisappearingMessageDuration } from '@/types';
import DisappearingMessageSettings from './DisappearingMessageSettings';
import Loader from './Loader';

interface GroupInfoModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  onGroupLeft?: () => void;
  onGroupUpdated?: () => void;
}

interface GroupMember {
  $id: string;
  name: string;
  email: string;
  imageUrl?: string;
  role: 'admin' | 'member';
}

const GroupInfoModal: React.FC<GroupInfoModalProps> = ({
  open,
  onClose,
  groupId,
  onGroupLeft,
  onGroupUpdated
}) => {
  const { user } = useUserContext();
  const { toast } = useToast();
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showRemoveMembers, setShowRemoveMembers] = useState(false);
  const [showDisappearingSettings, setShowDisappearingSettings] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [disappearingDuration, setDisappearingDuration] = useState<DisappearingMessageDuration>('off');
  const [friends, setFriends] = useState<IUserWithFriendship[]>([]);

  const isAdmin = groupInfo?.admins?.includes(user.$id);
  const isCreator = groupInfo?.createdBy === user.$id;

  useEffect(() => {
    if (open && groupId) {
      fetchGroupDetails();
      fetchFriends();
    }
  }, [open, groupId]);

  const fetchGroupDetails = async () => {
    try {
      setIsLoading(true);
      const details = await getGroupChatDetails(groupId);
      setGroupInfo(details.group);
      setMembers(details.members);
      setEditName(details.group.name || '');
      
      // 获取消息定时清理设置
      if (details.group.disappearingMessages) {
        try {
          const settings = typeof details.group.disappearingMessages === 'string' 
            ? JSON.parse(details.group.disappearingMessages) 
            : details.group.disappearingMessages;
          setDisappearingDuration(settings.duration || 'off');
        } catch (error) {
          setDisappearingDuration('off');
        }
      } else {
        setDisappearingDuration('off');
      }
    } catch (error) {
      toast({
        title: '获取群组信息失败',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFriends = async () => {
    try {
      const friendsList = await getFriends(user.$id);
      setFriends(friendsList || []);
    } catch (error) {
      // 静默处理错误
    }
  };

  const handleUpdateGroupName = async () => {
    if (!editName.trim() || editName === groupInfo?.name) {
      setIsEditing(false);
      return;
    }

    try {
      await updateGroupInfo(groupId, user.$id, { name: editName.trim() });
      setGroupInfo((prev: any) => ({ ...prev, name: editName.trim() }));
      setIsEditing(false);
      toast({
        title: '群组名称已更新',
      });
      onGroupUpdated?.();
    } catch (error) {
      toast({
        title: '更新群组名称失败',
        variant: 'destructive',
      });
    }
  };

  const handleAddMembers = async (selectedFriends: IUserWithFriendship[]) => {
    try {
      const newMemberIds = selectedFriends.map(friend => friend.$id);
      await addMembersToGroup(groupId, newMemberIds, user.$id);
      await fetchGroupDetails();
      setShowAddMembers(false);
      toast({
        title: '成员添加成功',
      });
      onGroupUpdated?.();
    } catch (error) {
      toast({
        title: '添加成员失败',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMemberFromGroup(groupId, memberId, user.$id);
      await fetchGroupDetails();
      toast({
        title: '成员已移除',
      });
      onGroupUpdated?.();
    } catch (error) {
      toast({
        title: '移除成员失败',
        variant: 'destructive',
      });
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await leaveGroup(groupId, user.$id);
      toast({
        title: '已离开群组',
      });
      onGroupLeft?.();
      onClose();
    } catch (error) {
      toast({
        title: '离开群组失败',
        variant: 'destructive',
      });
    }
  };

  const handleDisappearingSettingsChange = async (duration: DisappearingMessageDuration) => {
    try {
      await updateGroupDisappearingSettings(groupId, duration, user.$id);
      setDisappearingDuration(duration);
      setShowDisappearingSettings(false);
      toast({
        title: '消息定时清理设置已更新',
      });
    } catch (error) {
      toast({
        title: '设置更新失败',
        description: '只有管理员可以修改此设置',
        variant: 'destructive',
      });
    }
  };

  const availableFriends = friends.filter(friend => 
    !members.some(member => member.$id === friend.$id)
  );

  const getDurationLabel = (duration: DisappearingMessageDuration) => {
    switch (duration) {
      case 'off': return '关闭';
      case '1day': return '1天';
      case '3days': return '3天';
      case '7days': return '7天';
      case '30days': return '30天';
      default: return '关闭';
    }
  };

  // 获取显示的成员（前4-5位）
  const displayMembers = members.slice(0, 4);
  const hasMoreMembers = members.length > 4;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex-center py-8">
            <Loader />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden p-0 bg-white dark:bg-dark-2 border-none shadow-2xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-light-3 dark:border-dark-3 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-light-1">群组信息</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-700 dark:text-light-2 hover:bg-gray-100 dark:hover:bg-dark-4">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto chat-info-scrollbar">
            {/* Group Info */}
            <div className="p-6 text-center border-b border-light-3 dark:border-dark-3">
              <div className="relative inline-block mb-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  {groupInfo?.avatar ? (
                    <img
                      src={groupInfo.avatar}
                      alt={groupInfo.name}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <Users className="h-8 w-8" />
                  )}
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-dark-2 border-2 border-gray-200 dark:border-dark-4 rounded-full shadow-sm hover:bg-gray-50 dark:hover:bg-dark-3"
                    onClick={() => {
                      // TODO: 实现头像上传功能
                      toast({
                        title: '功能开发中',
                        description: '头像上传功能即将推出',
                      });
                    }}
                  >
                    <Edit2 className="h-3 w-3 text-gray-600 dark:text-light-3" />
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-light-1">{groupInfo?.name}</h3>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsEditing(true)}
                    className="h-6 w-6 text-gray-600 dark:text-light-3 hover:bg-gray-100 dark:hover:bg-dark-4 rounded-full"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-light-4 dark:text-light-3">{members.length} 位成员</p>
            </div>

            {/* Members Grid */}
            <div className="p-4 border-b border-light-3 dark:border-dark-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-light-4 dark:text-light-3 uppercase tracking-wide">
                  群成员
                </h4>
                {hasMoreMembers && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllMembers(true)}
                    className="text-primary-500 hover:text-primary-600 text-sm"
                  >
                    查看全部
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-6 gap-3">
                {/* Member Avatars */}
                {displayMembers.map((member) => (
                  <div key={member.$id} className="flex flex-col items-center">
                    <div className="relative">
                      <img
                        src={member.imageUrl || '/assets/icons/profile-placeholder.svg'}
                        alt={member.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-light-3 dark:border-dark-3"
                      />
                      {member.role === 'admin' && (
                        <Crown className="absolute -top-1 -right-1 h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                      )}
                    </div>
                    <span className="text-xs text-center mt-1 text-light-4 dark:text-light-3 truncate w-full">
                      {member.name}
                    </span>
                  </div>
                ))}
                
                {/* Add Member Button */}
                <div className="flex flex-col items-center">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowAddMembers(true)}
                    className="w-12 h-12 rounded-full border-2 border-dashed border-light-3 dark:border-dark-3 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                  >
                    <Plus className="h-5 w-5 text-light-4 dark:text-light-3" />
                  </Button>
                  <span className="text-xs mt-1 text-light-4 dark:text-light-3">邀请</span>
                </div>

                {/* Remove Member Button (Admin Only) */}
                {isAdmin && (
                  <div className="flex flex-col items-center">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowRemoveMembers(!showRemoveMembers)}
                      className="w-12 h-12 rounded-full border-2 border-dashed border-light-3 dark:border-dark-3 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Minus className="h-5 w-5 text-light-4 dark:text-light-3" />
                    </Button>
                    <span className="text-xs mt-1 text-light-4 dark:text-light-3">移除</span>
                  </div>
                )}
              </div>
            </div>

            {/* Settings List */}
            <div className="p-4">
              <h4 className="text-sm font-medium text-light-4 dark:text-light-3 mb-3 uppercase tracking-wide">
                设置
              </h4>
              
              <div className="space-y-1">
                                 {/* Group Name */}
                 <div
                   className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                     isAdmin ? 'hover:bg-light-2 dark:hover:bg-dark-3 cursor-pointer' : 'opacity-50'
                   }`}
                   onClick={() => isAdmin && setIsEditing(true)}
                 >
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center">
                       <Edit2 className="h-4 w-4 text-blue-500" />
                     </div>
                     <div>
                       <p className="font-medium text-gray-900 dark:text-light-1">群聊名称</p>
                       <p className="text-sm text-gray-600 dark:text-light-3">{groupInfo?.name}</p>
                     </div>
                   </div>
                   {isAdmin && <ChevronRight className="h-4 w-4 text-gray-500 dark:text-light-4" />}
                 </div>


                                 {/* Disappearing Messages */}
                 <div
                   className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                     isAdmin ? 'hover:bg-light-2 dark:hover:bg-dark-3 cursor-pointer' : 'opacity-50'
                   }`}
                   onClick={() => isAdmin && setShowDisappearingSettings(true)}
                 >
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-primary-50 dark:bg-primary-500/10 rounded-full flex items-center justify-center">
                       <Clock className="h-4 w-4 text-primary-500" />
                     </div>
                     <div>
                       <p className="font-medium text-gray-900 dark:text-light-1">消息定时清理</p>
                       <p className="text-sm text-gray-600 dark:text-light-3">
                         {getDurationLabel(disappearingDuration)}
                       </p>
                     </div>
                   </div>
                   {isAdmin && <ChevronRight className="h-4 w-4 text-gray-500 dark:text-light-4" />}
                 </div>

              </div>
            </div>
          </div>

          {/* Fixed Bottom Action */}
          <div className="p-4 border-t border-light-3 dark:border-dark-3 flex-shrink-0">
            <Button
              variant="ghost"
              onClick={handleLeaveGroup}
              className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium"
            >
              {isCreator ? '删除并退出群组' : '退出群组'}
            </Button>
          </div>
        </div>

        {/* Modals */}
        {/* Add Members Modal */}
        {showAddMembers && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-2 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">添加成员</h3>
              {availableFriends.length === 0 ? (
                <p className="text-light-4 dark:text-light-3 text-center py-8">没有可添加的好友</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {availableFriends.map((friend) => (
                    <div
                      key={friend.$id}
                      onClick={() => handleAddMembers([friend])}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-light-2 dark:hover:bg-dark-3 cursor-pointer transition-colors"
                    >
                      <img
                        src={friend.imageUrl || '/assets/icons/profile-placeholder.svg'}
                        alt={friend.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-medium">{friend.name}</p>
                        <p className="text-sm text-light-4 dark:text-light-3">{friend.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                onClick={() => setShowAddMembers(false)}
                className="w-full"
              >
                取消
              </Button>
            </div>
          </div>
        )}

        {/* All Members Modal */}
        {showAllMembers && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-2 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">全部成员</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowAllMembers(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.$id} className="flex items-center justify-between p-3 rounded-lg hover:bg-light-2 dark:hover:bg-dark-3 transition-colors">
                    <div className="flex items-center gap-3">
                      <img
                        src={member.imageUrl || '/assets/icons/profile-placeholder.svg'}
                        alt={member.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-light-4 dark:text-light-3">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {member.role === 'admin' && (
                        <Crown className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                      )}
                      {showRemoveMembers && isAdmin && member.$id !== user.$id && member.$id !== groupInfo?.createdBy && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(member.$id)}
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Group Name Edit Modal */}
        {isEditing && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-2 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">修改群名称</h3>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleUpdateGroupName()}
                className="mb-4"
                placeholder="请输入群名称"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={handleUpdateGroupName}
                  className="flex-1"
                >
                  确定
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Disappearing Messages Settings */}
        {showDisappearingSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-2 rounded-lg p-6 max-w-md w-full mx-4">
              <DisappearingMessageSettings
                currentDuration={disappearingDuration}
                onDurationChange={handleDisappearingSettingsChange}
                onBack={() => setShowDisappearingSettings(false)}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default GroupInfoModal; 