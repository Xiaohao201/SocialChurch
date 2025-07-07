import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

const VoiceDebugPanel: React.FC = () => {
  const [voiceState, voiceActions] = useVoiceRecorder();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    // Check browser capabilities
    const checkCapabilities = () => {
      const info = {
        mediaDevicesSupported: !!navigator.mediaDevices,
        getUserMediaSupported: !!navigator.mediaDevices?.getUserMedia,
        mediaRecorderSupported: !!window.MediaRecorder,
        isSecureContext: window.isSecureContext,
        protocol: window.location.protocol,
        userAgent: navigator.userAgent,
        supportedMimeTypes: [] as string[],
        permissions: null,
      };

      // Check supported MIME types
      if (window.MediaRecorder) {
        const types = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/ogg;codecs=opus',
          'audio/wav'
        ];
        
        info.supportedMimeTypes = types.filter(type => 
          MediaRecorder.isTypeSupported(type)
        );
      }

      setDebugInfo(info);
    };

    checkCapabilities();
  }, []);

  const testPermission = async () => {
    try {
      const result = await voiceActions.requestPermission();
      console.log('Permission test result:', result);
    } catch (error) {
      console.error('Permission test failed:', error);
    }
  };

  const testRecording = async () => {
    try {
      await voiceActions.startRecording();
      setTimeout(() => {
        voiceActions.stopRecording();
      }, 2000);
    } catch (error) {
      console.error('Recording test failed:', error);
    }
  };

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-dark-2 border border-light-3 dark:border-dark-3 rounded-lg p-4 shadow-lg z-50 max-w-sm">
      <div className="text-sm space-y-3">
        <div className="font-semibold text-primary-500 mb-2">🎤 语音调试面板</div>
        
        {/* Browser Support */}
        <div className="space-y-1">
          <div className="font-medium">浏览器支持:</div>
          <div className={`text-xs ${debugInfo.mediaDevicesSupported ? 'text-green-600' : 'text-red-600'}`}>
            MediaDevices: {debugInfo.mediaDevicesSupported ? '✅' : '❌'}
          </div>
          <div className={`text-xs ${debugInfo.getUserMediaSupported ? 'text-green-600' : 'text-red-600'}`}>
            getUserMedia: {debugInfo.getUserMediaSupported ? '✅' : '❌'}
          </div>
          <div className={`text-xs ${debugInfo.mediaRecorderSupported ? 'text-green-600' : 'text-red-600'}`}>
            MediaRecorder: {debugInfo.mediaRecorderSupported ? '✅' : '❌'}
          </div>
          <div className={`text-xs ${debugInfo.isSecureContext ? 'text-green-600' : 'text-red-600'}`}>
            Secure Context: {debugInfo.isSecureContext ? '✅' : '❌'} ({debugInfo.protocol})
          </div>
        </div>

        {/* MIME Types */}
        <div className="space-y-1">
          <div className="font-medium">支持的音频格式:</div>
          {debugInfo.supportedMimeTypes?.length > 0 ? (
            debugInfo.supportedMimeTypes.map((type: string) => (
              <div key={type} className="text-xs text-green-600">✅ {type}</div>
            ))
          ) : (
            <div className="text-xs text-red-600">❌ 无支持的格式</div>
          )}
        </div>

        {/* Voice State */}
        <div className="space-y-1">
          <div className="font-medium">录音状态:</div>
          <div className="text-xs">
            权限: {voiceState.isPermissionGranted ? '✅ 已获取' : '❌ 未获取'}
          </div>
          <div className="text-xs">
            录制中: {voiceState.isRecording ? '🔴 是' : '⚪ 否'}
          </div>
          <div className="text-xs">
            时长: {voiceState.duration}ms
          </div>
          <div className="text-xs">
            音频: {voiceState.audioBlob ? `✅ ${voiceState.audioBlob.size} bytes` : '❌ 无'}
          </div>
          {voiceState.error && (
            <div className="text-xs text-red-600">
              错误: {voiceState.error}
            </div>
          )}
        </div>

        {/* Test Buttons */}
        <div className="space-y-2">
          <Button 
            onClick={testPermission}
            size="sm"
            className="w-full text-xs"
          >
            测试权限
          </Button>
          <Button 
            onClick={testRecording}
            size="sm"
            className="w-full text-xs"
            disabled={!voiceState.isPermissionGranted}
          >
            测试录音 (2秒)
          </Button>
        </div>

        {/* Browser Info */}
        <div className="text-xs text-gray-500 border-t pt-2">
          <div>浏览器: {debugInfo.userAgent?.split(' ')[0] || 'Unknown'}</div>
        </div>
      </div>
    </div>
  );
};

export default VoiceDebugPanel; 