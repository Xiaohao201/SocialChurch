import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, FileText, Image as ImageIcon, Video } from 'lucide-react';

interface ImprovedFilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    url: string;
    name: string;
    type: string;
    size?: number;
  } | null;
}

const isImage = (type: string) => type.startsWith('image/');
const isVideo = (type: string) => type.startsWith('video/');

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const ImprovedFilePreview: React.FC<ImprovedFilePreviewProps> = ({ isOpen, onClose, file }) => {
  if (!isOpen || !file) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderFileIcon = () => {
    if (isImage(file.type)) return <ImageIcon className="w-12 h-12 text-gray-500" />;
    if (isVideo(file.type)) return <Video className="w-12 h-12 text-gray-500" />;
    return <FileText className="w-12 h-12 text-gray-500" />;
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-dark-1 rounded-lg overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-gray-200 dark:border-dark-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0">
              {renderFileIcon()}
            </div>
            <div className='min-w-0'>
              <p className="text-base font-semibold text-dark-1 dark:text-light-1 truncate">{file.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={handleDownload}>
              <Download size={20} />
            </Button>
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={onClose}>
              <X size={22} />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-dark-2 p-4 overflow-auto">
          {isImage(file.type) && (
            <img src={file.url} alt={file.name} className="max-w-full max-h-full object-contain rounded-md" />
          )}
          {isVideo(file.type) && (
            <video src={file.url} controls autoPlay className="max-w-full max-h-full object-contain rounded-md" />
          )}
          {!isImage(file.type) && !isVideo(file.type) && (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-dark-3 rounded-lg">
              <FileText size={64} className="text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-xl font-bold text-dark-1 dark:text-light-1">Preview not available</h3>
              <p className="text-gray-500 dark:text-gray-400 mt-2 mb-6">This file type can't be shown here.</p>
              <Button onClick={handleDownload}>
                <Download size={18} className="mr-2" /> Download File
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImprovedFilePreview;
