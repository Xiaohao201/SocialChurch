import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserContext } from '@/context/AuthContext';
import { getFriends } from '@/lib/appwrite/api';
import { IUserWithFriendship } from '@/types';
import { Search, Check, X } from 'lucide-react';
import Loader from './Loader';

interface GroupMemberSelectorProps {
  onNext: (selectedMembers: IUserWithFriendship[]) => void;
  onCancel: () => void;
}

const GroupMemberSelector: React.FC<GroupMemberSelectorProps> = ({
  onNext,
  onCancel
}) => {
  const { user } = useUserContext();
  const [friends, setFriends] = useState<IUserWithFriendship[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<IUserWithFriendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        setIsLoading(true);
        const friendsList = await getFriends(user.$id);
        setFriends(friendsList || []);
      } catch (error) {
        // 静默处理错误
      } finally {
        setIsLoading(false);
      }
    };

    fetchFriends();
  }, [user.$id]);

  const filteredFriends = friends.filter(friend =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleMemberSelection = (friend: IUserWithFriendship) => {
    setSelectedMembers(prev => {
      const isSelected = prev.some(member => member.$id === friend.$id);
      if (isSelected) {
        return prev.filter(member => member.$id !== friend.$id);
      } else {
        return [...prev, friend];
      }
    });
  };

  const handleNext = () => {
    if (selectedMembers.length >= 2) {
      onNext(selectedMembers);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-center h-64">
        <Loader />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-1">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-dark-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
              <path d="M6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3z"/>
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-light-1">选择群成员</h2>
            <p className="text-sm text-gray-600 dark:text-light-3">创建群组的第一步</p>
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
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="搜索好友..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white dark:bg-dark-2 border-gray-200 dark:border-dark-4 focus:border-primary-500 dark:focus:border-primary-500 text-gray-800 dark:text-light-1"
          />
        </div>

        {/* Selected count */}
        <div className={`mb-6 p-4 rounded-xl border-2 transition-all duration-300 ${
          selectedMembers.length >= 2 
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-600/50' 
            : 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-orange-200 dark:border-orange-600/50'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                selectedMembers.length >= 2 
                  ? 'bg-green-300 text-white' 
                  : 'bg-orange-300 text-white'
              }`}>
                {selectedMembers.length >= 2 ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <p className={`text-sm font-semibold ${
                selectedMembers.length >= 2 
                  ? 'text-green-500 dark:text-green-300' 
                  : 'text-orange-500 dark:text-orange-300'
              }`}>
                已选择 {selectedMembers.length} 位好友
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              selectedMembers.length >= 2 
                ? 'bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300' 
                : 'bg-orange-100 dark:bg-orange-800/50 text-orange-700 dark:text-orange-300'
            }`}>
              {selectedMembers.length >= 2 ? '可以创建' : '至少需要2位'}
            </span>
          </div>
          
          {selectedMembers.length < 2 && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mb-3 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              请至少选择2位好友来创建群组
            </p>
          )}
          
          {selectedMembers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedMembers.map(member => (
                <div
                  key={member.$id}
                  className="inline-flex items-center px-3 py-2 bg-white dark:bg-dark-2 rounded-lg text-sm font-medium shadow-sm border border-gray-200 dark:border-dark-4 group hover:shadow-md transition-all duration-200"
                >
                  <img
                    src={member.imageUrl || '/assets/icons/profile-placeholder.svg'}
                    alt={member.name}
                    className="w-5 h-5 rounded-full object-cover mr-2"
                  />
                  <span className="text-gray-800 dark:text-light-1">{member.name}</span>
                  <button
                    onClick={() => toggleMemberSelection(member)}
                    className="ml-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full p-1 transition-colors duration-200 group-hover:opacity-100 opacity-70"
                  >
                    <X className="h-3 w-3 text-red-500 dark:text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Friends list */}
        <div className="max-h-96 overflow-y-auto mb-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-dark-4">
          {filteredFriends.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-dark-3 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-light-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                </svg>
              </div>
              <p className="text-gray-500 dark:text-light-4 font-medium">
                {searchQuery ? '未找到匹配的好友' : '暂无好友'}
              </p>
              <p className="text-sm text-gray-400 dark:text-light-4 mt-1">
                {searchQuery ? '尝试其他关键词' : '先添加一些好友吧'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFriends.map((friend) => {
                const isSelected = selectedMembers.some(member => member.$id === friend.$id);
                return (
                  <div
                    key={friend.$id}
                    onClick={() => toggleMemberSelection(friend)}
                    className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      isSelected 
                        ? 'bg-gradient-to-r from-primary-500/10 to-primary-600/10 dark:from-primary-500/20 dark:to-primary-600/20 border-2 border-primary-200 dark:border-primary-500/50 shadow-sm' 
                        : 'hover:bg-gray-50 dark:hover:bg-dark-3 border-2 border-transparent hover:border-gray-200 dark:hover:border-dark-4'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={friend.imageUrl || '/assets/icons/profile-placeholder.svg'}
                          alt={friend.name}
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 dark:ring-dark-4"
                        />
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-light-1">{friend.name}</p>
                        <p className="text-sm text-gray-600 dark:text-light-3">{friend.email}</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                      isSelected 
                        ? 'bg-primary-500 border-primary-500 shadow-md' 
                        : 'border-gray-300 dark:border-dark-4'
                    }`}>
                      {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-6 border-t border-gray-100 dark:border-dark-4">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1 border-gray-300 dark:border-dark-4 text-gray-700 dark:text-light-2 hover:bg-gray-50 dark:hover:bg-dark-3 bg-white dark:bg-dark-2 h-12"
          >
            取消
          </Button>
          <Button
            onClick={handleNext}
            disabled={selectedMembers.length < 2}
            className={`flex-1 h-12 font-medium shadow-lg transition-all duration-200 ${
              selectedMembers.length >= 2
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white transform hover:scale-105'
                : 'bg-gray-300 dark:bg-dark-4 text-gray-500 dark:text-light-4 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2">
              {selectedMembers.length >= 2 ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              )}
              <span>
                {selectedMembers.length >= 2 
                  ? `下一步 (${selectedMembers.length}位好友)` 
                  : `需要选择 ${2 - selectedMembers.length} 位好友`
                }
              </span>
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GroupMemberSelector; 