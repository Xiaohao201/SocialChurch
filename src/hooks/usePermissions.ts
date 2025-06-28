import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

export type PermissionType = 'camera' | 'microphone' | 'location' | 'notifications';

interface PermissionState {
  [key: string]: 'granted' | 'denied' | 'prompt' | 'unknown';
}

export const usePermissions = () => {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<PermissionState>({});
  const [isRequesting, setIsRequesting] = useState<{[key: string]: boolean}>({});

  const requestPermission = useCallback(async (type: PermissionType): Promise<boolean> => {
    if (isRequesting[type]) return false;
    
    setIsRequesting(prev => ({ ...prev, [type]: true }));
    
    try {
      switch (type) {
        case 'camera':
          return await requestCameraPermission();
        case 'microphone':
          return await requestMicrophonePermission();
        case 'location':
          return await requestLocationPermission();
        case 'notifications':
          return await requestNotificationPermission();
        default:
          return false;
      }
    } catch (error) {
      console.error(`Permission request failed for ${type}:`, error);
      showPermissionError(type);
      return false;
    } finally {
      setIsRequesting(prev => ({ ...prev, [type]: false }));
    }
  }, [isRequesting]);

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      stream.getTracks().forEach(track => track.stop());
      setPermissions(prev => ({ ...prev, camera: 'granted' }));
      return true;
    } catch (error: any) {
      const errorType = error.name || 'UnknownError';
      setPermissions(prev => ({ ...prev, camera: 'denied' }));
      
      if (errorType === 'NotAllowedError') {
        showPermissionError('camera');
      } else if (errorType === 'NotFoundError') {
        toast({
          variant: "destructive",
          title: "未找到摄像头",
          description: "请确保您的设备已连接摄像头"
        });
      }
      return false;
    }
  };

  const requestMicrophonePermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissions(prev => ({ ...prev, microphone: 'granted' }));
      return true;
    } catch (error) {
      setPermissions(prev => ({ ...prev, microphone: 'denied' }));
      showPermissionError('microphone');
      return false;
    }
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    if (!navigator.geolocation) {
      setPermissions(prev => ({ ...prev, location: 'denied' }));
      toast({
        variant: "destructive",
        title: "不支持位置服务",
        description: "您的浏览器不支持地理位置功能"
      });
      return false;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          setPermissions(prev => ({ ...prev, location: 'granted' }));
          resolve(true);
        },
        (error) => {
          setPermissions(prev => ({ ...prev, location: 'denied' }));
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              showPermissionError('location');
              break;
            case error.POSITION_UNAVAILABLE:
              toast({
                variant: "destructive",
                title: "位置不可用",
                description: "无法获取您的位置信息"
              });
              break;
            case error.TIMEOUT:
              toast({
                variant: "destructive",
                title: "位置获取超时",
                description: "获取位置信息超时，请重试"
              });
              break;
          }
          resolve(false);
        },
        { 
          timeout: 10000,
          enableHighAccuracy: true,
          maximumAge: 300000
        }
      );
    });
  };

  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      setPermissions(prev => ({ ...prev, notifications: 'denied' }));
      toast({
        variant: "destructive",
        title: "不支持通知",
        description: "您的浏览器不支持推送通知"
      });
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      const normalizedPermission = permission === 'default' ? 'prompt' : permission as 'granted' | 'denied';
      setPermissions(prev => ({ ...prev, notifications: normalizedPermission }));
      
      if (permission === 'denied') {
        showPermissionError('notifications');
        return false;
      }
      
      return permission === 'granted';
    } catch (error) {
      setPermissions(prev => ({ ...prev, notifications: 'denied' }));
      showPermissionError('notifications');
      return false;
    }
  };

  const showPermissionError = (type: PermissionType) => {
    const messages = {
      camera: {
        title: '相机权限被拒绝',
        description: '请在浏览器设置中允许访问相机权限，然后刷新页面重试'
      },
      microphone: {
        title: '麦克风权限被拒绝',
        description: '请在浏览器设置中允许访问麦克风权限，然后刷新页面重试'
      },
      location: {
        title: '位置权限被拒绝',
        description: '请在浏览器设置中允许访问位置信息，然后重试'
      },
      notifications: {
        title: '通知权限被拒绝',
        description: '请在浏览器设置中允许推送通知，然后重试'
      }
    };

    toast({
      variant: "destructive",
      title: messages[type].title,
      description: messages[type].description,
      duration: 5000
    });
  };

  const checkPermission = useCallback((type: PermissionType): 'granted' | 'denied' | 'prompt' | 'unknown' => {
    return permissions[type] || 'unknown';
  }, [permissions]);

  const hasPermission = useCallback((type: PermissionType): boolean => {
    return permissions[type] === 'granted';
  }, [permissions]);

  const revokePermission = useCallback((type: PermissionType) => {
    setPermissions(prev => ({ ...prev, [type]: 'denied' }));
  }, []);

  return {
    permissions,
    isRequesting,
    requestPermission,
    checkPermission,
    hasPermission,
    revokePermission,
    showPermissionError
  };
}; 