import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Share,
  Heart,
  Copy,
  Maximize,
  Minimize,
  RotateCcw
} from 'lucide-react';

interface ImagePreviewProps {
  src: string;
  alt: string;
  fileName: string;
  fileSize: string;
  isOpen: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  src,
  alt,
  fileName,
  fileSize,
  isOpen,
  onClose,
  onDownload
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // 缩放控制
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.2));
  };

  // 旋转控制
  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // 重置视图
  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // 全屏切换
  const handleFullscreen = () => {
    if (!isFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 复制图片
  const handleCopy = async () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = imageRef.current;
      
      if (img && ctx) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
          }
        });
      }
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black/95 flex items-center justify-center z-50"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 顶部工具栏 */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-4 z-10">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="font-medium text-lg">{fileName}</h3>
              <p className="text-sm text-white/70">{fileSize}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="text-white hover:bg-white/20 h-9 px-3"
              title="复制图片"
            >
              <Copy className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onDownload}
              className="text-white hover:bg-white/20 h-9 px-3"
              title="下载"
            >
              <Download className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFullscreen}
              className="text-white hover:bg-white/20 h-9 px-3"
              title={isFullscreen ? "退出全屏" : "全屏"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20 w-9 h-9 p-0"
              title="关闭"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 图片容器 */}
      <div 
        className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className="max-w-none transition-transform duration-200 ease-out select-none"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,
            maxHeight: scale === 1 ? '90vh' : 'none',
            maxWidth: scale === 1 ? '90vw' : 'none'
          }}
          draggable={false}
          onDoubleClick={handleReset}
        />
      </div>

      {/* 底部控制栏 */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 z-10">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomOut}
            disabled={scale <= 0.2}
            className="text-white hover:bg-white/20 w-10 h-10 p-0"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          

          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleZoomIn}
            disabled={scale >= 3}
            className="text-white hover:bg-white/20 w-10 h-10 p-0"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          
          <div className="w-px h-6 bg-white/30 mx-2" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRotate}
            className="text-white hover:bg-white/20 w-10 h-10 p-0"
            title="旋转"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-white hover:bg-white/20 w-10 h-10 p-0"
            title="重置"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

      </div>


    </div>
  );
};

export default ImagePreview; 