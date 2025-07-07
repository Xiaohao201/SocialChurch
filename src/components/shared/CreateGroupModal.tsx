import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useUserContext } from '@/context/AuthContext';
import { createGroupChat } from '@/lib/appwrite/api';
import { IUserWithFriendship } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import GroupMemberSelector from './GroupMemberSelector';
import GroupInfoSetup from './GroupInfoSetup';
import Loader from './Loader';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onGroupCreated: (groupId: string) => void;
}

type CreateGroupStep = 'select-members' | 'setup-info' | 'creating';

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  open,
  onClose,
  onGroupCreated
}) => {
  const { user } = useUserContext();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<CreateGroupStep>('select-members');
  const [selectedMembers, setSelectedMembers] = useState<IUserWithFriendship[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleMemberSelection = (members: IUserWithFriendship[]) => {
    setSelectedMembers(members);
    setCurrentStep('setup-info');
  };

  const handleBackToMemberSelection = () => {
    setCurrentStep('select-members');
  };

  const handleGroupCreation = async (groupInfo: { name: string; avatar?: string }) => {
    try {
      setIsCreating(true);
      setCurrentStep('creating');

      const participantIds = selectedMembers.map(member => member.$id);
      
      const newGroup = await createGroupChat(
        groupInfo.name,
        participantIds,
        user.$id,
        groupInfo.avatar
      );

      toast({
        title: '群组创建成功',
        description: `群组"${groupInfo.name}"已创建，可以开始聊天了！`,
      });

      onGroupCreated(newGroup.$id);
      handleClose();
    } catch (error) {
      toast({
        title: '创建群组失败',
        description: '请稍后重试',
        variant: 'destructive',
      });
      setCurrentStep('setup-info');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setCurrentStep('select-members');
    setSelectedMembers([]);
    setIsCreating(false);
    onClose();
  };

  const renderContent = () => {
    switch (currentStep) {
      case 'select-members':
        return (
          <GroupMemberSelector
            onNext={handleMemberSelection}
            onCancel={handleClose}
          />
        );
      case 'setup-info':
        return (
          <GroupInfoSetup
            selectedMembers={selectedMembers}
            onBack={handleBackToMemberSelection}
            onComplete={handleGroupCreation}
            onCancel={handleClose}
          />
        );
      case 'creating':
        return (
          <div className="flex flex-col items-center justify-center py-16 px-8">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                  <path d="M6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3z"/>
                </svg>
              </div>
              <Loader />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-light-1 mb-2">正在创建群组</h3>
              <p className="text-sm text-gray-600 dark:text-light-3">请稍等，我们正在为您创建群组...</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden p-0 bg-white dark:bg-dark-1 border-none shadow-2xl">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-1 rounded-t-lg">
          <div className="bg-white dark:bg-dark-1 rounded-t-md">
            {renderContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupModal; 