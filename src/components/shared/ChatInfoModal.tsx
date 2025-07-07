import React, { useState, useEffect } from 'react';
import { X, Clock, User, Phone, Video, Settings, Calendar, Heart, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DisappearingMessageDuration } from '@/types';
import DisappearingMessageSettings from './DisappearingMessageSettings';
import { getUserWithMinistry } from '@/lib/appwrite/api';

interface ChatInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    $id: string;
    name: string;
    imageUrl?: string;
    isOnline?: boolean;
  };
  currentDisappearingDuration: DisappearingMessageDuration;
  onDisappearingDurationChange: (duration: DisappearingMessageDuration) => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
}

interface UserDetailInfo {
  $id: string;
  name: string;
  imageUrl?: string;
  isOnline?: boolean;
  gender?: 'male' | 'female' | 'unknown';
  dateOfFaith?: string;
  faithTestimony?: string;
  ministry?: {
    $id: string;
    name: string;
    description?: string;
  };
}

const ChatInfoModal: React.FC<ChatInfoModalProps> = ({
  isOpen,
  onClose,
  user,
  currentDisappearingDuration,
  onDisappearingDurationChange,
  onVoiceCall,
  onVideoCall
}) => {
  const [showDisappearingSettings, setShowDisappearingSettings] = useState(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetailInfo | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // 获取用户详细信息
  useEffect(() => {
    if (isOpen && user.$id) {
      setIsLoadingDetails(true);
      getUserWithMinistry(user.$id)
        .then((details) => {
          if (details) {
            setUserDetails(details);
          }
        })
        .catch((error) => {
          console.error('Failed to load user details:', error);
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    }
  }, [isOpen, user.$id]);

  if (!isOpen) return null;

  const getDurationLabel = (duration: DisappearingMessageDuration) => {
    switch (duration) {
      case 'off': return '关闭';
      case '1day': return '1 天';
      case '3days': return '3 天';
      case '7days': return '7 天';
      case '30days': return '30 天';
      default: return '关闭';
    }
  };

  const getGenderLabel = (gender?: string) => {
    switch (gender) {
      case 'male': return '男';
      case 'female': return '女';
      default: return '未设置';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '未设置';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return '未设置';
    }
  };

  const handleDisappearingDurationChange = async (duration: DisappearingMessageDuration) => {
    setIsUpdatingSettings(true);
    try {
      await onDisappearingDurationChange(duration);
    } catch (error) {
      console.error('Failed to update disappearing message settings:', error);
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  if (showDisappearingSettings) {
    return (
      <DisappearingMessageSettings
        currentDuration={currentDisappearingDuration}
        onDurationChange={handleDisappearingDurationChange}
        onBack={() => setShowDisappearingSettings(false)}
        isLoading={isUpdatingSettings}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-2 rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header - Fixed at top */}
        <div className="flex items-center justify-between p-4 border-b border-light-3 dark:border-dark-3 flex-shrink-0">
          <h2 className="text-lg font-semibold">聊天信息</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto chat-info-scrollbar scroll-smooth">
          <div className="min-h-full pb-2">{/* Content wrapper with bottom padding */}

        {/* User Info */}
        <div className="p-6 text-center border-b border-light-3 dark:border-dark-3">
          <div className="relative inline-block mb-4">
            <img
              src={user.imageUrl || '/assets/icons/profile-placeholder.svg'}
              alt={user.name}
              className="w-20 h-20 rounded-full object-cover"
            />
            {user.isOnline && (
              <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
            )}
          </div>
          <h3 className="text-xl font-semibold mb-1">{user.name}</h3>
          <p className="text-sm text-light-4 dark:text-light-3">
            {user.isOnline ? '在线' : '离线'}
          </p>

          {/* Quick Actions */}
          <div className="flex items-center justify-center gap-4 mt-6">
            {onVoiceCall && (
              <Button
                variant="outline"
                size="icon"
                onClick={onVoiceCall}
                className="h-12 w-12 rounded-full"
              >
                <Phone className="h-5 w-5" />
              </Button>
            )}
            {onVideoCall && (
              <Button
                variant="outline"
                size="icon"
                onClick={onVideoCall}
                className="h-12 w-12 rounded-full"
              >
                <Video className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* User Details */}
        <div className="p-4 border-b border-light-3 dark:border-dark-3">
          <h4 className="text-sm font-medium text-light-4 dark:text-light-3 mb-3 uppercase tracking-wide">
            个人信息
          </h4>
          
          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Gender */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h5 className="font-medium">性别</h5>
                  <p className="text-sm text-light-4 dark:text-light-3">
                    {getGenderLabel(userDetails?.gender)}
                  </p>
                </div>
              </div>

              {/* Ministry */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 dark:bg-purple-500/10 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <h5 className="font-medium">所属事工</h5>
                  <p className="text-sm text-light-4 dark:text-light-3">
                    {userDetails?.ministry?.name || '未设置'}
                  </p>
                </div>
              </div>

              {/* Date of Faith */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-500/10 rounded-full flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <h5 className="font-medium">坚信日期</h5>
                  <p className="text-sm text-light-4 dark:text-light-3">
                    {formatDate(userDetails?.dateOfFaith)}
                  </p>
                </div>
              </div>

              {/* Faith Testimony */}
              {userDetails?.faithTestimony && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange-50 dark:bg-orange-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Heart className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium mb-1">信仰见证</h5>
                    <p className="text-sm text-light-4 dark:text-light-3 leading-relaxed">
                      {userDetails.faithTestimony}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-light-4 dark:text-light-3 mb-3 uppercase tracking-wide">
            聊天设置
          </h4>
          
          {/* Disappearing Messages */}
          <div
            className="flex items-center justify-between p-3 rounded-lg hover:bg-light-2 dark:hover:bg-dark-3 cursor-pointer transition-colors"
            onClick={() => setShowDisappearingSettings(true)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-50 dark:bg-primary-500/10 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary-500" />
              </div>
              <div>
                <h5 className="font-medium">消息定时清理</h5>
                <p className="text-sm text-light-4 dark:text-light-3">
                  {getDurationLabel(currentDisappearingDuration)}
                </p>
              </div>
            </div>
            <div className="text-light-4 dark:text-light-3">
              <Settings className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-light-3 dark:border-dark-3">
          <p className="text-xs text-light-4 dark:text-light-3 text-center">
            您的消息将得到保护，不会被第三方获取
          </p>
        </div>

          </div>{/* End Content wrapper */}
        </div>{/* End Scrollable Content */}
      </div>
    </div>
  );
};

export default ChatInfoModal; 