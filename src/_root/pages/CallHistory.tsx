import React, { useEffect, useState } from 'react';
import { useUserContext } from '@/context/AuthContext';
import { databases as db } from '@/lib/appwrite/config';
import { appwriteConfig } from '@/lib/appwrite/config';
import { Query } from 'appwrite';
import { CallDocument } from '@/context/CallContext';
import Loader from '@/components/shared/Loader';
import { Phone, PhoneMissed, PhoneOutgoing, PhoneIncoming } from 'lucide-react';

const CallHistory = () => {
  const { user } = useUserContext();
  const [calls, setCalls] = useState<(CallDocument & { $createdAt: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user.$id) return;

    const fetchCallHistory = async () => {
      try {
        const response = await db.listDocuments(
          appwriteConfig.databaseId,
          appwriteConfig.callsCollectionId,
          [
            Query.or([
              Query.equal('callerId', user.$id),
              Query.equal('receiverId', user.$id)
            ]),
            Query.orderDesc('$createdAt')
          ]
        );
        setCalls(response.documents as unknown as (CallDocument & { $createdAt: string })[]);
      } catch (error) {
        console.error("Failed to fetch call history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCallHistory();
  }, [user.$id]);

  const formatCallDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds > 0 ? ` ${remainingSeconds}秒` : ''}`;
  };
  
  const renderCallStatusIcon = (call: CallDocument) => {
    const isOutgoing = call.callerId === user.$id;
    
    switch(call.status) {
      case 'answered':
        return isOutgoing ? <PhoneOutgoing className="w-4 h-4 text-green-500" /> : <PhoneIncoming className="w-4 h-4 text-green-500" />;
      case 'rejected':
      case 'missed':
      case 'canceled':
      case 'busy':
        return <PhoneMissed className="w-4 h-4 text-red-500" />;
      default:
        return <Phone className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return <div className="flex-center w-full h-full"><Loader /></div>;
  }

  return (
    <div className="common-container">
      <div className="max-w-5xl w-full">
        <h2 className="h3-bold md:h2-bold text-left w-full">Call History</h2>
        <div className="mt-8">
          {calls.length === 0 ? (
            <p className="text-light-4">No call history found.</p>
          ) : (
            <ul className="divide-y divide-gray-700">
              {calls.map(call => (
                <li key={call.$id} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     {renderCallStatusIcon(call)}
                     <div>
                        <p className="font-semibold">
                          {call.callerId === user.$id ? call.receiverName : call.callerName}
                        </p>
                        <p className="text-sm text-gray-400 capitalize">{call.status} - {new Date(call.$createdAt).toLocaleString()}</p>
                      </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                    call.type === 'video' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                  }`}>
                    {call.type}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallHistory; 