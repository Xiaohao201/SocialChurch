import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  Image as ImageIcon, 
  File, 
  MapPin, 
  User, 
  X,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface AttachmentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAttachmentSelect: (type: AttachmentType, data: AttachmentData) => void;
}

export type AttachmentType = 'photo' | 'album' | 'file' | 'location' | 'contact';

export interface AttachmentData {
  type: AttachmentType;
  files?: File[];
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  contact?: {
    name: string;
    phone: string;
    email?: string;
  };
}

interface AttachmentOption {
  type: AttachmentType;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  description: string;
}

const attachmentOptions: AttachmentOption[] = [
  {
    type: 'photo',
    icon: Camera,
    label: '拍照',
    color: 'bg-blue-500',
    description: '拍摄照片或录制视频'
  },
  {
    type: 'album',
    icon: ImageIcon,
    label: '相册',
    color: 'bg-green-500',
    description: '选择照片或视频'
  },
  {
    type: 'file',
    icon: File,
    label: '文件',
    color: 'bg-purple-500',
    description: '选择文档'
  },
  {
    type: 'location',
    icon: MapPin,
    label: '位置',
    color: 'bg-red-500',
    description: '分享位置'
  },
  {
    type: 'contact',
    icon: User,
    label: '联系人',
    color: 'bg-yellow-500',
    description: '分享联系人'
  }
];

const AttachmentPanel: React.FC<AttachmentPanelProps> = ({
  isOpen,
  onClose,
  onAttachmentSelect
}) => {
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);

  // 处理点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (overlayRef.current && event.target === overlayRef.current) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // 处理拖拽关闭
  const handleMouseDown = (event: React.MouseEvent) => {
    setIsDragging(true);
    setDragY(event.clientY);
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!isDragging) return;
    const deltaY = event.clientY - dragY;
    if (deltaY > 0) {
      if (panelRef.current) {
        panelRef.current.style.transform = `translateY(${deltaY}px)`;
      }
    }
  };

  const handleMouseUp = (event: MouseEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const deltaY = event.clientY - dragY;
    
    if (deltaY > 100) {
      onClose();
    } else if (panelRef.current) {
      panelRef.current.style.transform = 'translateY(0px)';
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragY]);

  // 权限检查
  const checkPermission = async (type: AttachmentType): Promise<boolean> => {
    try {
      switch (type) {
        case 'photo':
          return await checkCameraPermission();
        case 'location':
          return await checkLocationPermission();
        default:
          return true;
      }
    } catch (error) {
      console.error(`Permission check failed for ${type}:`, error);
      return false;
    }
  };

  const checkCameraPermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "相机权限被拒绝",
        description: "请在浏览器设置中允许访问相机权限"
      });
      return false;
    }
  };

  const checkLocationPermission = async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "不支持位置服务",
        description: "您的浏览器不支持地理位置功能"
      });
      return false;
    }

    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          maximumAge: 300000,
          enableHighAccuracy: true
        });
      });
      return true;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "位置权限被拒绝",
        description: "请在浏览器设置中允许访问位置权限"
      });
      return false;
    }
  };

  // 处理附件选择
  const handleOptionClick = async (option: AttachmentOption) => {
    const hasPermission = await checkPermission(option.type);
    if (!hasPermission) return;

    try {
      switch (option.type) {
        case 'photo':
          await handlePhotoCapture();
          break;
        case 'album':
          await handleAlbumSelect();
          break;
        case 'file':
          await handleFileSelect();
          break;
        case 'location':
          await handleLocationShare();
          break;
        case 'contact':
          await handleContactShare();
          break;
      }
    } catch (error) {
      console.error(`Error handling ${option.type}:`, error);
      toast({
        variant: "destructive",
        title: "操作失败",
        description: `无法完成${option.label}操作，请重试`
      });
    }
  };

  const handlePhotoCapture = async () => {
    // 这里将调用 CameraCapture 组件
    console.log('Opening camera...');
    onClose();
  };

  const handleAlbumSelect = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    
    input.onchange = (event) => {
      const files = Array.from((event.target as HTMLInputElement).files || []);
      if (files.length > 9) {
        toast({
          variant: "destructive",
          title: "文件数量过多",
          description: "最多只能选择9个文件"
        });
        return;
      }
      
      onAttachmentSelect('album', { type: 'album', files });
      onClose();
    };
    
    input.click();
  };

  const handleFileSelect = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.txt';
    
    input.onchange = (event) => {
      const files = Array.from((event.target as HTMLInputElement).files || []);
      const file = files[0];
      
      if (file && file.size > 50 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "文件过大",
          description: "文件大小不能超过50MB"
        });
        return;
      }
      
      if (file) {
        onAttachmentSelect('file', { type: 'file', files: [file] });
        onClose();
      }
    };
    
    input.click();
  };

  const handleLocationShare = async () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onAttachmentSelect('location', {
          type: 'location',
          location: { latitude, longitude }
        });
        onClose();
      },
      (error) => {
        toast({
          variant: "destructive",
          title: "获取位置失败",
          description: "无法获取当前位置，请检查权限设置"
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleContactShare = async () => {
    // Web平台的联系人分享实现
    try {
      if (navigator.share) {
        await navigator.share({
          title: '分享联系人',
          text: '这是一个联系人信息'
        });
      } else {
        // 备用方案：手动输入联系人信息
        console.log('Opening contact input...');
      }
      onClose();
    } catch (error) {
      console.error('Contact share failed:', error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            ref={panelRef}
            className="absolute bottom-0 left-0 right-0 bg-dark-2 rounded-t-3xl border-t border-dark-4 shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onMouseDown={handleMouseDown}
          >
            {/* 拖拽指示器 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1 bg-dark-4 rounded-full cursor-grab active:cursor-grabbing" />
            </div>

            {/* 标题栏 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-dark-4">
              <h3 className="text-lg font-semibold text-light-1">选择附件</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-light-2 hover:text-light-1"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* 附件选项网格 */}
            <div className="p-6 pb-8">
              <div className="grid grid-cols-3 gap-4">
                {attachmentOptions.map((option) => {
                  const IconComponent = option.icon;
                  return (
                    <motion.button
                      key={option.type}
                      onClick={() => handleOptionClick(option)}
                      className="flex flex-col items-center gap-3 p-4 rounded-xl bg-dark-3 hover:bg-dark-4 transition-all duration-200 group"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className={`w-12 h-12 ${option.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-light-1">{option.label}</p>
                        <p className="text-xs text-light-4 mt-1">{option.description}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* 安全区域 */}
            <div className="h-safe-area-inset-bottom" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AttachmentPanel; 