import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import useDebounce from '@/hooks/useDebounce';
import { useUserContext } from '@/context/AuthContext';
import { searchUsers, sendFriendRequest, getFriendRequests, handleFriendRequest, getFriends, getOrCreateChat, UserWithRelationship } from '@/lib/appwrite/api';
import { Models } from 'appwrite';
import Loader from '@/components/shared/Loader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import FriendRequestList from '@/components/shared/FriendRequestList';
import FriendList from '@/components/shared/FriendList';
import CreateGroupModal from '@/components/shared/CreateGroupModal';
import { IUserWithFriendship } from '@/types';
import { Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Friends = () => {
  const { toast } = useToast();
  const { user } = useUserContext();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserWithRelationship[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friendRequests, setFriendRequests] = useState<Models.Document[]>([]);
  const [friends, setFriends] = useState<IUserWithFriendship[]>([]);
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [isFocused, setIsFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (debouncedSearch) {
      setIsSearching(true);
      setSearchResults([]);
      searchUsers(debouncedSearch, user.$id)
        .then((results) => {
          if (results) {
            setSearchResults(results);
          }
        })
        .catch(console.error)
        .finally(() => setIsSearching(false));
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch, user.$id]);

  const handleSendRequest = async (receiverId: string) => {
    try {
      await sendFriendRequest(user.$id, receiverId);
      toast({ title: "好友请求已发送" });
      
      // 重新搜索以更新状态
      if (debouncedSearch) {
        const results = await searchUsers(debouncedSearch, user.$id);
        setSearchResults(results);
      }
    } catch (error) {
      console.error(error);
      toast({ title: "发送请求失败", description: "您可能已经发送过请求或已经是好友。", variant: "destructive" });
    }
  };
  
  const fetchFriendRequests = () => {
    getFriendRequests(user.$id)
      .then((requests) => {
        if (requests) {
          setFriendRequests(requests);
        }
      })
      .catch(console.error);
  };

  const fetchFriends = () => {
    getFriends(user.$id)
      .then((friends) => {
        if (friends) {
          setFriends(friends);
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchFriendRequests();
    fetchFriends();
  }, [user.$id]);

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const request = friendRequests.find((req) => req.$id === requestId);
      if (!request) throw new Error("Friend request not found");
      const senderId = request.senderId;
      const receiverId = user.$id;

      await handleFriendRequest(requestId, senderId, receiverId, 'accepted');
      
      await getOrCreateChat(user.$id, senderId);

      setFriendRequests((prev) => prev.filter((req) => req.$id !== requestId));
      fetchFriends();
      
      // 如果搜索结果中有这个用户，更新其状态
      if (debouncedSearch) {
        const results = await searchUsers(debouncedSearch, user.$id);
        setSearchResults(results);
      }
      
      toast({ title: "好友已添加", description: "一个新的好友出现在好友列表。" });
    } catch (error) {
      console.error(error);
      toast({ title: "处理请求失败", variant: "destructive" });
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const request = friendRequests.find((req) => req.$id === requestId);
      if (!request) throw new Error("Friend request not found");
      const senderId = request.senderId;
      const receiverId = user.$id;

      await handleFriendRequest(requestId, senderId, receiverId, 'rejected');
      setFriendRequests((prev) => prev.filter((req) => req.$id !== requestId));
      
      // 如果搜索结果中有这个用户，更新其状态
      if (debouncedSearch) {
        const results = await searchUsers(debouncedSearch, user.$id);
        setSearchResults(results);
      }
      
      toast({ title: "请求已拒绝" });
    } catch (error) {
      console.error(error);
      toast({ title: "处理请求失败", variant: "destructive" });
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleGroupCreated = (groupId: string) => {
    navigate(`/chat?id=${groupId}`);
  };

  return (
    <div className="p-4 w-full">
      {/* Header with create group button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-light-1">好友</h1>
          <p className="text-sm text-gray-600 dark:text-light-3 mt-1">管理您的好友和群组</p>
        </div>
        <div className="relative">
          <Button
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-full w-12 h-12 p-0 flex items-center justify-center shadow-lg transition-all duration-200 transform hover:scale-105"
          >
            <Plus className="h-5 w-5" />
          </Button>
          
          {showCreateMenu && (
            <div className="absolute right-0 top-14 bg-white dark:bg-dark-1 shadow-2xl rounded-xl border border-gray-200 dark:border-dark-4 py-2 z-20 min-w-[180px] animate-in slide-in-from-top-2 duration-200">
              <button
                onClick={() => {
                  setShowCreateGroupModal(true);
                  setShowCreateMenu(false);
                }}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-3 flex items-center gap-3 transition-colors duration-200 group"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-primary-600 rounded-full flex items-center justify-center group-hover:from-primary-600 group-hover:to-primary-700 transition-all duration-200">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-800 dark:text-light-1">发起群聊</p>
                  <p className="text-xs text-gray-500 dark:text-light-4">创建新的群组聊天</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={searchContainerRef} className="relative mb-6">
        <div 
          className={`relative flex items-center bg-white dark:bg-dark-2 rounded-xl border-2 transition-all duration-300 shadow-sm ${isFocused ? 'border-primary-500 shadow-lg' : 'border-gray-200 dark:border-dark-4'}`}
        >
          <img 
            src="/assets/icons/search.svg" 
            width={20} 
            height={20} 
            alt="search"
            className={`absolute left-4 transition-all duration-300 ${isFocused ? 'opacity-80' : 'opacity-60'}`}
            style={{ filter: isFocused ? 'hue-rotate(240deg) saturate(2)' : 'none' }}
          />
          <Input 
            placeholder="按名称或邮箱搜索好友..."
            className="h-12 pl-12 pr-10 bg-transparent border-none rounded-xl text-gray-800 dark:text-light-1 placeholder:text-gray-500 dark:placeholder:text-light-4 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            value={searchQuery}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={clearSearch} 
              className="absolute right-4 w-6 h-6 rounded-full bg-gray-100 dark:bg-dark-4 hover:bg-gray-200 dark:hover:bg-dark-3 flex items-center justify-center transition-colors duration-200"
            >
              <img src="/assets/icons/close.svg" width={12} height={12} alt="clear search" className="opacity-60" />
            </button>
          )}
        </div>

        {isFocused && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-dark-1 shadow-2xl rounded-xl border border-gray-200 dark:border-dark-4 z-10 p-2 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-dark-4">
            {isSearching ? (
              <div className="flex-center p-8">
                <Loader />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-1">
                {searchResults.map((foundUser) => (
                  <div key={foundUser.$id} className="flex items-center justify-between p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-3 transition-colors duration-200 group">
                    <div className="flex items-center gap-3">
                      <img 
                        src={foundUser.imageUrl || '/assets/icons/profile-placeholder.svg'} 
                        alt={foundUser.name} 
                        className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-200 dark:ring-dark-4" 
                      />
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-light-1">{foundUser.name}</p>
                        <p className="text-sm text-gray-600 dark:text-light-3">{foundUser.email}</p>
                        {foundUser.relationshipStatus === 'request_received' && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">💌 等待您回复好友申请</p>
                        )}
                      </div>
                    </div>
                    {(() => {
                      const getButtonContent = () => {
                        switch (foundUser.relationshipStatus) {
                          case 'friend':
                            return {
                              text: '已是好友',
                              className: 'bg-green-500 cursor-default',
                              disabled: true
                            };
                          case 'request_sent':
                            return {
                              text: '请求已发送',
                              className: 'bg-gray-400 cursor-not-allowed',
                              disabled: true
                            };
                          case 'request_received':
                            return {
                              text: '已收到请求',
                              className: 'bg-blue-500 cursor-default',
                              disabled: true
                            };
                          default:
                            return {
                              text: '添加好友',
                              className: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-md hover:shadow-lg transform hover:scale-105',
                              disabled: false
                            };
                        }
                      };

                      const buttonContent = getButtonContent();

                      return (
                        <Button 
                          onClick={() => foundUser.relationshipStatus === 'none' && handleSendRequest(foundUser.$id)}
                          disabled={buttonContent.disabled}
                          className={`px-4 py-2 rounded-lg text-white font-medium transition-all duration-200 ${buttonContent.className}`}
                        >
                          {buttonContent.text}
                        </Button>
                      );
                    })()}
                  </div>
                ))}
              </div>
            ) : debouncedSearch ? (
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-dark-3 rounded-full flex items-center justify-center mx-auto mb-4">
                  <img src="/assets/icons/search.svg" width={24} height={24} alt="search" className="opacity-40" />
                </div>
                <p className="text-gray-800 dark:text-light-1 font-semibold mb-1">未找到用户</p>
                <p className="text-gray-600 dark:text-light-3 text-sm">请检查拼写或尝试其他关键词</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
      
      <div className="space-y-6">
        <FriendRequestList 
          requests={friendRequests}
          onAccept={handleAcceptRequest}
          onDecline={handleDeclineRequest}
        />
        <FriendList friends={friends} />
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        open={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onGroupCreated={handleGroupCreated}
      />
    </div>
  );
};

export default Friends;