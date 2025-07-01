export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  crop?: boolean;
}

export const createThumbnail = async (
  imageUrl: string,
  options: ThumbnailOptions = {}
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context not available');
        
        // Calculate dimensions
        const targetWidth = options.width || 300;
        const targetHeight = options.height || 200;
        const quality = options.quality || 0.8;
        
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = img.width;
        let sourceHeight = img.height;
        
        // Calculate aspect ratios
        const sourceAspect = img.width / img.height;
        const targetAspect = targetWidth / targetHeight;
        
        // Crop if needed
        if (options.crop && sourceAspect !== targetAspect) {
          if (sourceAspect > targetAspect) {
            // Source is wider - crop horizontally
            sourceWidth = img.height * targetAspect;
            sourceX = (img.width - sourceWidth) / 2;
          } else {
            // Source is taller - crop vertically
            sourceHeight = img.width / targetAspect;
            sourceY = (img.height - sourceHeight) / 2;
          }
        }
        
        // Set canvas dimensions
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Draw image to canvas
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, targetWidth, targetHeight
        );
        
        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = (err) => {
      reject(new Error('Image loading failed'));
    };
  });
}; 