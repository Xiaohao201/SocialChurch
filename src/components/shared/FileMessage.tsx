import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ImagePreview from './ImagePreview';
import { 
  Download, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Archive, 
  File,
  X,
  Play,
  ChevronDown,
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
  isLargeFile?: boolean; // 标记是否为大文件
}

interface FileMessageProps {
  fileData: FileData;
  isMyMessage: boolean;
  onDownload?: (fileData: FileData) => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}

const FileMessage: React.FC<FileMessageProps> = ({ fileData, isMyMessage, onDownload, onContextMenu }) => {
  const { toast } = useToast();
  const [showPreview, setShowPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // 获取文件图标和颜色 - Telegram风格
  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return { 
      icon: ImageIcon, 
      color: 'text-blue-500', 
      bg: 'bg-blue-50', 
      accent: 'bg-blue-500' 
    };
    if (type.startsWith('video/')) return { 
      icon: Video, 
      color: 'text-purple-500', 
      bg: 'bg-purple-50', 
      accent: 'bg-purple-500' 
    };
    if (type.startsWith('audio/')) return { 
      icon: Music, 
      color: 'text-green-500', 
      bg: 'bg-green-50', 
      accent: 'bg-green-500' 
    };
    if (type.includes('pdf')) return { 
      icon: FileText, 
      color: 'text-red-500', 
      bg: 'bg-red-50', 
      accent: 'bg-red-500' 
    };
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return { 
      icon: Archive, 
      color: 'text-orange-500', 
      bg: 'bg-orange-50', 
      accent: 'bg-orange-500' 
    };
    return { 
      icon: File, 
      color: 'text-gray-500', 
      bg: 'bg-gray-50', 
      accent: 'bg-gray-500' 
    };
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 获取文件扩展名
  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toUpperCase() || '';
  };

  // 获取音频/视频的时长信息
  const getMediaDuration = (fileData: FileData) => {
    // 在实际应用中，这些信息应该从服务器端或文件元数据中获取
    // 这里提供一些示例时长，您可以根据实际需求修改
    
    if (fileData.type.startsWith('audio/')) {
      // 根据文件大小估算时长（这是一个简化的估算）
      const sizeInMB = fileData.size / (1024 * 1024);
      if (sizeInMB < 1) return '0:30';
      if (sizeInMB < 3) return '1:45';
      if (sizeInMB < 5) return '2:30';
      if (sizeInMB < 8) return '4:15';
      return '5:30'; // 大文件默认时长
    }
    
    if (fileData.type.startsWith('video/')) {
      // 根据文件大小估算视频时长
      const sizeInMB = fileData.size / (1024 * 1024);
      if (sizeInMB < 5) return '0:15';
      if (sizeInMB < 15) return '0:45';
      if (sizeInMB < 30) return '1:30';
      if (sizeInMB < 60) return '2:45';
      return '5:20'; // 大文件默认时长
    }
    
    return null;
  };

  // 格式化时长显示
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 处理下载
  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      
      const downloadUrl = createDownloadUrl();
      if (!downloadUrl) {
        setIsDownloading(false);
        toast({
          title: '无法下载文件',
          description: fileData.isLargeFile 
            ? '大文件仅在当前会话中可用。请重新上传该文件。'
            : '该文件暂无可下载的内容。这可能是历史消息记录。',
          variant: 'destructive',
        });
        return;
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
            
            // 如果是blob URL，需要清理
            if (fileData.file && isValidFile(fileData.file)) {
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

  // 处理文件打开
  const handleOpen = () => {
    const downloadUrl = createDownloadUrl();
    if (!downloadUrl) {
      toast({
        title: '无法打开文件',
        description: '该文件暂无可用的内容',
        variant: 'destructive',
      });
      return;
    }

    try {
      const type = fileData.type;
      
      // 图片和视频文件打开预览
      if (type.startsWith('image/') || type.startsWith('video/')) {
        setShowPreview(true);
        return;
      }
      
      // PDF文件在新标签页打开
      if (type.includes('pdf')) {
        window.open(downloadUrl, '_blank');
        return;
      }
      
      // 文本文件和代码文件在新标签页打开
      if (type.startsWith('text/') || 
          type.includes('javascript') || 
          type.includes('json') || 
          type.includes('xml') || 
          type.includes('html') ||
          fileData.name.match(/\.(txt|md|js|ts|jsx|tsx|css|scss|json|xml|html|htm|php|py|java|cpp|c|h|sql|csv)$/i)) {
        window.open(downloadUrl, '_blank');
        return;
      }
      
      // 音频文件播放
      if (type.startsWith('audio/')) {
        const audio = new Audio(downloadUrl);
        audio.play().catch(error => {
          console.error('音频播放失败:', error);
          toast({
            title: '播放失败',
            description: '音频文件播放失败',
            variant: 'destructive',
          });
        });
        return;
      }
      
      // 其他文件类型尝试在新标签页打开
      window.open(downloadUrl, '_blank');
      
    } catch (error) {
      console.error('打开文件失败:', error);
      toast({
        title: '打开失败',
        description: '文件打开失败，请尝试下载',
        variant: 'destructive',
      });
    }
  };

  const fileInfo = getFileIcon(fileData.type);
  const IconComponent = fileInfo.icon;
  const fileExt = getFileExtension(fileData.name);

  // 安全检查File对象 - 使用更保守的方法
  const isValidFile = (file: any): boolean => {
    try {
      if (!file || typeof file !== 'object') return false;
      
      // 检查File接口的基本属性
      const hasBasicProps = (
        typeof file.name === 'string' &&
        typeof file.size === 'number' &&
        typeof file.type === 'string'
      );
      
      if (!hasBasicProps) return false;
      
      // 安全地检查constructor
      try {
        if (file.constructor && file.constructor.name === 'File') {
          return true;
        }
      } catch (e) {
        // constructor检查失败，使用duck typing
      }
      
      // 检查是否有File特有的方法
      return typeof file.stream === 'function' || 
             typeof file.arrayBuffer === 'function' ||
             typeof file.text === 'function';
             
    } catch (error) {
      console.warn('File validation error:', error);
      return false;
    }
  };

  // 生成预览URL
  React.useEffect(() => {
    if (fileData.file && isValidFile(fileData.file) && (fileData.type.startsWith('image/') || fileData.type.startsWith('video/'))) {
      try {
        const url = URL.createObjectURL(fileData.file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
      } catch (error) {
        console.error('创建预览URL失败:', error);
      }
    } else if (fileData.base64 && (fileData.type.startsWith('image/') || fileData.type.startsWith('video/'))) {
      setPreviewUrl(fileData.base64);
    } else if (fileData.url && (fileData.type.startsWith('image/') || fileData.type.startsWith('video/'))) {
      setPreviewUrl(fileData.url);
    }
    // 如果没有实际的文件内容，但是图片或视频类型，就不设置预览URL，显示占位图标
  }, [fileData]);

  // 创建下载URL
  const createDownloadUrl = () => {
    // 对于大文件（≥5MB），优先使用File对象（临时可用）
    if (fileData.isLargeFile && fileData.file && isValidFile(fileData.file)) {
      try {
        return URL.createObjectURL(fileData.file);
      } catch (error) {
        console.error('创建大文件下载URL失败:', error);
        return null;
      }
    }
    
    // 对于小文件，优先使用base64数据（最可靠，因为它被存储在localStorage中）
    if (fileData.base64) {
      return fileData.base64;
    }
    
    // 其次尝试File对象（仅对新上传的文件有效）
    if (fileData.file && isValidFile(fileData.file)) {
      try {
        return URL.createObjectURL(fileData.file);
      } catch (error) {
        console.error('创建下载URL失败:', error);
        return null;
      }
    }
    
    // 最后使用外部URL
    if (fileData.url) {
      return fileData.url;
    }
    
    return null;
  };

  // 创建预览URL
  const createPreviewUrl = () => {
    // 对于大文件（≥5MB），优先使用File对象（临时可用）
    if (fileData.isLargeFile && fileData.file && isValidFile(fileData.file)) {
      try {
        return URL.createObjectURL(fileData.file);
      } catch (error) {
        console.error('创建大文件预览URL失败:', error);
        return null;
      }
    }
    
    // 对于小文件，优先使用base64数据
    if (fileData.base64) {
      return fileData.base64;
    }
    
    // 其次尝试使用File对象
    if (fileData.file && isValidFile(fileData.file)) {
      try {
        return URL.createObjectURL(fileData.file);
      } catch (error) {
        console.error('创建预览URL失败:', error);
        return null;
      }
    }
    
    // 最后使用外部URL
    if (fileData.url) {
      return fileData.url;
    }
    
    return null;
  };

  // 初始化预览URL
  useEffect(() => {
    const url = createPreviewUrl();
    if (url) {
      setPreviewUrl(url);
    }
    
    // 清理函数：如果使用了blob URL，需要释放
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [fileData]);

  // 当组件卸载时清理blob URL
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleWrapperClick = (e: React.MouseEvent) => {
    // 确保只有在点击下载/播放按钮时才触发特定操作
    const target = e.target as HTMLElement;
    if (target.closest('.action-button')) {
      return;
    }
    handleOpen();
  };

  // Telegram风格的文件消息组件
  return (
    <>
      <div 
        onContextMenu={onContextMenu}
        className={`flex items-start gap-3 max-w-[80%] md:max-w-[60%] lg:max-w-[50%] ${isMyMessage ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
      >
        {/* 主要文件容器 */}
        <div className={`relative overflow-hidden rounded-2xl transition-all duration-200 ${
          isMyMessage 
            ? 'bg-primary-500 text-white' 
            : 'bg-white border border-gray-200 text-gray-900'
        }`}>
          
          {/* 文件预览区域 */}
          {fileData.type.startsWith('image/') ? (
            /* 图片消息 - 改进的设计 */
            <div className="relative group cursor-pointer" onClick={handleWrapperClick}>
              <div className="max-w-sm overflow-hidden rounded-2xl shadow-md hover:shadow-lg transition-all duration-200">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={fileData.name}
                    className="w-full h-auto max-h-80 object-cover transition-transform duration-200 group-hover:scale-105"
                    onLoad={() => setIsImageLoaded(true)}
                    onError={() => setIsImageLoaded(false)}
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 text-sm">图片加载中...</p>
                    </div>
                  </div>
                )}
                
                {/* 下载按钮叠加层 - 改进的设计 */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-end justify-end p-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload();
                    }}
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
                
                {/* 文件信息栏 */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <p className="text-white text-sm font-medium truncate">{fileData.name}</p>
                  <p className="text-white/80 text-xs">{formatFileSize(fileData.size)}</p>
                </div>
              </div>
            </div>
          ) : fileData.type.startsWith('video/') ? (
            /* 视频消息 - 改进的设计 */
            <div className="relative cursor-pointer group" onClick={handleWrapperClick}>
              <div className="max-w-sm overflow-hidden rounded-2xl shadow-md hover:shadow-lg transition-all duration-200">
                <div className="relative h-48 bg-gradient-to-br from-gray-800 to-gray-900">
                  {previewUrl ? (
                    <video
                      src={previewUrl}
                      className="w-full h-full object-cover"
                      poster=""
                      preload="metadata"
                      muted
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900/30 to-purple-900/30">
                      <div className="text-center">
                        <Video className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-300 text-sm truncate px-4">{fileData.name}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* 播放按钮叠加层 */}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 flex items-center justify-center transition-all duration-200">
                    <div className="w-16 h-16 bg-white/25 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-200 shadow-lg border border-white/20">
                      <Play className="w-8 h-8 text-white ml-1 drop-shadow-lg" />
                    </div>
                  </div>
                  
                  {/* 下载按钮 */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload();
                    }}
                    className="absolute top-3 right-3 w-9 h-9 bg-black/50 hover:bg-black/70 text-white rounded-full p-0 transition-all shadow-md opacity-0 group-hover:opacity-100"
                    title="下载视频"
                  >
                    {isDownloading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                  
                  {/* 视频信息栏 */}
                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                    {/* 时长信息 */}
                    <div className="bg-black/75 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getMediaDuration(fileData) || 'VIDEO'}
                    </div>
                    
                    {/* 文件大小 */}
                    <div className="bg-black/75 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                      {formatFileSize(fileData.size)}
                    </div>
                  </div>
                </div>
                
                {/* 视频标题 */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <p className="text-white text-sm font-medium truncate">{fileData.name}</p>
                </div>
              </div>
            </div>
          ) : fileData.type.startsWith('audio/') ? (
            /* 音频消息 - 改进的静态文件信息UI */
            <div className={`p-4 max-w-xs rounded-2xl transition-all duration-200 ${
              isMyMessage 
                ? 'bg-primary-500 text-white' 
                : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
            }`}>
              <div className="flex items-center gap-3">
                {/* 音频文件类型图标 */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isMyMessage ? 'bg-white/20' : 'bg-green-100'
                }`}>
                  <div className="relative">
                    <Music className={`w-6 h-6 ${
                      isMyMessage ? 'text-white' : 'text-green-600'
                    }`} />
                    {/* 音频波纹装饰 */}
                    <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                      isMyMessage ? 'bg-white/40' : 'bg-green-400'
                    } animate-pulse`} />
                  </div>
                </div>
                
                {/* 文件信息和元数据 */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${
                    isMyMessage ? 'text-white' : 'text-gray-900'
                  }`}>
                    {fileData.name}
                  </div>
                  
                  <div className={`text-xs mt-1 space-y-1 ${
                    isMyMessage ? 'text-white/70' : 'text-gray-500'
                  }`}>
                    {/* 第一行：音频类型和时长 */}
                    <div className="flex items-center gap-2">
                      <Headphones className="w-3 h-3" />
                      <span>
                        {fileData.type.includes('mp3') && 'MP3音频'}
                        {fileData.type.includes('wav') && 'WAV音频'}
                        {fileData.type.includes('m4a') && 'M4A音频'}
                        {fileData.type.includes('ogg') && 'OGG音频'}
                        {!fileData.type.includes('mp3') && !fileData.type.includes('wav') && 
                         !fileData.type.includes('m4a') && !fileData.type.includes('ogg') && '音频文件'}
                      </span>
                      {getMediaDuration(fileData) && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getMediaDuration(fileData)}
                          </span>
                        </>
                      )}
                    </div>
                    
                    {/* 第二行：文件大小 */}
                    <div className="flex items-center gap-1">
                      <span>{formatFileSize(fileData.size)}</span>
                    </div>
                  </div>
                </div>
                
                {/* 下载功能入口 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload();
                  }}
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
              
              {/* 下载进度条（如果正在下载） */}
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
              
              {/* 音频文件额外信息（如果需要） */}
              {fileData.isLargeFile && (
                <div className={`mt-2 text-xs ${
                  isMyMessage ? 'text-orange-200' : 'text-orange-600'
                }`}>
                  ⚠️ 大型音频文件
                </div>
              )}
            </div>
          ) : (
            /* 其他文件类型的紧凑布局 */
            <div className="p-4 cursor-pointer" onClick={handleWrapperClick}>
              <div className="flex items-center gap-3">
                {/* 文件图标区域 */}
                <div className="relative">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isMyMessage ? 'bg-white/20' : fileInfo.bg
                  }`}>
                    <IconComponent className={`w-6 h-6 ${
                      isMyMessage ? 'text-white' : fileInfo.color
                    }`} />
                  </div>
                  {/* 文件扩展名标识 */}
                  {fileExt && (
                    <div className={`absolute -bottom-1 -right-1 text-xs font-bold px-1 rounded text-white ${
                      isMyMessage ? 'bg-white/30' : fileInfo.accent
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
                      {fileData.isLargeFile && (
                        <span className={`ml-2 ${
                          isMyMessage ? 'text-orange-200' : 'text-orange-600'
                        }`}>
                          · 大文件
                        </span>
                      )}
                      {!fileData.base64 && !fileData.file && !fileData.url && (
                        <span className={`ml-2 ${
                          isMyMessage ? 'text-yellow-200' : 'text-yellow-600'
                        }`}>
                          · 历史记录
                        </span>
                      )}
                    </p>
                  </div>

                {/* 操作按钮组 */}
                <div className="flex-shrink-0 flex items-center gap-1">
                  {isDownloading ? (
                    <div className="relative w-10 h-10">
                      {/* 下载进度圆环 */}
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
                    <>
                      {/* 下载按钮 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload();
                        }}
                        className={`w-8 h-8 rounded-full p-0 ${
                          isMyMessage 
                            ? 'hover:bg-white/20 text-white' 
                            : 'hover:bg-gray-100 text-gray-600'
                        }`}
                        title="下载文件"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 快速操作菜单 */}
        <div className={`absolute top-2 ${isMyMessage ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
          <Button
            variant="ghost"
            size="sm"
            className="w-8 h-8 rounded-full bg-black/30 text-white hover:bg-black/50 p-0"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 图片预览组件 */}
      {showPreview && fileData.type.startsWith('image/') && previewUrl && (
        <ImagePreview
          src={previewUrl}
          alt={fileData.name}
          fileName={fileData.name}
          fileSize={formatFileSize(fileData.size)}
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          onDownload={handleDownload}
        />
      )}

      {/* 其他文件类型的预览弹窗 */}
      {showPreview && !fileData.type.startsWith('image/') && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* 关闭按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/70 p-0 z-10"
            >
              <X className="w-5 h-5" />
            </Button>

            {/* 文件信息栏 */}
            <div className="absolute top-4 left-4 right-16 bg-black/50 text-white rounded-lg p-3 z-10">
              <div className="flex items-center gap-3">
                <IconComponent className="w-5 h-5" />
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

            {/* 预览内容 */}
            <div className="max-w-full max-h-full flex items-center justify-center">
              {fileData.type.startsWith('video/') && previewUrl && (
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

              {fileData.type.includes('pdf') && (
                <div className="bg-white rounded-lg p-8 text-center max-w-md">
                  <FileText className="w-24 h-24 text-red-500 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">PDF 文档</p>
                  <p className="text-sm text-gray-500 mb-4">点击下载按钮查看完整文档</p>
                  <Button
                    onClick={handleDownload}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载 PDF
                  </Button>
                </div>
              )}

              {/* 无预览支持的文件类型 */}
              {!fileData.type.startsWith('video/') && 
               !fileData.type.includes('pdf') && (
                <div className="bg-dark-2 rounded-lg p-8 text-center max-w-md border border-dark-4">
                  <IconComponent className="w-24 h-24 text-light-3 mx-auto mb-4" />
                  <p className="text-light-1 mb-2">{fileData.name}</p>
                  <p className="text-light-3 text-sm mb-4">此文件类型不支持预览</p>
                  <Button
                    onClick={handleDownload}
                    className="bg-primary-500 hover:bg-primary-600 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载文件
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FileMessage; 