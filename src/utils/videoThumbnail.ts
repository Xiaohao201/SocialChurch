export interface FrameAnalysis {
  timestamp: number;
  brightness: number;
  colorVariance: number;
  edgeScore: number;
  overallScore: number;
  canvas?: HTMLCanvasElement;
}

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  sampleCount?: number;
  avoidStartEnd?: boolean;
  minBrightness?: number;
  preferredTimestamps?: number[];
}

export class IntelligentVideoThumbnail {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.video = document.createElement('video');
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    
    // Configure video for thumbnail generation
    this.video.crossOrigin = 'anonymous';
    this.video.muted = true;
    this.video.playsInline = true;
  }

  // Analyze frame quality metrics
  private analyzeFrame(imageData: ImageData): { brightness: number; colorVariance: number; edgeScore: number } {
    const data = imageData.data;
    const pixelCount = data.length / 4;
    
    let totalBrightness = 0;
    let totalR = 0, totalG = 0, totalB = 0;
    let rVariance = 0, gVariance = 0, bVariance = 0;
    let edgeScore = 0;
    
    // First pass: calculate averages
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Brightness using luminance formula
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b);
      totalBrightness += brightness;
      
      totalR += r;
      totalG += g;
      totalB += b;
    }
    
    const avgBrightness = totalBrightness / pixelCount;
    const avgR = totalR / pixelCount;
    const avgG = totalG / pixelCount;
    const avgB = totalB / pixelCount;
    
    // Second pass: calculate variance and edge detection
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      rVariance += Math.pow(r - avgR, 2);
      gVariance += Math.pow(g - avgG, 2);
      bVariance += Math.pow(b - avgB, 2);
      
      // Simple edge detection (comparing with adjacent pixels)
      if (i < data.length - 16) { // Make sure we don't go out of bounds
        const nextR = data[i + 4] || 0;
        const nextG = data[i + 5] || 0;
        const nextB = data[i + 6] || 0;
        
        const edgeMagnitude = Math.abs(r - nextR) + Math.abs(g - nextG) + Math.abs(b - nextB);
        edgeScore += edgeMagnitude;
      }
    }
    
    const colorVariance = (rVariance + gVariance + bVariance) / (3 * pixelCount);
    const normalizedEdgeScore = edgeScore / pixelCount;
    
    return {
      brightness: avgBrightness,
      colorVariance: Math.sqrt(colorVariance),
      edgeScore: normalizedEdgeScore
    };
  }

  // Calculate overall frame quality score
  private calculateFrameScore(analysis: { brightness: number; colorVariance: number; edgeScore: number }): number {
    const { brightness, colorVariance, edgeScore } = analysis;
    
    // Penalize very dark frames (likely black frames)
    const brightnessScore = brightness < 30 ? 0 : Math.min(brightness / 128, 1);
    
    // Reward color variety (avoid solid color frames)
    const varietyScore = Math.min(colorVariance / 50, 1);
    
    // Reward edge content (indicates detail/interesting content)
    const detailScore = Math.min(edgeScore / 20, 1);
    
    // Weighted combination
    return (brightnessScore * 0.4) + (varietyScore * 0.3) + (detailScore * 0.3);
  }

  // Sample frames at strategic timestamps
  private generateSampleTimestamps(duration: number, options: ThumbnailOptions): number[] {
    const sampleCount = options.sampleCount || 10;
    const avoidStartEnd = options.avoidStartEnd !== false;
    
    const timestamps: number[] = [];
    
    // Add preferred timestamps if provided
    if (options.preferredTimestamps) {
      timestamps.push(...options.preferredTimestamps.filter(t => t >= 0 && t <= duration));
    }
    
    // Calculate range to sample from
    const startOffset = avoidStartEnd ? Math.min(duration * 0.1, 5) : 0; // Skip first 10% or 5 seconds
    const endOffset = avoidStartEnd ? Math.min(duration * 0.1, 5) : 0;   // Skip last 10% or 5 seconds
    const sampleDuration = duration - startOffset - endOffset;
    
    if (sampleDuration <= 0) {
      // Very short video, just sample from middle
      timestamps.push(duration / 2);
      return timestamps;
    }
    
    // Strategic sampling points
    const strategicPoints = [
      0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8  // Avoid very beginning and end
    ];
    
    for (let i = 0; i < sampleCount; i++) {
      let timestamp;
      
      if (i < strategicPoints.length) {
        // Use strategic points first
        timestamp = startOffset + (sampleDuration * strategicPoints[i]);
      } else {
        // Fill remaining with evenly spaced samples
        const progress = i / (sampleCount - 1);
        timestamp = startOffset + (sampleDuration * progress);
      }
      
      timestamps.push(timestamp);
    }
    
    // Remove duplicates and sort
    return [...new Set(timestamps)].sort((a, b) => a - b);
  }

  // Analyze a single frame at given timestamp
  private async analyzeFrameAtTimestamp(timestamp: number): Promise<FrameAnalysis | null> {
    return new Promise((resolve) => {
      const onSeeked = () => {
        try {
          // Draw current frame to canvas
          this.canvas.width = this.video.videoWidth || 320;
          this.canvas.height = this.video.videoHeight || 240;
          
          this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
          
          // Get image data for analysis
          const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          const analysis = this.analyzeFrame(imageData);
          const score = this.calculateFrameScore(analysis);
          
          // Create a copy of the canvas for this frame
          const frameCanvas = document.createElement('canvas');
          frameCanvas.width = this.canvas.width;
          frameCanvas.height = this.canvas.height;
          const frameCtx = frameCanvas.getContext('2d')!;
          frameCtx.drawImage(this.canvas, 0, 0);
          
          const result: FrameAnalysis = {
            timestamp,
            brightness: analysis.brightness,
            colorVariance: analysis.colorVariance,
            edgeScore: analysis.edgeScore,
            overallScore: score,
            canvas: frameCanvas
          };
          
          this.video.removeEventListener('seeked', onSeeked);
          resolve(result);
        } catch (error) {
          console.error('Error analyzing frame:', error);
          this.video.removeEventListener('seeked', onSeeked);
          resolve(null);
        }
      };
      
      this.video.addEventListener('seeked', onSeeked, { once: true });
      this.video.currentTime = timestamp;
    });
  }

  // Main method to generate intelligent thumbnail
  async generateThumbnail(
    videoSrc: string, 
    options: ThumbnailOptions = {}
  ): Promise<{ dataUrl: string; timestamp: number; analysis: FrameAnalysis } | null> {
    try {
      // Load video
      await new Promise<void>((resolve, reject) => {
        const onLoadedMetadata = () => {
          this.video.removeEventListener('loadedmetadata', onLoadedMetadata);
          resolve();
        };
        
        const onError = () => {
          this.video.removeEventListener('error', onError);
          reject(new Error('Failed to load video'));
        };
        
        this.video.addEventListener('loadedmetadata', onLoadedMetadata);
        this.video.addEventListener('error', onError);
        this.video.src = videoSrc;
      });
      
      const duration = this.video.duration;
      if (!duration || duration === 0) {
        throw new Error('Invalid video duration');
      }
      
      // Generate sample timestamps
      const timestamps = this.generateSampleTimestamps(duration, options);
      
      // Analyze frames at each timestamp
      const analyses: FrameAnalysis[] = [];
      
      for (const timestamp of timestamps) {
        const analysis = await this.analyzeFrameAtTimestamp(timestamp);
        if (analysis && analysis.overallScore > (options.minBrightness || 0.1)) {
          analyses.push(analysis);
        }
      }
      
      if (analyses.length === 0) {
        throw new Error('No suitable frames found');
      }
      
      // Select best frame
      const bestFrame = analyses.reduce((best, current) => 
        current.overallScore > best.overallScore ? current : best
      );
      
      // Generate final thumbnail with desired dimensions
      const finalWidth = options.width || 320;
      const finalHeight = options.height || 240;
      
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = finalWidth;
      finalCanvas.height = finalHeight;
      const finalCtx = finalCanvas.getContext('2d')!;
      
      // Draw and scale the best frame
      if (bestFrame.canvas) {
        finalCtx.drawImage(bestFrame.canvas, 0, 0, finalWidth, finalHeight);
      }
      
      const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.8);
      
      return {
        dataUrl,
        timestamp: bestFrame.timestamp,
        analysis: bestFrame
      };
      
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return null;
    }
  }

  // Cleanup method
  cleanup() {
    if (this.video.src) {
      this.video.src = '';
    }
  }
}

// Convenience function for easy usage
export const generateIntelligentVideoThumbnail = async (
  videoSrc: string,
  options: ThumbnailOptions = {}
): Promise<string | null> => {
  const generator = new IntelligentVideoThumbnail();
  
  try {
    const result = await generator.generateThumbnail(videoSrc, options);
    return result?.dataUrl || null;
  } finally {
    generator.cleanup();
  }
};

// Fallback simple thumbnail generator
export const generateSimpleVideoThumbnail = async (
  videoSrc: string,
  timestamp: number = 0,
  width: number = 320,
  height: number = 240
): Promise<string | null> => {
  try {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = videoSrc;
    });
    
    video.currentTime = timestamp;
    
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error('Simple thumbnail generation failed:', error);
    return null;
  }
}; 