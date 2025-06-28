import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ImagePreview from './ImagePreview';
import { 
  Download, 
  Image as ImageIcon, 
  Video, 
  Music, 
  X,
  Play,
  Clock,
  Headphones
} from 'lucide-react';

interface FileData {
  name: string;
  size: number;
  type: string;
  url?: string;
  file?: File;
  base64?: string;
  duration?: string;
  thumbnail?: string;
}

interface ImprovedMediaMessageProps {
  fileData: FileData;
  isMyMessage: boolean;
  onDownload?: (fileData: FileData) => void;
  onPreview?: (fileData: FileData) => void;
}

const ImprovedMediaMessage: React.FC<ImprovedMediaMessageProps> = ({ 
  fileData, 
  isMyMessage, 
  onDownload, 
  onPreview 
}) => {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getAudioTypeName = (type: string, filename: string) => {
    if (type.includes('mp3') || filename.toLowerCase().endsWith('.mp3')) return 'MP3音频';
    if (type.includes('wav') || filename.toLowerCase().endsWith('.wav')) return 'WAV音频';
    if (type.includes('m4a') || filename.toLowerCase().endsWith('.m4a')) return 'M4A音频';
    if (type.includes('ogg') || filename.toLowerCase().endsWith('.ogg')) return 'OGG音频';
    return '音频文件';
  };

  const createPreviewUrl = () => {
    if (fileData.file && fileData.file instanceof File) {
      try {
        return URL.createObjectURL(fileData.file);
      } catch (error) {
        console.error('创建预览URL失败:', error);
        return null;
      }
    } else if (fileData.base64) {
      return fileData.base64;
    } else if (fileData.url) {
      return fileData.url;
    }
    return null;
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      
      const downloadUrl = createPreviewUrl();
      if (!downloadUrl) {
        toast({
          title: '无法下载文件',
          description: '该文件暂无可下载的内容',
          variant: 'destructive',
        });
        setIsDownloading(false);
        return;
      }
      
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            setIsDownloading(false);
            
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileData.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            if (fileData.file && downloadUrl.startsWith('blob:')) {
              URL.revokeObjectURL(downloadUrl);
            }
            
            toast({
              title: '下载完成',
              description: `${fileData.name} 已下载到本地`,
            });
            return 100;
          }
          return prev + 10;
        });
      }, 100);

      if (onDownload) {
        onDownload(fileData);
      }
      
    } catch (error) {
      console.error('下载失败:', error);
      setIsDownloading(false);
      toast({
        title: '下载失败',
        description: '文件下载失败，请重试',
        variant: 'destructive',
      });
    }
  };

  const handlePreview = () => {
    if (fileData.type.startsWith('image/') || fileData.type.startsWith('video/')) {
      setShowPreview(true);
      if (onPreview) {
        onPreview(fileData);
      }
    }
  };

  useEffect(() => {
    const url = createPreviewUrl();
    if (url) {
      setPreviewUrl(url);
    }
    
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [fileData]);

  const renderImageComponent = () => (
    <div className="relative group cursor-pointer max-w-sm" onClick={handlePreview}>
      <div className="relative overflow-hidden rounded-2xl shadow-md hover:shadow-lg transition-all duration-200">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={fileData.name}
            className="w-full h-auto max-h-80 object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
            <div className="text-center">
              <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">图片加载中...</p>
            </div>
          </div>
        )}
        
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-end justify-end p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
            className="w-10 h-10 bg-white/90 hover:bg-white text-gray-700 hover:text-gray-900 rounded-full p-0 shadow-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-2 group-hover:translate-y-0"
            title="下载图片"
          >
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <p className="text-white text-sm font-medium truncate">{fileData.name}</p>
          <p className="text-white/80 text-xs">{formatFileSize(fileData.size)}</p>
        </div>
      </div>
    </div>
  );

  const renderVideoComponent = () => (
    <div className="relative group cursor-pointer max-w-sm" onClick={handlePreview}>
      <div className="relative overflow-hidden rounded-2xl shadow-md hover:shadow-lg transition-all duration-200">
        <div className="relative h-48 bg-gradient-to-br from-gray-800 to-gray-900">
          {previewUrl ? (
            <video
              src={previewUrl}
              className="w-full h-full object-cover"
              poster={fileData.thumbnail}
              preload="metadata"
              muted
            />
          ) : fileData.thumbnail ? (
            <img
              src={fileData.thumbnail}
              alt={fileData.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900/30 to-purple-900/30">
              <div className="text-center">
                <Video className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-300 text-sm truncate px-4">{fileData.name}</p>
              </div>
            </div>
          )}
          
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 flex items-center justify-center transition-all duration-200">
            <div className="w-16 h-16 bg-white/25 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shadow-lg border border-white/20">
              <Play className="w-8 h-8 text-white ml-1 drop-shadow-lg" />
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
            className="absolute top-3 right-3 w-9 h-9 bg-black/50 hover:bg-black/70 text-white rounded-full p-0 transition-all shadow-md opacity-0 group-hover:opacity-100"
            title="下载视频"
          >
            {isDownloading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </Button>
          
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
            {fileData.duration && (
              <div className="bg-black/75 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {fileData.duration}
              </div>
            )}
            
            <div className="bg-black/75 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
              {formatFileSize(fileData.size)}
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <p className="text-white text-sm font-medium truncate">{fileData.name}</p>
        </div>
      </div>
    </div>
  );

  const renderAudioComponent = () => (
    <div className={`p-4 max-w-xs rounded-2xl transition-all duration-200 ${
      isMyMessage 
        ? 'bg-primary-500 text-white' 
        : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
          isMyMessage ? 'bg-white/20' : 'bg-green-100'
        }`}>
          <div className="relative">
            <Music className={`w-6 h-6 ${
              isMyMessage ? 'text-white' : 'text-green-600'
            }`} />
            <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
              isMyMessage ? 'bg-white/40' : 'bg-green-400'
            } animate-pulse`} />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium truncate ${
            isMyMessage ? 'text-white' : 'text-gray-900'
          }`}>
            {fileData.name}
          </div>
          
          <div className={`text-xs mt-1 space-y-1 ${
            isMyMessage ? 'text-white/70' : 'text-gray-500'
          }`}>
            <div className="flex items-center gap-2">
              <Headphones className="w-3 h-3" />
              <span>{getAudioTypeName(fileData.type, fileData.name)}</span>
              {fileData.duration && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {fileData.duration}
                  </span>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <span>{formatFileSize(fileData.size)}</span>
            </div>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading}
          className={`w-9 h-9 rounded-full p-0 flex-shrink-0 transition-all ${
            isMyMessage 
              ? 'hover:bg-white/20 text-white hover:scale-105' 
              : 'hover:bg-gray-100 text-gray-600 hover:scale-105'
          }`}
          title="下载音频文件"
        >
          {isDownloading ? (
            <div className={`w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin`} />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </Button>
      </div>
      
      {isDownloading && (
        <div className="mt-3 pt-2 border-t border-white/20">
          <div className="flex items-center justify-between text-xs mb-1">
            <span>下载中...</span>
            <span>{downloadProgress}%</span>
          </div>
          <div className={`w-full h-1 rounded-full overflow-hidden ${
            isMyMessage ? 'bg-white/20' : 'bg-gray-200'
          }`}>
            <div 
              className={`h-full transition-all duration-300 ${
                isMyMessage ? 'bg-white' : 'bg-primary-500'
              }`}
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderComponent = () => {
    if (fileData.type.startsWith('image/')) {
      return renderImageComponent();
    } else if (fileData.type.startsWith('video/')) {
      return renderVideoComponent();
    } else if (fileData.type.startsWith('audio/')) {
      return renderAudioComponent();
    } else {
      return null;
    }
  };

  return (
    <>
      <div className={`group relative ${isMyMessage ? 'ml-auto' : 'mr-auto'}`}>
        {renderComponent()}
      </div>

      {showPreview && fileData.type.startsWith('image/') && previewUrl && (
        <ImagePreview
          src={previewUrl}
          alt={fileData.name}
          fileName={fileData.name}
          fileSize={formatFileSize(fileData.size)}
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          onDownload={() => handleDownload({} as React.MouseEvent)}
        />
      )}

      {showPreview && fileData.type.startsWith('video/') && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/70 p-0 z-10"
            >
              <X className="w-5 h-5" />
            </Button>

            <div className="absolute top-4 left-4 right-16 bg-black/50 text-white rounded-lg p-3 z-10">
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{fileData.name}</h3>
                  <p className="text-xs text-white/70">{formatFileSize(fileData.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="text-white hover:bg-white/20 h-8 px-3"
                >
                  <Download className="w-4 h-4 mr-1" />
                  下载
                </Button>
              </div>
            </div>

            <div className="max-w-full max-h-full flex items-center justify-center">
              {previewUrl && (
                <video
                  src={previewUrl}
                  controls
                  autoPlay
                  className="max-w-full max-h-full rounded-lg shadow-2xl"
                  style={{ maxHeight: 'calc(100vh - 120px)' }}
                >
                  您的浏览器不支持视频播放
                </video>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImprovedMediaMessage; 