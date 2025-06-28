import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Search } from 'lucide-react';
import Loader from './Loader';

const UserSearch = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: '请输入搜索内容',
        description: '请输入用户名或邮箱进行搜索',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSearching(true);
      // 这里需要实现搜索用户的API
      // const results = await searchUsers(searchQuery);
      // setSearchResults(results);
      setSearchResults([]); // 临时空数组
      
      toast({
        title: '搜索完成',
        description: '搜索功能暂未实现',
      });
    } catch (error) {
      console.error('搜索用户失败:', error);
      toast({
        title: '搜索失败',
        description: '无法搜索用户，请重试',
        variant: 'destructive',
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
    try {
      // 实现发送好友请求的逻辑
      toast({
        title: '请求已发送',
        description: '好友请求已发送，等待对方确认',
      });
    } catch (error) {
      toast({
        title: '发送失败',
        description: '无法发送好友请求',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="搜索用户名或邮箱..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSearch();
            }
          }}
        />
        <Button
          onClick={handleSearch}
          disabled={isSearching}
          className="px-4"
        >
          {isSearching ? (
            <Loader />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>

      {isSearching && (
        <div className="text-center py-8">
          <Loader />
          <p className="text-light-3 mt-2">搜索中...</p>
        </div>
      )}

      {searchResults.length === 0 && !isSearching && searchQuery && (
        <div className="text-center py-8">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-50 text-light-4" />
          <p className="text-light-3">未找到相关用户</p>
          <p className="text-light-4 text-sm mt-1">尝试其他关键词</p>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-light-2 font-medium">搜索结果</h4>
          {searchResults.map((user) => (
            <div key={user.$id} className="bg-dark-3 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={user.imageUrl || '/assets/icons/profile-placeholder.svg'}
                  alt={user.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <h4 className="text-light-1 font-medium">{user.name}</h4>
                  <p className="text-light-3 text-sm">{user.email}</p>
                  {user.ministry && (
                    <p className="text-light-4 text-xs mt-1">📋 {user.ministry}</p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => handleSendFriendRequest(user.$id)}
                size="sm"
                className="bg-primary-500 hover:bg-primary-600"
              >
                添加好友
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserSearch; 