import { saveAs } from 'file-saver';

export interface FileProcessOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  quality?: number;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  warnings?: string[];
}

export class FileService {
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly SUPPORTED_IMAGE_TYPES = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'
  ];
  private static readonly SUPPORTED_VIDEO_TYPES = [
    'video/mp4', 'video/webm', 'video/quicktime', 'video/avi'
  ];
  private static readonly SUPPORTED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-rar-compressed',
    'text/plain',
    'text/csv'
  ];

  /**
   * 压缩图片文件
   */
  static async compressImage(file: File, options: FileProcessOptions = {}): Promise<File> {
    const defaultOptions = {
      maxSizeMB: 5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      quality: 0.8,
      ...options
    };

    try {
      if (!this.SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        throw new Error(`不支持的图片格式: ${file.type}`);
      }

      // 如果文件已经很小，直接返回
      if (file.size <= defaultOptions.maxSizeMB! * 1024 * 1024) {
        return file;
      }

      // 使用Canvas进行压缩
      const compressedFile = await this.compressImageWithCanvas(file, defaultOptions);
      
      return new File([compressedFile], file.name, {
        type: compressedFile.type,
        lastModified: Date.now(),
      });
    } catch (error) {
      console.error('Image compression failed:', error);
      throw new Error('图片压缩失败');
    }
  }

  /**
   * 使用Canvas压缩图片
   */
  private static async compressImageWithCanvas(file: File, options: FileProcessOptions): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'));
        return;
      }

      img.onload = () => {
        // 计算新尺寸
        const { width, height } = this.calculateNewDimensions(
          img.width, 
          img.height, 
          options.maxWidthOrHeight || 1920
        );

        canvas.width = width;
        canvas.height = height;

        // 绘制压缩后的图片
        ctx.drawImage(img, 0, 0, width, height);

        // 转换为Blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          file.type,
          options.quality || 0.8
        );
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 计算新的图片尺寸
   */
  private static calculateNewDimensions(width: number, height: number, maxSize: number) {
    if (width <= maxSize && height <= maxSize) {
      return { width, height };
    }

    const ratio = Math.min(maxSize / width, maxSize / height);
    return {
      width: Math.floor(width * ratio),
      height: Math.floor(height * ratio)
    };
  }

  /**
   * 验证文件
   */
  static validateFile(file: File): FileValidationResult {
    const warnings: string[] = [];

    // 检查文件大小
    if (file.size > this.MAX_FILE_SIZE) {
      return { isValid: false, error: `文件大小不能超过${this.formatFileSize(this.MAX_FILE_SIZE)}` };
    }

    // 检查文件类型
    const isImage = this.SUPPORTED_IMAGE_TYPES.includes(file.type);
    const isVideo = this.SUPPORTED_VIDEO_TYPES.includes(file.type);
    const isDocument = this.SUPPORTED_DOCUMENT_TYPES.includes(file.type);

    if (!isImage && !isVideo && !isDocument) {
      return { isValid: false, error: `不支持的文件格式: ${file.type}` };
    }

    // 大文件警告
    if (file.size > 10 * 1024 * 1024) { // 10MB
      warnings.push(`文件较大(${this.formatFileSize(file.size)})，上传可能需要较长时间`);
    }

    // 图片尺寸警告
    if (isImage && file.size > 5 * 1024 * 1024) { // 5MB
      warnings.push('图片文件较大，建议压缩后上传');
    }

    return { isValid: true, warnings };
  }

  /**
   * 批量验证文件
   */
  static validateFiles(files: File[]): { valid: File[]; invalid: { file: File; error: string }[] } {
    const valid: File[] = [];
    const invalid: { file: File; error: string }[] = [];

    files.forEach(file => {
      const result = this.validateFile(file);
      if (result.isValid) {
        valid.push(file);
      } else {
        invalid.push({ file, error: result.error || '未知错误' });
      }
    });

    return { valid, invalid };
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * 生成文件缩略图
   */
  static async generateThumbnail(file: File, maxSize: number = 150): Promise<string> {
    if (!this.SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('只能为图片文件生成缩略图');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'));
        return;
      }

      img.onload = () => {
        const { width, height } = this.calculateNewDimensions(img.width, img.height, maxSize);
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 获取文件类型图标
   */
  static getFileTypeIcon(file: File): string {
    const type = file.type.toLowerCase();
    
    if (this.SUPPORTED_IMAGE_TYPES.includes(type)) {
      return '🖼️';
    } else if (this.SUPPORTED_VIDEO_TYPES.includes(type)) {
      return '🎥';
    } else if (type.includes('pdf')) {
      return '📄';
    } else if (type.includes('word') || type.includes('document')) {
      return '📝';
    } else if (type.includes('excel') || type.includes('spreadsheet')) {
      return '📊';
    } else if (type.includes('powerpoint') || type.includes('presentation')) {
      return '📈';
    } else if (type.includes('zip') || type.includes('rar')) {
      return '🗜️';
    } else if (type.includes('text')) {
      return '📋';
    }
    
    return '📎';
  }

  /**
   * 下载文件
   */
  static downloadFile(file: File, filename?: string): void {
    saveAs(file, filename || file.name);
  }

  /**
   * 读取文件为Base64
   */
  static async readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // 移除data:image/jpeg;base64,前缀
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * 读取文件为文本
   */
  static async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * 获取视频时长
   */
  static async getVideoDuration(file: File): Promise<number> {
    if (!this.SUPPORTED_VIDEO_TYPES.includes(file.type)) {
      throw new Error('不是有效的视频文件');
    }

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        resolve(video.duration);
      };

      video.onerror = () => reject(new Error('无法读取视频元数据'));
      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * 生成视频缩略图
   */
  static async generateVideoThumbnail(file: File, time: number = 1): Promise<string> {
    if (!this.SUPPORTED_VIDEO_TYPES.includes(file.type)) {
      throw new Error('不是有效的视频文件');
    }

    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'));
        return;
      }

      video.onloadedmetadata = () => {
        video.currentTime = time;
      };

      video.onseeked = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };

      video.onerror = () => reject(new Error('视频缩略图生成失败'));
      video.src = URL.createObjectURL(file);
    });
  }
} 