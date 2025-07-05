import React from 'react';
import { Button } from '../ui/button';
import { Models } from 'appwrite';

interface FriendRequestListProps {
  requests: Models.Document[];
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
}

const FriendRequestList: React.FC<FriendRequestListProps> = ({ requests, onAccept, onDecline }) => {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="my-4">
      <h2 className="text-lg font-semibold mb-2 text-charcoal">好友请求</h2>
      <div className="space-y-3">
        {requests.map((request) => (
          <div key={request.$id} className="flex items-center justify-between p-3 bg-surface rounded-lg shadow-sm">
            <div className="flex items-center gap-3">
              <img src={request.sender.imageUrl || '/assets/icons/profile-placeholder.svg'} alt={request.sender.name} className="w-12 h-12 rounded-full object-cover" />
              <div>
                <p className="font-semibold text-charcoal">{request.sender.name}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => onAccept(request.$id)} className="bg-accent-blue hover:bg-blue-700 text-white px-4 py-2 rounded-lg">接受</Button>
              <Button onClick={() => onDecline(request.$id)} className="bg-gray-200 hover:bg-gray-300 text-charcoal px-4 py-2 rounded-lg">拒绝</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FriendRequestList; 