import { useToast } from '@/components/ui/use-toast';

export interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export const downloadFile = async (
  url: string, 
  filename: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> => {
  try {
    // If it's already a blob URL, download directly
    if (url.startsWith('blob:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // If it's a data URL (base64), download directly
    if (url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // For remote URLs (including Appwrite), fetch as blob
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    // Read the response stream with progress tracking
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      loaded += value.length;
      
      if (onProgress && total > 0) {
        onProgress({
          loaded,
          total,
          percentage: Math.round((loaded / total) * 100)
        });
      }
    }

    // Create blob from chunks
    const blob = new Blob(chunks);
    const blobUrl = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up blob URL
    URL.revokeObjectURL(blobUrl);
    
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
};

export const downloadMultipleFiles = async (
  files: Array<{ url: string; filename: string }>,
  onProgress?: (currentFile: number, totalFiles: number, fileProgress: DownloadProgress) => void
): Promise<void> => {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    await downloadFile(file.url, file.filename, (progress) => {
      if (onProgress) {
        onProgress(i + 1, files.length, progress);
      }
    });
    
    // Small delay between downloads to prevent overwhelming the browser
    if (i < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}; 