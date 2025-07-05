import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import useDebounce from '@/hooks/useDebounce';
import { useUserContext } from '@/context/AuthContext';
import { searchUsers, sendFriendRequest, getFriendRequests, handleFriendRequest, getFriends, getOrCreateChat } from '@/lib/appwrite/api';
import { Models } from 'appwrite';
import Loader from '@/components/shared/Loader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import FriendRequestList from '@/components/shared/FriendRequestList';
import FriendList from '@/components/shared/FriendList';
import { IUserWithFriendship } from '@/types';

const Friends = () => {
  const { toast } = useToast();
  const { user } = useUserContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Models.Document[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [friendRequests, setFriendRequests] = useState<Models.Document[]>([]);
  const [friends, setFriends] = useState<IUserWithFriendship[]>([]);
  const debouncedSearch = useDebounce(searchQuery, 500);
  const [isFocused, setIsFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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
      setSentRequests((prev) => [...prev, receiverId]);
      toast({ title: "好友请求已发送" });
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
      const newFriendId = request.sender.$id;

      await handleFriendRequest(requestId, 'accepted', user.$id);
      
      await getOrCreateChat(user.$id, newFriendId);

      setFriendRequests((prev) => prev.filter((req) => req.$id !== requestId));
      fetchFriends();
      toast({ title: "好友已添加", description: "一个新的聊天已经创建。" });
    } catch (error) {
      console.error(error);
      toast({ title: "处理请求失败", variant: "destructive" });
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      await handleFriendRequest(requestId, 'rejected', user.$id);
      setFriendRequests((prev) => prev.filter((req) => req.$id !== requestId));
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

  return (
    <div className="p-4 w-full">
      <div ref={searchContainerRef} className="relative">
        <div 
          className={`relative flex items-center bg-surface rounded-full transition-all duration-300 ${isFocused ? 'ring-2 ring-accent-blue' : ''}`}
        >
          <img 
            src="/assets/icons/search.svg" 
            width={20} 
            height={20} 
            alt="search"
            className={`absolute left-4 transition-all duration-300 ${isFocused ? 'text-accent-blue' : 'text-warm-gray'}`}
          />
          <Input 
            placeholder="按名称或邮箱搜索..."
            className="h-12 pl-12 pr-10 bg-transparent border-none rounded-full text-charcoal placeholder:text-warm-gray focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            value={searchQuery}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={clearSearch} className="absolute right-4">
              <img src="/assets/icons/close.svg" width={16} height={16} alt="clear search" />
            </button>
          )}
        </div>

        {isFocused && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface shadow-lg rounded-lg z-10 p-2">
            {isSearching ? (
              <div className="flex-center p-4">
                <Loader />
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((foundUser) => (
                <div key={foundUser.$id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100">
                  <div className="flex items-center gap-3">
                    <img src={foundUser.imageUrl || '/assets/icons/profile-placeholder.svg'} alt={foundUser.name} className="w-12 h-12 rounded-full object-cover" />
                    <div>
                      <p className="font-semibold text-charcoal">{foundUser.name}</p>
                      <p className="text-sm text-warm-gray">{foundUser.email}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleSendRequest(foundUser.$id)}
                    disabled={sentRequests.includes(foundUser.$id)}
                    className={`px-4 py-2 rounded-lg text-white ${sentRequests.includes(foundUser.$id) ? 'bg-gray-400' : 'bg-accent-blue hover:bg-blue-600'}`}
                  >
                    {sentRequests.includes(foundUser.$id) ? '请求已发送' : '添加好友'}
                  </Button>
                </div>
              ))
            ) : debouncedSearch ? (
              <div className="text-center p-4">
                <p className="text-charcoal font-semibold">未找到用户</p>
                <p className="text-warm-gray text-sm">请检查拼写或尝试其他电子邮件。</p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-b border-black border-opacity-10 my-4"></div>
      
      <FriendRequestList 
        requests={friendRequests}
        onAccept={handleAcceptRequest}
        onDecline={handleDeclineRequest}
      />
      <FriendList friends={friends} />
    </div>
  );
};

export default Friends;