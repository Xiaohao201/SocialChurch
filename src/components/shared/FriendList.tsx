import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IUserWithFriendship } from '@/types';

interface FriendListProps {
  friends: IUserWithFriendship[];
}

const FriendList: React.FC<FriendListProps> = ({ friends }) => {
  const navigate = useNavigate();

  const handleFriendClick = (friendId: string) => {
    console.log(`1. CLICKED: FriendList trying to navigate with friend ID: ${friendId}`);
    navigate(`/?with=${friendId}`);
  };

  if (friends.length === 0) {
    return <p className="text-center text-gray-500 mt-4">你还没有好友，快去添加吧！</p>;
  }

  return (
    <div className="my-4">
      <h2 className="text-lg font-semibold mb-2 text-charcoal">好友列表</h2>
      <div className="space-y-3">
        {friends.map((friend) => (
          <div 
            key={friend.$id} 
            className="flex items-center justify-between p-3 bg-surface rounded-lg cursor-pointer transition-all hover:outline hover:outline-2 hover:outline-accent-blue"
            onClick={() => handleFriendClick(friend.$id)}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src={friend.imageUrl || '/assets/icons/profile-placeholder.svg'} alt={friend.name} className="w-12 h-12 rounded-full object-cover" />
                <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full ${friend.isOnline ? 'bg-status-green' : 'bg-gray-400'} border-2 border-white`}></span>
              </div>
              <div>
                <p className="font-semibold text-charcoal">{friend.name}</p>
                {/* Placeholder for last message */}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FriendList; 