import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  X, 
  RotateCcw, 
  Download, 
  Send,
  Video,
  Square,
  Circle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File, type: 'photo' | 'video') => void;
  maxVideoDuration?: number; // 秒
}

type CaptureMode = 'photo' | 'video';
type CameraState = 'idle' | 'recording' | 'preview';

const CameraCapture: React.FC<CameraCaptureProps> = ({
  isOpen,
  onClose,
  onCapture,
  maxVideoDuration = 15
}) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('photo');
  const [recordingTime, setRecordingTime] = useState(0);
  const [capturedMedia, setCapturedMedia] = useState<{
    url: string;
    type: 'photo' | 'video';
    blob: Blob;
  } | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // 录制计时器
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cameraState === 'recording') {
      interval = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxVideoDuration) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setRecordingTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cameraState, maxVideoDuration]);

  // 初始化相机
  useEffect(() => {
    if (isOpen) {
      initializeCamera();
    } else {
      cleanup();
    }

    return cleanup;
  }, [isOpen, facingMode]);

  const initializeCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: captureMode === 'video'
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setCameraState('idle');
    } catch (error) {
      console.error('Camera initialization failed:', error);
      toast({
        variant: "destructive",
        title: "相机初始化失败",
        description: "无法访问相机，请检查权限设置"
      });
      onClose();
    }
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    recordedChunksRef.current = [];
    setCameraState('idle');
    setCapturedMedia(null);
    setRecordingTime(0);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // 设置画布尺寸
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // 绘制视频帧到画布
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 转换为Blob
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setCapturedMedia({
          url,
          type: 'photo',
          blob
        });
        setCameraState('preview');
      }
    }, 'image/jpeg', 0.9);
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9'
      });

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: 'video/webm'
        });
        const url = URL.createObjectURL(blob);
        setCapturedMedia({
          url,
          type: 'video',
          blob
        });
        setCameraState('preview');
      };

      mediaRecorder.start();
      setCameraState('recording');
    } catch (error) {
      console.error('Recording failed:', error);
      toast({
        variant: "destructive",
        title: "录制失败",
        description: "无法开始录制，请重试"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && cameraState === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCapture = () => {
    if (captureMode === 'photo') {
      capturePhoto();
    } else {
      if (cameraState === 'recording') {
        stopRecording();
      } else {
        startRecording();
      }
    }
  };

  const handleSend = () => {
    if (capturedMedia) {
      // 创建File对象
      const file = new File([capturedMedia.blob], 
        `${capturedMedia.type}_${Date.now()}.${capturedMedia.type === 'photo' ? 'jpg' : 'webm'}`,
        { type: capturedMedia.blob.type }
      );
      
      onCapture(file, capturedMedia.type);
      onClose();
    }
  };

  const handleRetake = () => {
    if (capturedMedia) {
      URL.revokeObjectURL(capturedMedia.url);
      setCapturedMedia(null);
    }
    setCameraState('idle');
    setRecordingTime(0);
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="relative w-full h-full overflow-hidden">
            {/* 视频预览 */}
            {cameraState !== 'preview' && (
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
              />
            )}

            {/* 拍照结果预览 */}
            {cameraState === 'preview' && capturedMedia && (
              <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-black">
                {capturedMedia.type === 'photo' ? (
                  <img 
                    src={capturedMedia.url} 
                    alt="Captured photo"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <video
                    src={capturedMedia.url}
                    controls
                    className="max-w-full max-h-full object-contain"
                    autoPlay
                    loop
                  />
                )}
              </div>
            )}

            {/* 隐藏的画布用于拍照 */}
            <canvas ref={canvasRef} className="hidden" />

            {/* 顶部控制栏 */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/50 to-transparent">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-6 h-6" />
                </Button>

                {cameraState === 'recording' && (
                  <div className="flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full">
                    <Circle className="w-3 h-3 fill-white animate-pulse" />
                    <span className="text-sm font-medium">
                      {formatTime(recordingTime)} / {formatTime(maxVideoDuration)}
                    </span>
                  </div>
                )}

                {cameraState !== 'preview' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={switchCamera}
                    className="text-white hover:bg-white/20"
                  >
                    <RotateCcw className="w-6 h-6" />
                  </Button>
                )}
              </div>
            </div>

            {/* 模式切换 */}
            {cameraState === 'idle' && (
              <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-10">
                <div className="flex bg-black/50 rounded-full p-1">
                  <button
                    onClick={() => setCaptureMode('photo')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      captureMode === 'photo' 
                        ? 'bg-white text-black' 
                        : 'text-white hover:bg-white/20'
                    }`}
                  >
                    拍照
                  </button>
                  <button
                    onClick={() => setCaptureMode('video')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      captureMode === 'video' 
                        ? 'bg-white text-black' 
                        : 'text-white hover:bg-white/20'
                    }`}
                  >
                    录像
                  </button>
                </div>
              </div>
            )}

            {/* 底部控制栏 */}
            <div className="absolute bottom-0 left-0 right-0 z-10 p-6 bg-gradient-to-t from-black/50 to-transparent">
              {cameraState === 'preview' ? (
                /* 预览模式控制 */
                <div className="flex items-center justify-center gap-8">
                  <Button
                    variant="ghost"
                    onClick={handleRetake}
                    className="text-white hover:bg-white/20 h-14 px-6"
                  >
                    <RotateCcw className="w-6 h-6 mr-2" />
                    重拍
                  </Button>
                  <Button
                    onClick={handleSend}
                    className="bg-primary-500 hover:bg-primary-600 text-white h-14 px-8"
                  >
                    <Send className="w-6 h-6 mr-2" />
                    发送
                  </Button>
                </div>
              ) : (
                /* 拍摄模式控制 */
                <div className="flex items-center justify-center">
                  <motion.button
                    onClick={handleCapture}
                    className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center ${
                      cameraState === 'recording' 
                        ? 'bg-red-500' 
                        : 'bg-white/20 hover:bg-white/30'
                    } transition-all`}
                    whileTap={{ scale: 0.9 }}
                  >
                    {captureMode === 'photo' ? (
                      <Camera className="w-8 h-8 text-white" />
                    ) : cameraState === 'recording' ? (
                      <Square className="w-6 h-6 text-white" />
                    ) : (
                      <Video className="w-8 h-8 text-white" />
                    )}
                  </motion.button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CameraCapture; 