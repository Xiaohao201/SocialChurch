import React from 'react';
import { useCall } from '@/context/CallContext';
import CallingScreen from './CallingScreen';
import IncomingCallScreen from './IncomingCallScreen';
import InCallScreen from './InCallScreen';

const VideoCallManager = () => {
  const { call, incomingCall, room } = useCall();

  if (room) {
    return <InCallScreen />;
  }

  if (incomingCall) {
    return <IncomingCallScreen />;
  }

  if (call && call.status === 'ringing') {
    return <CallingScreen />;
  }

  return null; // 没有通话时，不渲染任何东西
};

export default VideoCallManager; 