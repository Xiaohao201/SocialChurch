import { useState, useEffect } from 'react';
import { useUserContext } from '@/context/AuthContext';
import { getCallHistoryForUser } from '@/lib/appwrite/api';
import { Models } from 'appwrite';
import Loader from '@/components/shared/Loader';
import { Phone, PhoneMissed, PhoneOutgoing, PhoneIncoming } from 'lucide-react';

// 定义通话记录的TypeScript接口
interface ICallHistoryDocument extends Models.Document {
  callerId: string;
  receiverId: string;
  callerName: string;
  receiverName: string;
  callerAvatar?: string;
  receiverAvatar?: string;
  status: 'completed' | 'missed' | 'rejected';
  duration?: number;
  initiatedAt: string;
}

const CallHistory = () => {
  const { user } = useUserContext();
  const [callHistory, setCallHistory] = useState<ICallHistoryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCallHistory = async () => {
      if (!user.id) return;
      setIsLoading(true);
      try {
        const history = await getCallHistoryForUser(user.id);
        setCallHistory(history as ICallHistoryDocument[]);
      } catch (error) {
        console.error("无法获取通话记录:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCallHistory();
  }, [user.id]);

  const formatCallDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds > 0 ? ` ${remainingSeconds}秒` : ''}`;
  };
  
  const renderCallStatusIcon = (call: ICallHistoryDocument) => {
    const isOutgoing = call.callerId === user.id;
    
    switch(call.status) {
      case 'completed':
        return isOutgoing ? 
          <PhoneOutgoing className="text-green-500" /> : 
          <PhoneIncoming className="text-green-500" />;
      case 'missed':
        return isOutgoing ? 
          <PhoneOutgoing className="text-red-500" /> : // 你呼叫但对方未接
          <PhoneMissed className="text-red-500" />;    // 对方呼叫但你未接
      case 'rejected':
         return isOutgoing ?
          <PhoneOutgoing className="text-red-500" /> : // 你呼叫但对方拒绝
          <PhoneMissed className="text-red-500" />;    // 对方呼叫但你拒绝
      default:
        return <Phone className="text-gray-500" />;
    }
  };

  return (
    <div className="flex flex-1">
      <div className="home-container">
        <div className="max-w-5xl flex-start gap-3 justify-start w-full">
          <h2 className="h3-bold md:h2-bold text-left w-full">通话记录</h2>
        </div>

        {isLoading ? (
          <Loader />
        ) : callHistory.length === 0 ? (
          <p className="text-light-4 mt-10 text-center w-full">暂无通话记录</p>
        ) : (
          <ul className="flex flex-col flex-1 gap-9 w-full mt-6">
            {callHistory.map((call) => {
              const isOutgoing = call.callerId === user.id;
              const otherUser = {
                name: isOutgoing ? call.receiverName : call.callerName,
                avatar: isOutgoing ? call.receiverAvatar : call.callerAvatar,
              };

              return (
                <li key={call.$id} className="flex justify-between items-center w-full">
                  <div className="flex items-center gap-4">
                    <img
                      src={otherUser.avatar || '/assets/icons/profile-placeholder.svg'}
                      alt="avatar"
                      className="h-14 w-14 rounded-full"
                    />
                    <div className="flex flex-col">
                      <p className="base-medium lg:body-bold text-light-1">
                        {otherUser.name}
                      </p>
                      <div className="flex items-center gap-2 text-light-3">
                        {renderCallStatusIcon(call)}
                        <p className="subtle-semibold lg:small-regular">
                           {new Date(call.initiatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {call.status === 'completed' && call.duration !== undefined && (
                     <p className="small-medium text-light-3">
                       {formatCallDuration(call.duration)}
                     </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CallHistory; 