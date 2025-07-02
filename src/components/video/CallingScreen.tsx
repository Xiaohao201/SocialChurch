import React from 'react';
import { useCall } from '@/context/CallContext';
import { Button } from '@/components/ui/button';
import { PhoneOff, Mic, Video } from 'lucide-react';

const CallingScreen = () => {
  const { call, endCall } = useCall();
  const receiver = call ? {
    name: call.receiverName, // Assuming these fields exist. You may need to fetch receiver details if not present in the call document
    avatar: call.receiverAvatar
  } : null;

  if (!call || !receiver) return null;

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white transition-opacity duration-300">
      {/* Receiver Info */}
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <img
          src={receiver.avatar || '/assets/icons/profile-placeholder.svg'}
          alt={receiver.name}
          className="w-32 h-32 rounded-full border-4 border-white shadow-lg"
        />
        <h1 className="text-4xl font-bold">{receiver.name}</h1>
        <p className="text-lg text-gray-300">Ringing...</p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-20 flex items-center gap-8">
        <div className="flex flex-col items-center gap-2 opacity-70">
          <Button disabled className="w-16 h-16 rounded-full bg-white/20">
            <Mic className="w-8 h-8" />
          </Button>
          <span className="text-sm">Mute</span>
        </div>
        
        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={endCall}
            className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-400"
          >
            <PhoneOff className="w-10 h-10" />
          </Button>
          <span className="text-sm">Cancel</span>
        </div>

        <div className="flex flex-col items-center gap-2 opacity-70">
          <Button disabled className="w-16 h-16 rounded-full bg-white/20">
            <Video className="w-8 h-8" />
          </Button>
          <span className="text-sm">Video Off</span>
        </div>
      </div>
    </div>
  );
};

export default CallingScreen; 