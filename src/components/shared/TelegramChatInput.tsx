import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
  Send, 
  Paperclip, 
  Image as ImageIcon,
  Smile,
  FolderOpen,
  Mic,
  Square,
  X,
  Plus,
  Sticker,
  AtSign,
  Hash,
  Bold,
  Italic,
  Code,
  Link,
  Gift
} from 'lucide-react';
import EmojiPicker from '@/components/shared/EmojiPicker';
import FileUploadPreview from '@/components/shared/FileUploadPreview';
import AttachmentPanel, { AttachmentData, AttachmentType } from '@/components/chat/AttachmentPanel';

interface TelegramChatInputProps {
  onSendMessage: (content: string, type: 'text' | 'file', fileData?: any) => void;
  disabled?: boolean;
  placeholder?: string;
  isTyping?: boolean;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
}

const TelegramChatInput: React.FC<TelegramChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = "输入消息...",
  isTyping = false,
  onTypingStart,
  onTypingStop
}) => {
  const { toast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showAttachmentPanel, setShowAttachmentPanel] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [showFormatting, setShowFormatting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [fileProcessProgress, setFileProcessProgress] = useState(0);

  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 优化的外部点击关闭逻辑
  const handleClickOutside = useCallback((event: MouseEvent) => {
    const target = event.target as Element;
    const emojiContainer = target.closest('.emoji-picker-container');
    const emojiPickerElement = target.closest('[data-emoji-picker]');
    
    if (showEmojiPicker && !emojiContainer && !emojiPickerElement) {
      setShowEmojiPicker(false);
    }
    
    if (showAttachmentMenu && !target.closest('.attachment-menu-container')) {
      setShowAttachmentMenu(false);
    }
  }, [showEmojiPicker, showAttachmentMenu]);

  useEffect(() => {
    if (showEmojiPicker || showAttachmentMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker, showAttachmentMenu, handleClickOutside]);

  // 处理附件选择
  const handleAttachmentSelect = useCallback((type: AttachmentType, data: AttachmentData) => {
    switch (data.type) {
      case 'album':
      case 'photo':
        if (data.files && data.files.length > 0) {
          setPendingFiles(data.files);
          setShowFilePreview(true);
        }
        break;
      case 'file':
        if (data.files && data.files.length > 0) {
          onSendMessage(`[文件] ${data.files[0].name}`, 'file', { 
            file: data.files[0],
            size: data.files[0].size,
            type: data.files[0].type
          });
        }
        break;
      case 'location':
        if (data.location) {
          onSendMessage(
            `[位置] ${data.location.address || '位置信息'}`, 
            'text', 
            { 
              location: data.location,
              latitude: data.location.latitude,
              longitude: data.location.longitude
            }
          );
        }
        break;
      case 'contact':
        if (data.contact) {
          onSendMessage(
            `[联系人] ${data.contact.name} - ${data.contact.phone}`, 
            'text',
            { contact: data.contact }
          );
        }
        break;
    }
    setShowAttachmentPanel(false);
  }, [onSendMessage]);

  // 切换附件面板
  const toggleAttachmentPanel = useCallback(() => {
    setShowAttachmentPanel(prev => !prev);
    setShowAttachmentMenu(false);
    setShowEmojiPicker(false);
  }, []);

  // 自动调整文本框高度
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120;
      textareaRef.current.style.height = Math.min(scrollHeight, maxHeight) + 'px';
      textareaRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, []);

  // 处理输入变化
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    adjustTextareaHeight();
    
    if (e.target.value.trim() && !isTyping) {
      onTypingStart?.();
    }
    
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    
    typingTimerRef.current = setTimeout(() => {
      onTypingStop?.();
    }, 1000);
  }, [adjustTextareaHeight, isTyping, onTypingStart, onTypingStop]);

  // 发送消息
  const handleSendMessage = useCallback(() => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), 'text');
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      onTypingStop?.();
    }
  }, [message, disabled, onSendMessage, onTypingStop]);

  // 键盘事件处理（支持快捷键）
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Enter键发送（Shift+Enter换行）
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return; // 允许Shift+Enter换行
      } else {
        e.preventDefault();
        handleSendMessage();
      }
    }
    
    // Ctrl/Cmd + ; 快速打开表情选择器
    if ((e.ctrlKey || e.metaKey) && e.key === ';') {
      e.preventDefault();
      setShowEmojiPicker(!showEmojiPicker);
    }
    
    // Escape键关闭表情选择器
    if (e.key === 'Escape' && showEmojiPicker) {
      setShowEmojiPicker(false);
      textareaRef.current?.focus();
    }
  }, [handleSendMessage, showEmojiPicker]);

  // 表情选择处理
  const handleEmojiSelect = useCallback((emoji: string) => {
    if (!textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    
    const newMessage = message.substring(0, start) + emoji + message.substring(end);
    setMessage(newMessage);
    
    // 异步恢复焦点和光标位置
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPosition = start + emoji.length;
        textareaRef.current.setSelectionRange(newPosition, newPosition);
        adjustTextareaHeight();
      }
    }, 0);
  }, [message, adjustTextareaHeight]);

  // 表情按钮点击处理
  const handleEmojiButtonClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowEmojiPicker(prev => !prev);
    
    // 提供视觉反馈
    if (!showEmojiPicker) {
      emojiButtonRef.current?.classList.add('animate-pulse');
      setTimeout(() => {
        emojiButtonRef.current?.classList.remove('animate-pulse');
      }, 200);
    }
  }, [showEmojiPicker]);

  // 表情选择器关闭处理
  const handleEmojiPickerClose = useCallback(() => {
    setShowEmojiPicker(false);
    // 延迟恢复焦点，避免与点击事件冲突
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }, []);

  // 处理文件选择
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    
    const fileArray = Array.from(files);
    setPendingFiles(fileArray);
    setShowFilePreview(true);
  }, []);

  // 获取localStorage使用情况
  const getLocalStorageUsage = () => {
    try {
      let totalSize = 0;
      let usedSize = 0;
      
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const value = localStorage.getItem(key) || '';
          usedSize += key.length + value.length;
        }
      }
      
      // 估算localStorage总容量（通常是5-10MB）
      const estimatedCapacity = 5 * 1024 * 1024; // 5MB
      const usagePercentage = (usedSize / estimatedCapacity) * 100;
      
      return {
        usedSize,
        estimatedCapacity,
        usagePercentage: Math.min(usagePercentage, 100),
        freeSpace: Math.max(estimatedCapacity - usedSize, 0)
      };
    } catch (error) {
      console.error('获取localStorage使用情况失败:', error);
      return {
        usedSize: 0,
        estimatedCapacity: 5 * 1024 * 1024,
        usagePercentage: 0,
        freeSpace: 5 * 1024 * 1024
      };
    }
  };

  // 生成文件数据（包括预览和下载）
  const generateFileData = async (file: File): Promise<string | null> => {
    try {
      const fileSizeMB = file.size / 1024 / 1024;
      console.log('正在处理文件:', file.name, '大小:', fileSizeMB.toFixed(2) + 'MB');
      
      // 对于大文件（≥5MB），只返回基本信息，不生成base64
      // 降低阈值以应对localStorage空间不足的问题
      if (fileSizeMB >= 5) {
        console.log('大文件检测到，跳过base64生成以避免存储限制');
        return null; // 大文件不生成base64数据
      }
      
      // 小文件正常生成base64
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          console.log('文件读取成功:', file.name);
          resolve(e.target?.result as string || null);
        };
        reader.onerror = (error) => {
          console.error('文件读取失败:', error);
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('生成文件数据失败:', error);
      return null;
    }
  };

  // 确认文件上传
  const handleConfirmFileUpload = async (files: File[]) => {
    setIsProcessingFiles(true);
    setFileProcessProgress(0);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileSizeMB = file.size / 1024 / 1024;
        
        // 更新进度
        setFileProcessProgress(Math.round((i / files.length) * 100));
        
        // 对于大文件，只生成基本文件信息
        let fileBase64 = null;
        if (fileSizeMB < 5) {
          // 检查localStorage空间，如果接近满载就跳过base64生成
          try {
            const storageInfo = getLocalStorageUsage();
            if (storageInfo.usagePercentage > 80) {
              console.log('localStorage使用率过高，跳过base64生成');
              toast({
                title: '存储空间不足',
                description: '本地存储空间即将用完，建议清理历史记录',
                variant: 'destructive',
              });
            } else {
              fileBase64 = await generateFileData(file);
            }
          } catch (error) {
            console.log('检查存储空间失败，尝试生成base64:', error);
            fileBase64 = await generateFileData(file);
          }
        } else {
          console.log(`大文件 ${file.name} (${fileSizeMB.toFixed(2)}MB) 仅存储元数据`);
        }
        
        const fileData = {
          name: file.name,
          size: file.size,
          type: file.type,
          base64: fileBase64, // 小文件有base64，大文件为null
          url: null, // 如果以后要支持云存储URL
          isLargeFile: fileSizeMB >= 5, // 标记是否为大文件（降低阈值）
          file: fileSizeMB >= 5 ? file : undefined // 大文件临时保存File对象引用
        };
        
        onSendMessage(`发送了文件: ${file.name}`, 'file', fileData);
      }
      
      // 完成
      setFileProcessProgress(100);
      setTimeout(() => {
        setIsProcessingFiles(false);
        setFileProcessProgress(0);
      }, 500);
      
    } catch (error) {
      console.error('文件处理失败:', error);
      toast({
        title: '上传失败',
        description: error instanceof Error && error.message.includes('quota') 
          ? '文件太大，超出存储限制。请尝试发送较小的文件。'
          : '文件处理过程中出现错误，请重试',
        variant: 'destructive',
      });
      setIsProcessingFiles(false);
      setFileProcessProgress(0);
    }
    
    setPendingFiles([]);
    setShowFilePreview(false);
  };

  // 处理拖拽
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  // 附件菜单选项（保留传统方式作为备用）
  const attachmentOptions = [
    { icon: FolderOpen, label: '文件', action: () => document.getElementById('file-upload')?.click() },
    { icon: ImageIcon, label: '图片', action: () => document.getElementById('image-upload')?.click() },
    { icon: Plus, label: '更多附件', action: toggleAttachmentPanel },
  ];

  return (
    <div className="relative" ref={inputContainerRef}>
      {/* 拖拽覆盖层 */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary-500/20 border-2 border-dashed border-primary-500 rounded-xl flex items-center justify-center z-50">
          <div className="text-center">
            <FolderOpen className="w-12 h-12 text-primary-500 mx-auto mb-2" />
            <p className="text-primary-500 font-medium">拖放文件到这里</p>
          </div>
        </div>
      )}

      {/* 主输入区域 */}
      <div 
        className={`bg-dark-2/50 rounded-xl border border-dark-4/50 transition-all duration-200 relative ${
          isDragging ? 'border-primary-500' : 'focus-within:border-primary-500/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 快捷键提示 */}
        {message.length === 0 && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="text-xs text-light-4 bg-dark-3 px-2 py-1 rounded border border-dark-4">
              Ctrl+; 表情
            </div>
          </div>
        )}

        <div className="flex items-end gap-3 p-3">
          {/* 左侧按钮组 */}
          <div className="flex items-center gap-2">
            {/* 附件按钮 */}
            <div className="relative attachment-menu-container">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className={`w-10 h-10 rounded-xl transition-all duration-200 ${
                  showAttachmentMenu ? 'bg-primary-500/20 text-primary-400 scale-105' : 'hover:bg-primary-500/20 hover:text-primary-400 hover:scale-105'
                }`}
                title="附件 (支持拖拽)"
              >
                <Paperclip className={`w-5 h-5 transition-transform ${showAttachmentMenu ? 'rotate-45' : ''}`} />
              </Button>

              {/* 附件菜单 */}
              {showAttachmentMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-dark-2 border border-dark-4 rounded-lg shadow-lg z-30 min-w-[120px]">
                  <div className="p-2 space-y-1">
                    {attachmentOptions.map((option, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          option.action();
                          setShowAttachmentMenu(false);
                        }}
                        className="w-full justify-start text-light-2 hover:text-light-1 hover:bg-dark-3 transition-colors"
                      >
                        <option.icon className="w-4 h-4 mr-3" />
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 文本输入区域 */}
          <div className="flex-1 relative group">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full bg-transparent text-light-1 placeholder-light-4 resize-none border-0 outline-none min-h-[44px] max-h-[120px] py-2 px-3 rounded-lg focus:ring-0 transition-colors"
              style={{ lineHeight: '1.4' }}
            />
            
            {/* 字符计数 */}
            {message.length > 500 && (
              <div className="absolute bottom-1 right-1 text-xs text-light-4 bg-dark-2/80 px-1 rounded">
                {message.length}/2000
              </div>
            )}
          </div>

          {/* 右侧按钮组 */}
          <div className="flex items-center gap-2">
            {/* 表情按钮 */}
            <div className="relative emoji-picker-container">
              <Button
                ref={emojiButtonRef}
                variant="ghost"
                size="sm"
                onClick={handleEmojiButtonClick}
                className={`w-10 h-10 rounded-xl transition-all duration-200 ${
                  showEmojiPicker 
                    ? 'bg-primary-500/20 text-primary-400 scale-105' 
                    : 'hover:bg-primary-500/20 hover:text-primary-400 hover:scale-105'
                }`}
                title="表情 (Ctrl+;)"
              >
                <Smile className={`w-5 h-5 transition-transform ${showEmojiPicker ? 'scale-110' : ''}`} />
              </Button>

              <EmojiPicker
                isOpen={showEmojiPicker}
                onClose={handleEmojiPickerClose}
                onEmojiSelect={handleEmojiSelect}
                triggerElement={emojiButtonRef}
              />
            </div>

            {/* 发送按钮 / 处理进度 */}
            {isProcessingFiles ? (
              <div className="relative w-10 h-10">
                {/* 处理进度圆环 */}
                <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="stroke-gray-300"
                    strokeWidth="3"
                    fill="transparent"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="stroke-primary-500"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="transparent"
                    strokeDasharray={`${fileProcessProgress}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-primary-500">
                    {fileProcessProgress}%
                  </span>
                </div>
              </div>
            ) : (
              <Button
                onClick={handleSendMessage}
                disabled={!message.trim() || disabled}
                className={`w-10 h-10 rounded-xl bg-gradient-to-r from-primary-500 to-purple-500 hover:from-primary-600 hover:to-purple-600 text-white border-0 transition-all duration-200 ${
                  message.trim() && !disabled 
                    ? 'scale-100 hover:scale-105 shadow-lg hover:shadow-xl' 
                    : 'scale-95 opacity-50'
                }`}
                title={message.trim() ? '发送消息 (Enter)' : '输入消息以发送'}
              >
                <Send className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        type="file"
        id="file-upload"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />
      <input
        type="file"
        id="image-upload"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* 文件预览模态框 */}
      {showFilePreview && (
        <FileUploadPreview
          files={pendingFiles}
          onConfirmUpload={() => handleConfirmFileUpload(pendingFiles)}
          onCancel={() => {
            setPendingFiles([]);
            setShowFilePreview(false);
          }}
          onRemoveFile={(index) => {
            setPendingFiles(prev => prev.filter((_, i) => i !== index));
          }}
        />
      )}

      {/* 附件面板 */}
      <AttachmentPanel
        isOpen={showAttachmentPanel}
        onClose={() => setShowAttachmentPanel(false)}
        onAttachmentSelect={handleAttachmentSelect}
      />
    </div>
  );
};

export default TelegramChatInput; 