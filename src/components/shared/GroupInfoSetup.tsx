import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IUserWithFriendship } from '@/types';
import { Camera, X, ArrowLeft } from 'lucide-react';

interface GroupInfoSetupProps {
  selectedMembers: IUserWithFriendship[];
  onBack: () => void;
  onComplete: (groupInfo: { name: string; avatar?: string }) => void;
  onCancel: () => void;
}

const GroupInfoSetup: React.FC<GroupInfoSetupProps> = ({
  selectedMembers,
  onBack,
  onComplete,
  onCancel
}) => {
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultGroupName = selectedMembers.length > 0 
    ? selectedMembers.slice(0, 3).map(member => member.name).join('、') + 
      (selectedMembers.length > 3 ? '...' : '')
    : `群聊(${selectedMembers.length + 1})`;

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setGroupAvatar(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = () => {
    const finalGroupName = groupName.trim() || defaultGroupName;
    onComplete({
      name: finalGroupName,
      avatar: groupAvatar || undefined
    });
  };

  const generateDefaultAvatar = () => {
    // 生成简单的文字头像
    const initials = (groupName.trim() || defaultGroupName)
      .split('')
      .slice(0, 2)
      .join('')
      .toUpperCase();
    
    return (
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-lg">
        {initials}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-dark-1">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-9 w-9 hover:bg-gray-100 dark:hover:bg-dark-4 rounded-full"
          >
            <ArrowLeft className="h-4 w-4 text-gray-600 dark:text-light-3" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M12.9 14.32a8 8 0 1 1 1.41-1.41l5.35 5.33-1.42 1.42-5.33-5.34zM8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-light-1">群组信息</h2>
              <p className="text-sm text-gray-600 dark:text-light-3">设置群组详情</p>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="h-9 w-9 hover:bg-gray-100 dark:hover:bg-dark-4 rounded-full"
        >
          <X className="h-4 w-4 text-gray-600 dark:text-light-3" />
        </Button>
      </div>

      <div className="p-6">
        {/* Group Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            {groupAvatar ? (
              <img
                src={groupAvatar}
                alt="群组头像"
                className="w-24 h-24 rounded-full object-cover ring-4 ring-primary-100 dark:ring-primary-800 shadow-lg"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {(groupName.trim() || defaultGroupName).split('').slice(0, 2).join('').toUpperCase()}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full p-2.5 hover:from-primary-600 hover:to-primary-700 transition-all duration-200 shadow-lg ring-2 ring-white dark:ring-dark-1"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-light-3 text-center">点击相机图标设置群组头像</p>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleAvatarSelect}
          accept="image/*"
          className="hidden"
        />

        {/* Group Name */}
        <div className="mb-8">
          <Label htmlFor="groupName" className="text-sm font-semibold text-gray-800 dark:text-light-1 mb-3 block">
            群组名称
          </Label>
          <Input
            id="groupName"
            placeholder={defaultGroupName}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full bg-white dark:bg-dark-2 border-gray-200 dark:border-dark-4 focus:border-primary-500 dark:focus:border-primary-500 text-gray-800 dark:text-light-1 py-3 px-4 rounded-lg"
            maxLength={50}
          />
          <p className="text-xs text-gray-500 dark:text-light-4 mt-2">
            {groupName.trim() ? `${groupName.length}/50` : `留空将使用默认名称：${defaultGroupName}`}
          </p>
        </div>

        {/* Selected Members Preview */}
        <div className="mb-8">
          <Label className="text-sm font-semibold text-gray-800 dark:text-light-1 mb-3 block">
            群组成员 ({selectedMembers.length + 1})
          </Label>
          <div className="max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-dark-4 bg-gray-50 dark:bg-dark-2 rounded-lg p-3">
            <div className="space-y-2">
              {selectedMembers.map((member) => (
                <div key={member.$id} className="flex items-center gap-3 p-3 bg-white dark:bg-dark-3 rounded-lg border border-gray-100 dark:border-dark-4 hover:border-primary-200 dark:hover:border-primary-500/30 transition-colors">
                  <img
                    src={member.imageUrl || '/assets/icons/profile-placeholder.svg'}
                    alt={member.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-200 dark:ring-dark-4"
                  />
                  <span className="text-sm font-medium text-gray-800 dark:text-light-1">{member.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-dark-4">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex-1 border-gray-300 dark:border-dark-4 text-gray-700 dark:text-light-2 hover:bg-gray-50 dark:hover:bg-dark-3 bg-white dark:bg-dark-2"
          >
            返回
          </Button>
          <Button
            onClick={handleComplete}
            className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-medium shadow-lg transition-all duration-200"
          >
            创建群组
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GroupInfoSetup; 