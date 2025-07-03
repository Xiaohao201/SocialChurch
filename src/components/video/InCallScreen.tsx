import React, { useEffect, useRef, useState } from 'react';
import { useCall } from '@/context/CallContext';
import { LocalVideoTrack, RemoteParticipant, RemoteVideoTrack } from 'twilio-video';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Camera } from 'lucide-react';
import Draggable from 'react-draggable';

// 子组件：渲染单个参与者的视频
const Participant = ({ participant }: { participant: RemoteParticipant }) => {
  const [videoTrack, setVideoTrack] = useState<RemoteVideoTrack | null>(null);
  const [audioTrack, setAudioTrack] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const trackSubscribed = (track: any) => {
      if (track.kind === 'video') {
        setVideoTrack(track);
      } else if (track.kind === 'audio') {
        setAudioTrack(track);
      }
    };
    const trackUnsubscribed = (track: any) => {
      if (track.kind === 'video') {
        setVideoTrack(null);
      } else if (track.kind === 'audio') {
        setAudioTrack(null);
      }
    };

    participant.on('trackSubscribed', trackSubscribed);
    participant.on('trackUnsubscribed', trackUnsubscribed);
    
    // 初始时检查已有的轨道
    const initialVideoTrack = Array.from(participant.videoTracks.values())[0]?.track;
    if(initialVideoTrack) setVideoTrack(initialVideoTrack as RemoteVideoTrack);
    
    const initialAudioTrack = Array.from(participant.audioTracks.values())[0]?.track;
    if(initialAudioTrack) setAudioTrack(initialAudioTrack);

    return () => {
      participant.off('trackSubscribed', trackSubscribed);
      participant.off('trackUnsubscribed', trackUnsubscribed);
    };
  }, [participant]);

  useEffect(() => {
    if (videoTrack && videoRef.current) {
      videoTrack.attach(videoRef.current);
    }
    return () => {
      videoTrack?.detach();
    };
  }, [videoTrack]);
  
  useEffect(() => {
    if (audioTrack && audioRef.current) {
      audioTrack.attach(audioRef.current);
    }
    return () => {
      audioTrack?.detach();
    };
  }, [audioTrack]);

  return (
    <div className="w-full h-full bg-black">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <audio ref={audioRef} autoPlay playsInline />
    </div>
  );
};

// 子组件：渲染本地视频
const LocalVideoPlayer = ({ track }: { track: LocalVideoTrack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      track.attach(videoRef.current);
    }
    return () => {
      track.detach();
    };
  }, [track]);

  return <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />;
};


const InCallScreen = () => {
  const { 
    room, 
    localTracks, 
    participants, 
    endCall, 
    toggleMute, 
    toggleVideo, 
    switchCamera,
    isMuted, 
    isVideoEnabled,
    isSwitchingCamera,
    networkQualityLevel
  } = useCall();
  const [showControls, setShowControls] = useState(true);

  const localVideoTrack = localTracks.find(track => track.kind === 'video') as LocalVideoTrack | undefined;
  const remoteParticipant = participants[0];

  return (
    <div className="fixed inset-0 bg-black z-50 text-white" onClick={() => setShowControls(prev => !prev)}>
      {/* Network Quality Indicator */}
      {networkQualityLevel !== null && networkQualityLevel < 3 && (
        <div className="absolute top-0 left-0 right-0 p-2 bg-yellow-600/80 text-center text-sm">
          Network connection is unstable...
        </div>
      )}

      {/* Remote Video */}
      <div className="w-full h-full">
        {remoteParticipant ? (
          <Participant participant={remoteParticipant} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <p>Waiting for participant...</p>
          </div>
        )}
      </div>

      {/* Local Video (Draggable) */}
      <Draggable>
        <div className="absolute top-4 right-4 w-32 h-48 md:w-40 md:h-60 rounded-lg overflow-hidden border-2 border-white/50 cursor-move shadow-lg">
          {localVideoTrack && isVideoEnabled ? (
            <LocalVideoPlayer track={localVideoTrack} />
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <VideoOff className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>
      </Draggable>

      {/* Controls */}
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
          <div className="max-w-md mx-auto flex justify-around items-center bg-black/30 backdrop-blur-md rounded-full p-3">
            <Button onClick={toggleMute} variant="ghost" className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30">
              {isMuted ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </Button>
            <Button onClick={toggleVideo} variant="ghost" className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30">
              {isVideoEnabled ? <Video className="w-8 h-8" /> : <VideoOff className="w-8 h-8" />}
            </Button>
            <Button onClick={switchCamera} disabled={isSwitchingCamera} variant="ghost" className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30">
              <Camera className="w-8 h-8" />
            </Button>
            <Button onClick={endCall} className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700">
              <PhoneOff className="w-10 h-10" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InCallScreen; 