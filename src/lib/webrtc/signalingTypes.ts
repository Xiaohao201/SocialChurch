// 通用信令消息接口
export interface BaseSignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'call-start' | 'call-end' | 'call-reject' | 'call-accept' | 'video-toggle' | 'audio-toggle';
  payload?: any;
  from: string;
  to: string;
  timestamp?: number;
  callerName?: string;
  callerAvatar?: string;
}

// 语音通话消息（向后兼容）
export interface CallMessage extends BaseSignalMessage {}

// 视频通话消息
export interface VideoCallMessage extends BaseSignalMessage {}

// 统一的信令回调类型
export type SignalingCallback = (message: BaseSignalMessage) => void; 