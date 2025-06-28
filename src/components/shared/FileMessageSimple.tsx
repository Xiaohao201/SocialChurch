import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
  Download, 
  Eye, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Archive, 
  File,
  Play
} from 'lucide-react';

interface FileData {
  name: string;
  size: number;
  type: string;
  url?: string;
  file?: File;
  base64?: string;
}

interface FileMessageProps {
  fileData: FileData;
  isMyMessage: boolean;
  onDownload?: (fileData: FileData) => void;
}

const FileMessageSimple: React.FC<FileMessageProps> = ({ fileData, isMyMessage, onDownload }) => {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // 安全检查File对象 - 更加保守的方法
  const isActualFile = (obj: any): boolean => {
    try {
      // 检查基本属性
      if (!obj || typeof obj !== 'object') return false;
      
      // 检查File接口必需的属性
      const hasFileProps = (
        typeof obj.name === 'string' &&
        typeof obj.size === 'number' &&
        typeof obj.type === 'string' &&
        typeof obj.lastModified === 'number'
      );
      
      if (!hasFileProps) return false;
      
      // 尝试检查constructor，但要安全处理
      try {
        return obj.constructor && obj.constructor.name === 'File';
      } catch {
        // 如果constructor检查失败，使用duck typing
        return 'stream' in obj || 'arrayBuffer' in obj;
      }
    } catch {
      return false;
    }
  };

  // 获取文件图标
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    if (type.startsWith('video/')) return Video;
    if (type.startsWith('audio/')) return Music;
    if (type.includes('pdf')) return FileText;
    if (type.includes('zip') || type.includes('rar')) return Archive;
    return File;
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 创建下载URL
  const createDownloadUrl = () => {
    try {
      if (fileData.file && isActualFile(fileData.file)) {
        return URL.createObjectURL(fileData.file);
      } else if (fileData.url) {
        return fileData.url;
      } else if (fileData.base64) {
        return fileData.base64;
      }
    } catch (error) {
      console.error('创建下载URL失败:', error);
    }
    return null;
  };

  // 处理下载
  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      
      const downloadUrl = createDownloadUrl();
      if (!downloadUrl) {
        throw new Error('该文件暂无可下载的内容，这可能是从消息历史中加载的文件记录');
      }
      
      // 模拟下载进度
      const progressInterval = setInterval(() => {
        setDownloadProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            setIsDownloading(false);
            
            // 创建下载链接
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileData.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 清理临时URL
            if (fileData.file && isActualFile(fileData.file)) {
              try {
                URL.revokeObjectURL(downloadUrl);
              } catch (error) {
                console.log('URL清理失败，但不影响功能:', error);
              }
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
        description: error instanceof Error ? error.message : '文件下载失败，请重试',
        variant: 'destructive',
      });
    }
  };

  const IconComponent = getFileIcon(fileData.type);
  const fileExt = fileData.name.split('.').pop()?.toUpperCase() || '';

  return (
    <div className={`group relative max-w-sm ${isMyMessage ? 'ml-auto' : 'mr-auto'}`}>
      <div className={`relative overflow-hidden rounded-2xl transition-all duration-200 ${
        isMyMessage 
          ? 'bg-primary-500 text-white' 
          : 'bg-white border border-gray-200 text-gray-900'
      }`}>
        
        {/* 文件类型预览 */}
        {fileData.type.startsWith('image/') ? (
          <div className="relative">
            <div className="w-80 h-48 bg-gray-100 overflow-hidden rounded-t-2xl">
              {/* 图片预览区域 - 只显示占位符，避免复杂的URL处理 */}
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-12 h-12 text-gray-400" />
                <div className="ml-2 text-center">
                  <p className="text-sm text-gray-600">图片文件</p>
                  <p className="text-xs text-gray-500">{fileExt}</p>
                </div>
              </div>
            </div>
            
            {/* 图片信息栏 */}
            <div className={`p-3 ${isMyMessage ? 'bg-primary-500' : 'bg-white'}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium text-sm truncate ${
                    isMyMessage ? 'text-white' : 'text-gray-900'
                  }`}>
                    {fileData.name}
                  </h4>
                  <p className={`text-xs ${
                    isMyMessage ? 'text-white/70' : 'text-gray-500'
                  }`}>
                    {formatFileSize(fileData.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={`w-8 h-8 rounded-full p-0 ml-2 ${
                    isMyMessage 
                      ? 'hover:bg-white/20 text-white' 
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : fileData.type.startsWith('video/') ? (
          <div className="relative">
            <div className="w-80 h-48 bg-gray-900 overflow-hidden rounded-t-2xl">
              <div className="w-full h-full flex items-center justify-center">
                <Video className="w-12 h-12 text-gray-400" />
                <div className="ml-2 text-center">
                  <p className="text-sm text-white">视频文件</p>
                  <p className="text-xs text-gray-300">{fileExt}</p>
                </div>
              </div>
              
              {/* 播放按钮占位符 */}
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="bg-black/50 text-white rounded-full w-16 h-16 flex items-center justify-center">
                  <Play className="w-6 h-6 ml-1" />
                </div>
              </div>
            </div>
            
            {/* 视频信息栏 */}
            <div className={`p-3 ${isMyMessage ? 'bg-primary-500' : 'bg-white'}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className={`font-medium text-sm truncate ${
                    isMyMessage ? 'text-white' : 'text-gray-900'
                  }`}>
                    {fileData.name}
                  </h4>
                  <p className={`text-xs ${
                    isMyMessage ? 'text-white/70' : 'text-gray-500'
                  }`}>
                    {formatFileSize(fileData.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={`w-8 h-8 rounded-full p-0 ml-2 ${
                    isMyMessage 
                      ? 'hover:bg-white/20 text-white' 
                      : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* 其他文件类型 */
          <div className="p-4">
            <div className="flex items-center gap-3">
              {/* 文件图标 */}
              <div className="relative">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isMyMessage ? 'bg-white/20' : 'bg-gray-100'
                }`}>
                  <IconComponent className={`w-6 h-6 ${
                    isMyMessage ? 'text-white' : 'text-gray-600'
                  }`} />
                </div>
                {fileExt && (
                  <div className={`absolute -bottom-1 -right-1 text-xs font-bold px-1 rounded text-white ${
                    isMyMessage ? 'bg-white/30' : 'bg-gray-500'
                  }`}>
                    {fileExt}
                  </div>
                )}
              </div>

              {/* 文件信息 */}
              <div className="flex-1 min-w-0">
                <h4 className={`font-medium text-sm truncate ${
                  isMyMessage ? 'text-white' : 'text-gray-900'
                }`}>
                  {fileData.name}
                </h4>
                <p className={`text-xs mt-1 ${
                  isMyMessage ? 'text-white/70' : 'text-gray-500'
                }`}>
                  {formatFileSize(fileData.size)}
                </p>
              </div>

              {/* 下载按钮 */}
              <div className="flex-shrink-0">
                {isDownloading ? (
                  <div className="relative w-10 h-10">
                    <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className={`${isMyMessage ? 'stroke-white/30' : 'stroke-gray-300'}`}
                        strokeWidth="3"
                        fill="transparent"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className={`${isMyMessage ? 'stroke-white' : 'stroke-primary-500'}`}
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="transparent"
                        strokeDasharray={`${downloadProgress}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-xs font-medium ${
                        isMyMessage ? 'text-white' : 'text-gray-700'
                      }`}>
                        {downloadProgress}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDownload}
                    className={`w-10 h-10 rounded-full p-0 ${
                      isMyMessage 
                        ? 'hover:bg-white/20 text-white' 
                        : 'hover:bg-gray-100 text-gray-600'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileMessageSimple; 