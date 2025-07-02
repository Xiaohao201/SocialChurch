import React from 'react';
import { useCall } from '@/context/CallContext';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff } from 'lucide-react';

const IncomingCallScreen = () => {
  const { incomingCall, answerCall, rejectCall } = useCall();

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-md z-50 flex flex-col items-center justify-center text-white transition-opacity duration-300">
      {/* Caller Info */}
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <img
          src={incomingCall.callerAvatar || '/assets/icons/profile-placeholder.svg'}
          alt={incomingCall.callerName}
          className="w-32 h-32 rounded-full border-4 border-white shadow-lg"
        />
        <h1 className="text-4xl font-bold">{incomingCall.callerName}</h1>
        <p className="text-lg text-gray-300">is inviting you to a video call...</p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-20 flex items-center gap-16">
        {/* Decline Button */}
        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={() => rejectCall(incomingCall)}
            className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-400"
          >
            <PhoneOff className="w-10 h-10" />
          </Button>
          <span className="text-sm">Decline</span>
        </div>

        {/* Answer Button */}
        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={() => answerCall(incomingCall)}
            className="w-20 h-20 rounded-full bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-400"
          >
            <Phone className="w-10 h-10" />
          </Button>
          <span className="text-sm">Answer</span>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallScreen; 