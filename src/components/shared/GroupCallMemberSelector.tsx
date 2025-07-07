import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useUserContext } from '@/context/AuthContext';
import { getGroupChatDetails } from '@/lib/appwrite/api';
import { Phone, Video, X } from 'lucide-react';
import Loader from './Loader';

interface GroupCallMemberSelectorProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  callType: 'audio' | 'video';
  onCallMember: (memberId: string, memberName: string, memberAvatar?: string) => void;
}

interface GroupMember {
  $id: string;
  name: string;
  email: string;
  imageUrl?: string;
  role: 'admin' | 'member';
}

const GroupCallMemberSelector: React.FC<GroupCallMemberSelectorProps> = ({
  open,
  onClose,
  groupId,
  callType,
  onCallMember
}) => {
  const { user } = useUserContext();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && groupId) {
      fetchGroupMembers();
    }
  }, [open, groupId]);

  const fetchGroupMembers = async () => {
    try {
      setIsLoading(true);
      const details = await getGroupChatDetails(groupId);
      // 过滤掉当前用户
      const otherMembers = details.members.filter(member => member.$id !== user.$id);
      setMembers(otherMembers);
    } catch (error) {
      // 静默处理错误
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallMember = (member: GroupMember) => {
    onCallMember(member.$id, member.name, member.imageUrl);
    onClose();
  };

  const CallIcon = callType === 'audio' ? Phone : Video;
  const callTypeText = callType === 'audio' ? '语音通话' : '视频通话';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[70vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <CallIcon className="h-5 w-5 text-primary-500" />
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                选择{callTypeText}成员
              </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex-center py-8">
              <Loader />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                群组中没有其他成员可以通话
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                选择要进行{callTypeText}的群组成员：
              </p>
              
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.$id}
                    onClick={() => handleCallMember(member)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 dark:hover:from-gray-800 dark:hover:to-gray-700 cursor-pointer transition-all duration-200 border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={member.imageUrl || '/assets/icons/profile-placeholder.svg'}
                        alt={member.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-800 dark:text-gray-100">
                            {member.name}
                          </p>
                          {member.role === 'admin' && (
                            <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 px-2 py-0.5 rounded-full">
                              管理员
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                    >
                      <CallIcon className="h-5 w-5" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GroupCallMemberSelector; 