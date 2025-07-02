import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Room, connect, LocalTrack, RemoteParticipant, LocalVideoTrack, LocalAudioTrack } from 'twilio-video';
import { useUserContext } from './AuthContext';
import { functions, databases as db, client } from '@/lib/appwrite/config';
import { ID, Query } from 'appwrite';
import { appwriteConfig } from '@/lib/appwrite/config';
import { Models } from 'appwrite';
import { useToast } from '@/components/ui/use-toast';

// 定义通话文档的类型
export interface CallDocument {
  $id: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  status: 'ringing' | 'answered' | 'rejected' | 'ended' | 'missed' | 'canceled' | 'busy';
  type: 'video' | 'audio';
  channelName: string;
  startedAt?: string;
  endedAt?: string;
}

// 定义通话状态
interface CallState {
  call: CallDocument | null;          // 当前通话的文档信息
  incomingCall: CallDocument | null;  // 新的来电信息
  room: Room | null;                  // Twilio 的 Room 对象
  isConnecting: boolean;              // 是否正在连接到房间
  error: Error | null;
  networkQualityLevel: number | null; // 1 (poorest) to 5 (best)
  localTracks: LocalTrack[];
  participants: RemoteParticipant[];
}

// 定义 Context 提供的方法
interface CallContextType extends CallState {
  initiateCall: (receiverId: string, receiverName: string, receiverAvatar?: string) => Promise<void>;
  answerCall: (callDocument: CallDocument) => Promise<void>;
  rejectCall: (callDocument: CallDocument) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  switchCamera: () => Promise<void>;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isSwitchingCamera: boolean;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useUserContext();
  const { toast } = useToast();
  const [call, setCall] = useState<CallDocument | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallDocument | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [networkQualityLevel, setNetworkQualityLevel] = useState<number | null>(null);
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  // 清理通话状态
  const cleanupCall = useCallback(() => {
    if (room) {
      room.disconnect();
    }
    localTracks.forEach(track => {
      if (track.kind === 'audio' || track.kind === 'video') {
        track.stop();
      }
    });
    setCall(null);
    setIncomingCall(null);
    setRoom(null);
    setIsConnecting(false);
    setLocalTracks([]);
    setParticipants([]);
    setIsMuted(false);
    setIsVideoEnabled(true);
  }, [room, localTracks]);

  // 监听 Appwrite Realtime
  useEffect(() => {
    if (!user?.$id) return;

    const channel = `databases.${appwriteConfig.databaseId}.collections.${appwriteConfig.callsCollectionId}.documents`;
    const unsubscribe = client.subscribe(channel, response => {
      const payload = response.payload as CallDocument;
      
      // 1. 监听来电 (我是接收者，且状态是 ringing)
      if (response.events.includes('databases.*.collections.*.documents.*.create') && payload.receiverId === user.$id && payload.status === 'ringing') {
        // 如果正在通话中，自动拒接
        if (call) {
           db.updateDocument(appwriteConfig.databaseId, appwriteConfig.callsCollectionId, payload.$id, { status: 'busy' });
           return;
        }
        setIncomingCall(payload);
      }

      // 2. 监听当前通话的状态变更
      if (response.events.includes('databases.*.collections.*.documents.*.update') && call && payload.$id === call.$id) {
        const updatedCall = payload;
        setCall(updatedCall);

        if (['rejected', 'ended', 'missed', 'canceled'].includes(updatedCall.status)) {
          cleanupCall();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.$id, call, cleanupCall]);
  
  // 加入 Twilio 房间的辅助函数
  const joinRoom = async (callDoc: CallDocument) => {
    try {
      setIsConnecting(true);
      
      // 1. 从云函数获取 Token
      const execution = await functions.createExecution(
        appwriteConfig.generateTwilioTokenFunctionId,
        JSON.stringify({
          identity: user!.$id,
          roomName: callDoc.channelName,
        })
      );

      if (execution.status === 'failed') {
        throw new Error('Failed to create execution for Twilio token');
      }

      const result = JSON.parse(execution.responseBody);
      const token = result.token;

      // 2. 获取本地音视频轨道，并增加详细错误处理
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err: any) {
          console.error('getUserMedia error: ', err.name, err.message);
          let userMessage = 'Failed to access camera and microphone.';
          if (err.name === 'NotAllowedError') {
              userMessage = 'Permission to use camera and microphone was denied. Please allow access in your browser settings.';
          } else if (err.name === 'NotFoundError') {
              userMessage = 'No camera or microphone found. Please ensure your devices are connected and enabled.';
          }
          toast({
            title: "Media Device Error",
            description: userMessage,
            variant: "destructive",
          });
          setError(new Error(userMessage));
          throw new Error(userMessage); // 重新抛出错误，以停止后续流程
      }
      
      const tracks = [
          new LocalVideoTrack(stream.getVideoTracks()[0]),
          new LocalAudioTrack(stream.getAudioTracks()[0])
      ];
      setLocalTracks(tracks);

      // 3. 连接到 Twilio 房间
      const connectedRoom = await connect(token, {
        name: callDoc.channelName,
        tracks: tracks,
        networkQuality: { local: 1, remote: 1 },
      });

      setRoom(connectedRoom);
      setParticipants(Array.from(connectedRoom.participants.values()));
      
      // 正确的监听方式
      const localParticipant = connectedRoom.localParticipant;
      setNetworkQualityLevel(localParticipant.networkQualityLevel);
      localParticipant.on('networkQualityLevelChanged', (level) => {
        setNetworkQualityLevel(level);
      });
      
      connectedRoom.on('participantConnected', participant => {
        setParticipants(prev => [...prev, participant]);
      });
      connectedRoom.on('participantDisconnected', participant => {
        setParticipants(prev => prev.filter(p => p !== participant));
      });
      
      setCall(callDoc);
      
    } catch (err: any) {
      console.error("Failed to join Twilio room:", err);
      setError(err);
      cleanupCall();
      // 如果加入房间失败，也更新通话状态
      await db.updateDocument(appwriteConfig.databaseId, appwriteConfig.callsCollectionId, callDoc.$id, { status: 'ended' });
    } finally {
      setIsConnecting(false);
    }
  };

  // 发起通话
  const initiateCall = async (receiverId: string, receiverName: string, receiverAvatar?: string) => {
    if (!user) return;
    cleanupCall(); // 开始新通话前清理旧的

    try {
      // 检查对方是否正忙
      const busyQuery = await db.listDocuments(
        appwriteConfig.databaseId,
        appwriteConfig.callsCollectionId,
        [
          Query.or([
            Query.equal('callerId', receiverId),
            Query.equal('receiverId', receiverId)
          ]),
          Query.or([
            Query.equal('status', 'ringing'),
            Query.equal('status', 'answered')
          ])
        ]
      );

      if (busyQuery.total > 0) {
        console.log("Receiver is busy.");
        toast({
          title: "The user is busy",
          description: "Please try again later.",
          variant: "destructive",
        });
        setError(new Error("The other party is busy."));
        return;
      }
      
      const callId = ID.unique();
      const newCall: CallDocument = {
        $id: callId,
        callerId: user.$id,
        callerName: user.name,
        callerAvatar: user.imageUrl,
        receiverId: receiverId,
        receiverName: receiverName,
        receiverAvatar: receiverAvatar,
        status: 'ringing',
        type: 'video',
        channelName: callId, // 使用文档 ID 作为频道名
      };

      // 1. 在 Appwrite 中创建通话文档
      const createdDoc = await db.createDocument(
        appwriteConfig.databaseId,
        appwriteConfig.callsCollectionId,
        callId,
        { ...newCall, $id: undefined } // 创建时不能包含$id
      );

      // 2. 加入 Twilio 房间
      await joinRoom({ ...newCall, ...createdDoc });
      
    } catch (err: any) {
      console.error("Failed to initiate call:", err);
      setError(err);
    }
  };

  // 接听通话
  const answerCall = async (callDocument: CallDocument) => {
    if (!user) return;
    cleanupCall();
    
    try {
      // 1. 更新 Appwrite 文档状态
      const updatedDoc = await db.updateDocument(appwriteConfig.databaseId, appwriteConfig.callsCollectionId, callDocument.$id, {
        status: 'answered',
        startedAt: new Date().toISOString(),
      });
      
      // 2. 加入 Twilio 房间
      await joinRoom({ ...callDocument, ...updatedDoc });
      setIncomingCall(null);
      
    } catch (err: any) {
      console.error("Failed to answer call:", err);
      setError(err);
    }
  };
  
  // 拒绝通话 (接收方)
  const rejectCall = async (callDocument: CallDocument) => {
    try {
      await db.updateDocument(appwriteConfig.databaseId, appwriteConfig.callsCollectionId, callDocument.$id, {
        status: 'rejected',
        endedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to reject call:", err);
    } finally {
      setIncomingCall(null);
    }
  };

  // 结束通话 (通用)
  const endCall = async () => {
    if (!call) return;
    
    // 根据当前状态判断是取消还是结束
    const newStatus = call.status === 'ringing' ? 'canceled' : 'ended';
    
    try {
      await db.updateDocument(appwriteConfig.databaseId, appwriteConfig.callsCollectionId, call.$id, {
        status: newStatus,
        endedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to end call:", err);
    } finally {
      cleanupCall();
    }
  };

  const toggleMute = () => {
    const audioTrack = localTracks.find(track => track.kind === 'audio') as LocalAudioTrack;
    if (audioTrack) {
      if (isMuted) {
        audioTrack.enable();
      } else {
        audioTrack.disable();
      }
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    const videoTrack = localTracks.find(track => track.kind === 'video') as LocalVideoTrack;
    if (videoTrack) {
      if (isVideoEnabled) {
        videoTrack.disable();
      } else {
        videoTrack.enable();
      }
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const switchCamera = async () => {
    const videoTrack = localTracks.find(track => track.kind === 'video') as LocalVideoTrack;
    if (videoTrack && !isSwitchingCamera) {
      try {
        setIsSwitchingCamera(true);
        // Twilio SDK 没有直接获取当前 facingMode 的方法，我们假设用户在 user 和 environment 间切换
        // 实际上，更稳健的做法是检查可用的视频输入设备
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        if (videoDevices.length > 1) {
            // 找到当前轨道的 deviceId
            const currentDeviceId = videoTrack.mediaStreamTrack.getSettings().deviceId;
            // 找到不是当前设备的另一个设备
            const nextDevice = videoDevices.find(d => d.deviceId !== currentDeviceId);
            if (nextDevice) {
                await videoTrack.restart({
                    deviceId: { exact: nextDevice.deviceId }
                });
            }
        }
      } catch (err) {
        console.error("Failed to switch camera:", err);
      } finally {
        setIsSwitchingCamera(false);
      }
    }
  };

  const value: CallContextType = {
    call,
    incomingCall,
    room,
    isConnecting,
    error,
    networkQualityLevel,
    localTracks,
    participants,
    initiateCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    switchCamera,
    isMuted,
    isVideoEnabled,
    isSwitchingCamera,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}; 