import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import ImagePreview from './ImagePreview';
import VideoPreview from './VideoPreview';
import { Eye, Download, Image as ImageIcon, Video, FileText, Music, Archive, File } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { downloadMultipleFiles } from '@/utils/downloadUtils';

interface FileData {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  file?: File;
  base64?: string;
}

interface FileAggregationProps {
  files: FileData[];
  isMyMessage: boolean;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  timestamp?: string;
  onDownloadAll?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}

// File type grouping
const getFileTypeGroup = (type: string) => {
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  return 'document';
};

const getGroupIcon = (group: string) => {
  switch (group) {
    case 'image': return ImageIcon;
    case 'video': return Video;
    case 'audio': return Music;
    default: return FileText;
  }
};

const getGroupColor = (group: string) => {
  switch (group) {
    case 'image': return { color: 'text-blue-600', bg: 'bg-blue-50', accent: 'bg-blue-500' };
    case 'video': return { color: 'text-purple-600', bg: 'bg-purple-50', accent: 'bg-purple-500' };
    case 'audio': return { color: 'text-green-600', bg: 'bg-green-50', accent: 'bg-green-500' };
    default: return { color: 'text-gray-600', bg: 'bg-gray-50', accent: 'bg-gray-500' };
  }
};

// Grid layout for images/videos
const MediaGrid: React.FC<{
  files: FileData[];
  onPreview: (index: number) => void;
  isMyMessage: boolean;
}> = ({ files, onPreview, isMyMessage }) => {
  const maxVisible = 4;
  const visibleFiles = files.slice(0, maxVisible);
  const remainingCount = Math.max(0, files.length - maxVisible);

  const getGridClass = (count: number) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count >= 3) return 'grid-cols-2';
    return 'grid-cols-1';
  };

  const createPreviewUrl = (file: FileData) => {
    if (file.base64) return file.base64;
    if (file.file) {
      try {
        return URL.createObjectURL(file.file);
      } catch (error) {
        console.error('Failed to create preview URL:', error);
        return null;
      }
    }
    if (file.url) return file.url;
    return null;
  };

  return (
    <div className={`grid gap-1 max-w-xs ${getGridClass(visibleFiles.length)}`}>
      {visibleFiles.map((file, index) => {
        const previewUrl = createPreviewUrl(file);
        const isLast = index === visibleFiles.length - 1;
        const showOverlay = isLast && remainingCount > 0;

        return (
          <div
            key={file.id}
            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer group hover:opacity-90 transition-opacity"
            onClick={() => onPreview(index)}
          >
            {previewUrl ? (
              <>
                {file.type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <video
                    src={previewUrl}
                    className="w-full h-full object-cover"
                    muted
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                
                {/* Video play icon overlay */}
                {file.type.startsWith('video/') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                      <Video size={16} className="text-white ml-0.5" />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <div className="text-center">
                  {React.createElement(getGroupIcon(getFileTypeGroup(file.type)), { 
                    size: 24, 
                    className: getGroupColor(getFileTypeGroup(file.type)).color 
                  })}
                  <p className="text-xs text-gray-600 mt-1 truncate px-2">{file.name}</p>
                </div>
              </div>
            )}

            {/* Remaining count overlay */}
            {showOverlay && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-white text-lg font-bold">+{remainingCount}</div>
                  <div className="text-white text-xs">more</div>
                </div>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Eye size={20} className="text-white drop-shadow-lg" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Stack layout for documents/mixed files
const FileStack: React.FC<{
  files: FileData[];
  onPreview: () => void;
  isMyMessage: boolean;
}> = ({ files, onPreview, isMyMessage }) => {
  const primaryFile = files[0];
  const fileGroup = getFileTypeGroup(primaryFile.type);
  const groupConfig = getGroupColor(fileGroup);
  const IconComponent = getGroupIcon(fileGroup);

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div 
      className="relative cursor-pointer group"
      onClick={onPreview}
    >
      {/* Stack effect with multiple cards */}
      <div className="relative">
        {/* Back cards for stack effect */}
        {files.length > 1 && (
          <>
            <div className={`
              absolute top-1 left-1 right-0 bottom-0 rounded-lg border-2 border-white
              ${isMyMessage ? 'bg-primary-400' : 'bg-light-1 dark:bg-dark-2'}
            `} />
            {files.length > 2 && (
              <div className={`
                absolute top-2 left-2 right-0 bottom-0 rounded-lg border-2 border-white
                ${isMyMessage ? 'bg-primary-300' : 'bg-light-0 dark:bg-dark-1'}
              `} />
            )}
          </>
        )}

        {/* Main card */}
        <div className={`
          relative p-4 rounded-lg border-2 border-white shadow-sm
          transition-all duration-200 group-hover:shadow-md group-hover:scale-[1.02]
          ${isMyMessage ? 'bg-primary-500 text-white' : 'bg-light-2 dark:bg-dark-3'}
        `}>
          <div className="flex items-center gap-3">
            {/* File icon */}
            <div className={`
              flex-shrink-0 p-3 rounded-lg
              ${isMyMessage ? 'bg-white/10' : groupConfig.bg}
            `}>
              <IconComponent 
                size={24} 
                className={isMyMessage ? 'text-white' : groupConfig.color} 
              />
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <h4 className={`
                font-semibold text-sm truncate
                ${isMyMessage ? 'text-white' : 'text-foreground'}
              `}>
                {files.length === 1 ? primaryFile.name : `${files.length} files`}
              </h4>
              <p className={`
                text-xs mt-0.5
                ${isMyMessage ? 'text-white/80' : 'text-muted-foreground'}
              `}>
                {formatFileSize(totalSize)} • {files.length} {files.length === 1 ? 'file' : 'files'}
              </p>
            </div>

            {/* Preview icon */}
            <div className={`
              flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity
              ${isMyMessage ? 'text-white/70' : 'text-muted-foreground'}
            `}>
              <Eye size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* Count badge */}
      {files.length > 1 && (
        <div className={`
          absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white
          ${groupConfig.accent}
        `}>
          {files.length}
        </div>
      )}
    </div>
  );
};

const FileAggregation: React.FC<FileAggregationProps> = ({
  files,
  isMyMessage,
  showAvatar = true,
  isFirstInGroup = true,
  isLastInGroup = true,
  timestamp,
  onDownloadAll,
  onContextMenu
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewType, setPreviewType] = useState<'image' | 'video' | 'mixed'>('mixed');

  // Group files by type for better handling
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  const videoFiles = files.filter(f => f.type.startsWith('video/'));
  const mediaFiles = [...imageFiles, ...videoFiles];
  const hasOnlyImages = files.length === imageFiles.length;
  const hasOnlyVideos = files.length === videoFiles.length;
  const hasOnlyMedia = files.length === mediaFiles.length;

  const handlePreview = useCallback((index: number = 0) => {
    setPreviewIndex(index);
    
    if (hasOnlyImages) {
      setPreviewType('image');
    } else if (hasOnlyVideos) {
      setPreviewType('video');
    } else {
      setPreviewType('mixed');
    }
    
    setShowPreview(true);
  }, [hasOnlyImages, hasOnlyVideos]);

  const handleNavigate = useCallback((newIndex: number) => {
    const targetFiles = previewType === 'mixed' ? files : mediaFiles;
    if (newIndex >= 0 && newIndex < targetFiles.length) {
      setPreviewIndex(newIndex);
    }
  }, [previewType, files, mediaFiles]);

  const createPreviewUrl = useCallback((file: FileData) => {
    if (file.base64) return file.base64;
    if (file.file) {
      try {
        return URL.createObjectURL(file.file);
      } catch (error) {
        console.error('Failed to create preview URL:', error);
        return null;
      }
    }
    if (file.url) return file.url;
    return null;
  }, []);

  const getCurrentPreviewFile = () => {
    const targetFiles = previewType === 'mixed' ? files : mediaFiles;
    return targetFiles[previewIndex];
  };

  const getCurrentPreviewUrl = () => {
    const file = getCurrentPreviewFile();
    return file ? createPreviewUrl(file) : null;
  };

  // Determine layout based on file types
  const useGridLayout = hasOnlyMedia && files.length <= 6;

  // Handle download all files
  const handleDownloadAll = useCallback(async () => {
    try {
      const downloadFiles = files.map(file => ({
        url: createPreviewUrl(file) || '',
        filename: file.name
      })).filter(f => f.url);

      if (downloadFiles.length === 0) {
        toast({
          title: 'Download Failed',
          description: 'No files available for download',
          variant: 'destructive',
        });
        return;
      }

      // Show progress toast
      const progressToast = toast({
        title: 'Downloading Files',
        description: `Starting download of ${downloadFiles.length} files...`,
      });

      await downloadMultipleFiles(
        downloadFiles,
        (currentFile, totalFiles, fileProgress) => {
          // You could update a progress indicator here if needed
          console.log(`Downloading file ${currentFile}/${totalFiles}: ${fileProgress.percentage}%`);
        }
      );

      toast({
        title: 'Downloads Complete',
        description: `Successfully downloaded ${downloadFiles.length} files`,
      });

    } catch (error) {
      console.error('Batch download failed:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to download files, please try again',
        variant: 'destructive',
      });
    }
  }, [files, createPreviewUrl, toast]);

  return (
    <div 
      className={`flex items-end gap-2 ${isFirstInGroup ? 'mt-2' : 'mt-0.5'} 
        ${isMyMessage ? "ml-auto flex-row-reverse" : "mr-auto"}
        ${isLastInGroup ? 'mb-1.5' : 'mb-0.5'} max-w-[85%]`}
      onContextMenu={onContextMenu}
    >
      {/* Avatar placeholder */}
      {!isMyMessage && showAvatar && isLastInGroup ? (
        <div className="w-8 h-8 flex-shrink-0" />
      ) : !isMyMessage ? (
        <div className="w-8 flex-shrink-0" />
      ) : null}

      <div className="flex flex-col max-w-full">
        {/* File display */}
        <div className={`
          ${!isFirstInGroup ? (isMyMessage ? 'rounded-tr-md' : 'rounded-tl-md') : ''}
          ${!isLastInGroup ? (isMyMessage ? 'rounded-br-2xl rounded-bl-md' : 'rounded-bl-2xl rounded-br-md') : ''}
          ${isMyMessage 
            ? 'rounded-t-2xl rounded-bl-2xl rounded-br-md' 
            : 'rounded-t-2xl rounded-br-2xl rounded-bl-md'
          }
          overflow-hidden
        `}>
          {useGridLayout ? (
            <div className={`
              p-3
              ${isMyMessage ? 'bg-primary-500' : 'bg-light-2 dark:bg-dark-3'}
            `}>
              <MediaGrid 
                files={files}
                onPreview={handlePreview}
                isMyMessage={isMyMessage}
              />
            </div>
          ) : (
            <FileStack
              files={files}
              onPreview={() => handlePreview(0)}
              isMyMessage={isMyMessage}
            />
          )}
        </div>

        {/* Action bar for multiple files */}
        {files.length > 1 && (
          <div className={`
            mt-2 flex items-center gap-2 px-3 py-2 rounded-lg
            ${isMyMessage ? 'bg-primary-400/50' : 'bg-light-1 dark:bg-dark-2'}
          `}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handlePreview(0)}
              className={`
                text-xs h-6 px-2
                ${isMyMessage 
                  ? 'text-white hover:bg-white/10' 
                  : 'text-foreground hover:bg-black/5'
                }
              `}
            >
              <Eye size={12} className="mr-1" />
              View All
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDownloadAll}
              className={`
                text-xs h-6 px-2
                ${isMyMessage 
                  ? 'text-white hover:bg-white/10' 
                  : 'text-foreground hover:bg-black/5'
                }
              `}
            >
              <Download size={12} className="mr-1" />
              Download All
            </Button>
          </div>
        )}

        {/* Timestamp */}
        {isLastInGroup && timestamp && (
          <div className={`flex items-center gap-2 mt-1 px-1 ${isMyMessage ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-xs text-light-4 opacity-70">
              {timestamp}
            </span>
          </div>
        )}
      </div>

      {/* Preview Modals */}
      {showPreview && (
        <>
          {(previewType === 'image' || getCurrentPreviewFile()?.type.startsWith('image/')) && (
            <ImagePreview
              src={getCurrentPreviewUrl() || ''}
              alt={getCurrentPreviewFile()?.name || ''}
              fileName={getCurrentPreviewFile()?.name || ''}
              fileSize={`${Math.round((getCurrentPreviewFile()?.size || 0) / 1024)} KB`}
              isOpen={showPreview}
              onClose={() => setShowPreview(false)}
              onDownload={() => {}}
              images={mediaFiles.map(f => ({
                src: createPreviewUrl(f) || '',
                fileName: f.name,
                fileSize: `${Math.round(f.size / 1024)} KB`,
                alt: f.name
              }))}
              currentIndex={previewIndex}
              onNavigate={handleNavigate}
            />
          )}
          
          {(previewType === 'video' || getCurrentPreviewFile()?.type.startsWith('video/')) && (
            <VideoPreview
              src={getCurrentPreviewUrl() || ''}
              fileName={getCurrentPreviewFile()?.name || ''}
              fileSize={`${Math.round((getCurrentPreviewFile()?.size || 0) / 1024)} KB`}
              isOpen={showPreview}
              onClose={() => setShowPreview(false)}
              onDownload={() => {}}
              videos={mediaFiles.filter(f => f.type.startsWith('video/')).map(f => ({
                src: createPreviewUrl(f) || '',
                fileName: f.name,
                fileSize: `${Math.round(f.size / 1024)} KB`
              }))}
              currentIndex={Math.max(0, videoFiles.findIndex(f => f.id === getCurrentPreviewFile()?.id))}
              onNavigate={handleNavigate}
            />
          )}
        </>
      )}
    </div>
  );
};

export default FileAggregation; 