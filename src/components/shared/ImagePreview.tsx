import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ContactPicker from '@/components/chat/ContactPicker';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Share, 
  ChevronLeft, 
  ChevronRight,
  Play,
  RotateCcw,
  Move,
  Maximize,
  Minimize,
  Pause
} from 'lucide-react';
import { downloadFile } from '@/utils/downloadUtils';

interface ImagePreviewProps {
  src: string;
  alt: string;
  fileName: string;
  fileSize: string;
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => void;
  images?: Array<{ src: string; fileName: string; fileSize: string; alt: string; }>;
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  src,
  alt,
  fileName,
  fileSize,
  isOpen,
  onClose,
  onDownload,
  images = [],
  currentIndex = 0,
  onNavigate
}) => {
  const { toast } = useToast();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isGifPlaying, setIsGifPlaying] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current image is a GIF
  const isGif = fileName.toLowerCase().endsWith('.gif') || src.includes('gif');
  
  // Navigation helpers
  const hasMultipleImages = images.length > 1;
  const canGoNext = hasMultipleImages && currentIndex < images.length - 1;
  const canGoPrev = hasMultipleImages && currentIndex > 0;
  const currentImageNumber = currentIndex + 1;
  const totalImages = images.length || 1;

  // New state for GIF playback
  const [gifPlaying, setGifPlaying] = useState(true);

  // Reset states when image changes
  useEffect(() => {
    if (isOpen) {
      setZoom(100);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setImageLoaded(false);
      setImageError(false);
      setIsGifPlaying(isGif);
      
      // Auto-hide toolbar after 3 seconds
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
      }
      toolbarTimeoutRef.current = setTimeout(() => {
        setShowToolbar(false);
      }, 3000);
    }
    
    return () => {
      if (toolbarTimeoutRef.current) {
        clearTimeout(toolbarTimeoutRef.current);
      }
    };
  }, [isOpen, src, isGif]);

  // Handle GIF playback
  useEffect(() => {
    if (src.endsWith('.gif') && imageRef.current) {
      // Reset to play GIF
      imageRef.current.src = src;
      setGifPlaying(true);
    }
  }, [src]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (canGoPrev && onNavigate) {
            onNavigate(currentIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (canGoNext && onNavigate) {
            onNavigate(currentIndex + 1);
          }
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          handleRotate();
          break;
        case '0':
          e.preventDefault();
          handleResetView();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, canGoNext, canGoPrev, currentIndex, onNavigate]);

  // Mouse/touch interactions
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 100) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoom > 100) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 25, 500));
    showToolbarTemporarily();
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const newZoom = Math.max(prev - 25, 25);
      if (newZoom <= 100) {
        setPosition({ x: 0, y: 0 });
      }
      return newZoom;
    });
    showToolbarTemporarily();
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
    showToolbarTemporarily();
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(100);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    showToolbarTemporarily();
  }, []);

  // GIF controls
  const handleGifToggle = useCallback(() => {
    if (imageRef.current && isGif) {
      if (isGifPlaying) {
        // Pause GIF by replacing with static version
        const staticSrc = src.replace(/\.gif$/i, '_static.gif');
        setIsGifPlaying(false);
      } else {
        // Play GIF
        imageRef.current.src = src;
        setIsGifPlaying(true);
      }
    }
    showToolbarTemporarily();
  }, [isGif, isGifPlaying, src]);

  // Share functionality
  const handleShare = useCallback(() => {
    setShowContactPicker(true);
    showToolbarTemporarily();
  }, []);

  const handleForward = useCallback((contactIds: string[]) => {
    // Implementation depends on your forwarding logic
    toast({
      title: 'Image Shared',
      description: `Image forwarded to ${contactIds.length} contact(s)`,
    });
    setShowContactPicker(false);
  }, [toast]);

  // Show toolbar temporarily
  const showToolbarTemporarily = useCallback(() => {
    setShowToolbar(true);
    if (toolbarTimeoutRef.current) {
      clearTimeout(toolbarTimeoutRef.current);
    }
    toolbarTimeoutRef.current = setTimeout(() => {
      setShowToolbar(false);
    }, 3000);
  }, []);

  // Handle container click (close on backdrop)
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handle mouse movement for toolbar auto-hide
  const handleMouseMove2 = useCallback(() => {
    showToolbarTemporarily();
  }, [showToolbarTemporarily]);

  // Handle download with proper file fetching
  const handleDownload = useCallback(async () => {
    try {
      await downloadFile(src, fileName);
      toast({
        title: 'Download Complete',
        description: `${fileName} has been downloaded`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: 'Download Failed',
        description: 'Image download failed, please try again',
        variant: 'destructive',
      });
    }
  }, [src, fileName, toast]);

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleContainerClick}
      onMouseMove={handleMouseMove2}
    >
      {/* Navigation Arrows */}
      {hasMultipleImages && (
        <>
          {/* Previous Button */}
          <button
            onClick={() => canGoPrev && onNavigate?.(currentIndex - 1)}
            disabled={!canGoPrev}
            className={`
              absolute left-4 top-1/2 -translate-y-1/2 z-10
              w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm
              flex items-center justify-center text-white
              transition-all duration-200 hover:bg-black/70
              ${!canGoPrev ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'}
            `}
          >
            <ChevronLeft size={24} />
          </button>

          {/* Next Button */}
          <button
            onClick={() => canGoNext && onNavigate?.(currentIndex + 1)}
            disabled={!canGoNext}
            className={`
              absolute right-4 top-1/2 -translate-y-1/2 z-10
              w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm
              flex items-center justify-center text-white
              transition-all duration-200 hover:bg-black/70
              ${!canGoNext ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110'}
            `}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Main Image Container */}
      <div 
        className="relative max-w-full max-h-full overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 100 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* Loading State */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Error State */}
        {imageError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-8">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Image failed to load</h3>
              <p className="text-white/70 mb-4">The image could not be displayed</p>
              <Button 
                onClick={() => {
                  setImageError(false);
                  setImageLoaded(false);
                  if (imageRef.current) {
                    imageRef.current.src = src;
                  }
                }}
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Main Image */}
        <div className="relative">
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            className={`
              max-w-none transition-all duration-300 ease-out select-none
              ${imageLoaded ? 'opacity-100' : 'opacity-0'}
            `}
            style={{
              transform: `
                scale(${zoom / 100}) 
                rotate(${rotation}deg) 
                translate(${position.x}px, ${position.y}px)
              `,
              transformOrigin: 'center center',
              maxHeight: '90vh',
              maxWidth: '90vw'
            }}
            onLoad={() => {
              setImageLoaded(true);
              if (src.endsWith('.gif')) {
                // GIF will play automatically
                setGifPlaying(true);
              }
            }}
            onError={() => {
              setImageError(true);
              setImageLoaded(false);
            }}
            draggable={false}
          />
          
          {/* GIF replay button */}
          {src.endsWith('.gif') && !gifPlaying && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button 
                size="lg"
                className="bg-white/90 hover:bg-white text-black"
                onClick={handleGifToggle}
              >
                <RotateCw size={24} className="mr-2" /> Replay GIF
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className={`
        absolute top-4 left-1/2 -translate-x-1/2 z-20
        transition-all duration-300 ease-out
        ${showToolbar ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}
      `}>
        <div className="flex items-center gap-2 px-4 py-3 bg-black/50 backdrop-blur-sm rounded-full">
          {/* Image Counter */}
          {hasMultipleImages && (
            <div className="text-white text-sm font-medium px-3">
              {currentImageNumber} / {totalImages}
            </div>
          )}

          {/* Zoom Out */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleZoomOut}
            disabled={zoom <= 25}
            className="text-white hover:bg-white/20 disabled:opacity-30 h-8 w-8 p-0"
          >
            <ZoomOut size={16} />
          </Button>

          {/* Zoom Level */}
          <div className="text-white text-sm font-medium min-w-[3rem] text-center">
            {zoom}%
          </div>

          {/* Zoom In */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleZoomIn}
            disabled={zoom >= 500}
            className="text-white hover:bg-white/20 disabled:opacity-30 h-8 w-8 p-0"
          >
            <ZoomIn size={16} />
          </Button>

          <div className="w-px h-6 bg-white/30 mx-1" />

          {/* Rotate */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRotate}
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            title="Rotate 90° clockwise"
          >
            <RotateCw size={16} />
          </Button>

          {/* Reset View */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleResetView}
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            title="Reset view"
          >
            <Minimize size={16} />
          </Button>

          <div className="w-px h-6 bg-white/30 mx-1" />

          {/* Download */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            title="Download"
          >
            <Download size={16} />
          </Button>

          {/* Share */}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleShare}
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            title="Share/Forward"
          >
            <Share size={16} />
          </Button>

          <div className="w-px h-6 bg-white/30 mx-1" />

          {/* Close */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-white hover:bg-white/20 h-8 w-8 p-0"
            title="Close (Esc)"
          >
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* File Info */}
      <div className={`
        absolute bottom-4 left-4 z-20
        transition-all duration-300 ease-out
        ${showToolbar ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}
      `}>
        <div className="px-4 py-2 bg-black/50 backdrop-blur-sm rounded-lg text-white">
          <div className="font-medium text-sm truncate max-w-xs">{fileName}</div>
          <div className="text-xs text-white/70">{fileSize}</div>
        </div>
      </div>

      {/* Contact Picker Modal */}
      {showContactPicker && (
        <ContactPicker
          isOpen={showContactPicker}
          onClose={() => setShowContactPicker(false)}
          onSelect={handleForward}
          multiple={true}
          title="Forward Image"
        />
      )}
    </div>
  );
};

export default ImagePreview; 