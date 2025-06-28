import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, FileText, Image, Video, Music, Archive, Download } from 'lucide-react';

interface FileUploadPreviewProps {
  files: File[];
  onRemoveFile: (index: number) => void;
  onConfirmUpload: () => void;
  onCancel: () => void;
  isUploading?: boolean;
}

const FileUploadPreview: React.FC<FileUploadPreviewProps> = ({
  files,
  onRemoveFile,
  onConfirmUpload,
  onCancel,
  isUploading = false
}) => {
  if (files.length === 0) return null;

  // 获取文件图标
  const getFileIcon = (file: File) => {
    const type = file.type;
    if (type.startsWith('image/')) return <Image className="w-6 h-6 text-blue-400" />;
    if (type.startsWith('video/')) return <Video className="w-6 h-6 text-purple-400" />;
    if (type.startsWith('audio/')) return <Music className="w-6 h-6 text-green-400" />;
    if (type.includes('pdf')) return <FileText className="w-6 h-6 text-red-400" />;
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) 
      return <Archive className="w-6 h-6 text-yellow-400" />;
    return <FileText className="w-6 h-6 text-gray-400" />;
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 获取文件预览
  const getFilePreview = (file: File) => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      return (
        <img 
          src={url} 
          alt={file.name}
          className="w-16 h-16 object-cover rounded-lg"
          onLoad={() => URL.revokeObjectURL(url)}
        />
      );
    }
    return (
      <div className="w-16 h-16 bg-dark-4 rounded-lg flex items-center justify-center">
        {getFileIcon(file)}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-2 rounded-xl border border-dark-4 w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-dark-4">
          <div>
            <h3 className="text-light-1 font-semibold text-lg">确认上传文件</h3>
            <p className="text-light-3 text-sm">
              共 {files.length} 个文件，总大小 {formatFileSize(files.reduce((total, file) => total + file.size, 0))}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="w-8 h-8 p-0 hover:bg-dark-3"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* 文件列表 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {files.map((file, index) => (
            <div key={index} className="flex items-center gap-4 p-4 bg-dark-3 rounded-lg border border-dark-4">
              {/* 文件预览 */}
              {getFilePreview(file)}
              
              {/* 文件信息 */}
              <div className="flex-1 min-w-0">
                <h4 className="text-light-1 font-medium truncate">{file.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-light-3 text-sm">{formatFileSize(file.size)}</span>
                  <span className="text-light-4 text-sm">•</span>
                  <span className="text-light-3 text-sm">{file.type || '未知类型'}</span>
                </div>
                
                {/* 文件类型说明 */}
                <div className="flex items-center gap-1 mt-2">
                  {getFileIcon(file)}
                  <span className="text-light-4 text-xs">
                    {file.type.startsWith('image/') && '图片文件'}
                    {file.type.startsWith('video/') && '视频文件'}
                    {file.type.startsWith('audio/') && '音频文件'}
                    {file.type.includes('pdf') && 'PDF文档'}
                    {(file.type.includes('zip') || file.type.includes('rar') || file.type.includes('7z')) && '压缩文件'}
                    {(!file.type.startsWith('image/') && 
                      !file.type.startsWith('video/') && 
                      !file.type.startsWith('audio/') && 
                      !file.type.includes('pdf') && 
                      !file.type.includes('zip') && 
                      !file.type.includes('rar') && 
                      !file.type.includes('7z')) && '其他文件'}
                  </span>
                </div>
              </div>

              {/* 删除按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveFile(index)}
                className="w-8 h-8 p-0 hover:bg-red-500/20 hover:text-red-400"
                disabled={isUploading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        {/* 底部操作按钮 */}
        <div className="flex items-center justify-between p-6 border-t border-dark-4">
          <div className="text-light-3 text-sm">
            {isUploading ? '正在上传文件...' : '确认上传这些文件？'}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isUploading}
              className="border-dark-4 text-light-3 hover:text-light-1 hover:bg-dark-3"
            >
              取消
            </Button>
            <Button
              onClick={onConfirmUpload}
              disabled={isUploading || files.length === 0}
              className="bg-primary-500 hover:bg-primary-600 text-white"
            >
              {isUploading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  上传中...
                </div>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  确认上传
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUploadPreview; 