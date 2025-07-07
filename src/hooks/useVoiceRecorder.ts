import { useState, useRef, useCallback } from 'react';

export interface VoiceRecorderState {
  isRecording: boolean;
  duration: number;
  isPermissionGranted: boolean;
  error: string | null;
  audioBlob: Blob | null;
}

export interface VoiceRecorderActions {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  requestPermission: () => Promise<boolean>;
  clearAudioBlob: () => void;
}

const MIN_RECORDING_DURATION = 1000; // 1 second
const MAX_RECORDING_DURATION = 60000; // 60 seconds

// Check browser compatibility
const checkBrowserSupport = (): { supported: boolean; error?: string } => {
  if (!navigator.mediaDevices) {
    return { supported: false, error: '您的浏览器不支持录音功能，请使用现代浏览器' };
  }
  
  if (!navigator.mediaDevices.getUserMedia) {
    return { supported: false, error: '您的浏览器不支持麦克风访问，请更新浏览器' };
  }
  
  if (!window.MediaRecorder) {
    return { supported: false, error: '您的浏览器不支持录音API，请使用Chrome、Firefox或Safari' };
  }
  
  return { supported: true };
};

// Get supported MIME types
const getSupportedMimeType = (): string => {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav'
  ];
  
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log('🎤 Using MIME type:', type);
      return type;
    }
  }
  
  console.warn('⚠️ No preferred MIME type supported, using default');
  return '';
};

export const useVoiceRecorder = (): [VoiceRecorderState, VoiceRecorderActions] => {
  const [state, setState] = useState<VoiceRecorderState>({
    isRecording: false,
    duration: 0,
    isPermissionGranted: false,
    error: null,
    audioBlob: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioChunksRef = useRef<Blob[]>([]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Check browser support first
      const browserCheck = checkBrowserSupport();
      if (!browserCheck.supported) {
        setState(prev => ({ 
          ...prev, 
          isPermissionGranted: false, 
          error: browserCheck.error || null 
        }));
        return false;
      }

      console.log('🎤 Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        }
      });
      
      // Stop the stream immediately after permission check
      stream.getTracks().forEach(track => track.stop());
      
      console.log('✅ Microphone permission granted');
      setState(prev => ({ ...prev, isPermissionGranted: true, error: null }));
      return true;
    } catch (error: any) {
      console.error('❌ Microphone permission denied:', error);
      let errorMessage = '无法访问麦克风';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '未找到麦克风设备，请检查设备连接';
      } else if (error.name === 'NotReadableError') {
        errorMessage = '麦克风被其他应用占用，请关闭其他录音应用';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = '麦克风不支持请求的音频格式';
      }
      
      setState(prev => ({ 
        ...prev, 
        isPermissionGranted: false, 
        error: errorMessage 
      }));
      return false;
    }
  }, []);

  const clearAudioBlob = useCallback((): void => {
    setState(prev => ({ ...prev, audioBlob: null }));
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      console.log('🎤 Starting voice recording...');
      
      // Clear previous error and audio blob
      setState(prev => ({ ...prev, error: null, audioBlob: null, duration: 0 }));

      // Check browser support
      const browserCheck = checkBrowserSupport();
      if (!browserCheck.supported) {
        setState(prev => ({ 
          ...prev, 
          error: browserCheck.error || null,
          isRecording: false 
        }));
        return;
      }

      // Request permission if not granted
      if (!state.isPermissionGranted) {
        const granted = await requestPermission();
        if (!granted) return;
      }

      // Get media stream
      console.log('🎤 Getting media stream...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        }
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      // Get supported MIME type
      const mimeType = getSupportedMimeType();
      
      // Create MediaRecorder with appropriate options
      const options: MediaRecorderOptions = {};
      if (mimeType) {
        options.mimeType = mimeType;
      }
      
      console.log('🎤 Creating MediaRecorder with options:', options);
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        console.log('📊 Data available:', event.data.size, 'bytes');
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('🛑 Recording stopped, creating blob...');
        const finalMimeType = mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
        console.log('✅ Audio blob created:', audioBlob.size, 'bytes, type:', audioBlob.type);
        setState(prev => ({ ...prev, audioBlob }));
        
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('❌ MediaRecorder error:', event.error);
        setState(prev => ({ 
          ...prev, 
          error: '录音过程中发生错误：' + event.error?.message || '未知错误',
          isRecording: false 
        }));
      };

      // Start recording
      console.log('▶️ Starting MediaRecorder...');
      mediaRecorder.start(100); // Collect data every 100ms
      startTimeRef.current = Date.now();

      setState(prev => ({ ...prev, isRecording: true, duration: 0 }));

      // Start duration counter
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setState(prev => ({ ...prev, duration: elapsed }));

        // Auto-stop at max duration
        if (elapsed >= MAX_RECORDING_DURATION) {
          console.log('⏰ Max duration reached, stopping recording');
          stopRecording();
        }
      }, 100);

      console.log('✅ Recording started successfully');

    } catch (error: any) {
      console.error('❌ Failed to start recording:', error);
      let errorMessage = '录音失败';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = '麦克风权限被拒绝，请允许网站访问麦克风';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '未找到麦克风设备';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = '浏览器不支持录音功能';
      } else {
        errorMessage = '录音失败：' + (error.message || '未知错误');
      }
      
      setState(prev => ({ 
        ...prev, 
        error: errorMessage,
        isRecording: false 
      }));
    }
  }, [state.isPermissionGranted, requestPermission]);

  const stopRecording = useCallback((): void => {
    console.log('🛑 Stopping recording...');
    
    if (!mediaRecorderRef.current || !state.isRecording) {
      console.log('⚠️ No active recording to stop');
      return;
    }

    const duration = Date.now() - startTimeRef.current;

    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Check minimum duration
    if (duration < MIN_RECORDING_DURATION) {
      console.log('⚠️ Recording too short:', duration, 'ms');
      
      // Cancel the recording without setting error
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      setState(prev => ({ 
        ...prev, 
        isRecording: false,
        duration: 0
      }));
      return;
    }

    // Stop recording
    if (mediaRecorderRef.current.state === 'recording') {
      console.log('⏹️ Stopping MediaRecorder...');
      mediaRecorderRef.current.stop();
    }
    
    setState(prev => ({ ...prev, isRecording: false }));
    console.log('✅ Recording stopped successfully');
  }, [state.isRecording]);

  const cancelRecording = useCallback((): void => {
    console.log('❌ Cancelling recording...');
    
    if (!state.isRecording) return;

    // Clear duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Stop and cleanup
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setState(prev => ({ 
      ...prev, 
      isRecording: false, 
      duration: 0,
      audioBlob: null,
      error: null
    }));
    
    console.log('✅ Recording cancelled');
  }, [state.isRecording]);

  return [
    state,
    {
      startRecording,
      stopRecording,
      cancelRecording,
      requestPermission,
      clearAudioBlob,
    }
  ];
}; 