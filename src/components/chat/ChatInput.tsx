import React, { useState, useRef, useEffect } from 'react';
import { Smile, Send, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import EmojiPicker from '@/components/shared/EmojiPicker';
import AttachmentMenu, { AttachmentType } from '@/components/chat/AttachmentMenu';

interface ChatInputProps {
  onSend: (text: string) => void;
  onAttach?: (type: AttachmentType) => void;
  className?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, onAttach, className }) => {
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const attachRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(message.trim());
    setMessage('');
    setShowAttach(false);
  };

  const addEmoji = (emoji: string) => {
    setMessage((prev) => prev + emoji);
  };

  const handleAttachSelect = (type: AttachmentType) => {
    onAttach?.(type);
    setShowAttach(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(event.target as Node)) {
        setShowAttach(false);
      }
    };

    if (showAttach) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAttach]);

  return (
    <div className={cn('relative border-t bg-background/60 px-4 py-3 backdrop-blur', className)}>
      <div className="flex items-center gap-2">
        <div className="relative" ref={attachRef}>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg"
            onClick={() => {
              setShowAttach((p) => !p);
              setShowEmoji(false);
            }}
            aria-label="附件"
          >
            <Plus className="h-5 w-5 text-muted-foreground" />
          </Button>
          <AttachmentMenu open={showAttach} onSelect={handleAttachSelect} className="absolute bottom-full mb-1" />
        </div>

        <div className="relative flex-1">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="输入消息..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="rounded-xl bg-background/70 px-4 py-3 shadow-inner placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-accent-blue"
          />

          {showEmoji && (
            <div className="absolute bottom-full mb-2 right-0 z-20">
              <EmojiPicker
                isOpen={showEmoji}
                onClose={() => setShowEmoji(false)}
                onEmojiSelect={(emoji) => addEmoji(emoji)}
              />
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg"
          onClick={() => {
            setShowEmoji((p) => !p);
            setShowAttach(false);
          }}
          aria-label="表情"
        >
          <Smile className="h-5 w-5 text-muted-foreground" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className={cn('h-10 w-10 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-lg', message.trim() && 'bg-accent-blue text-white hover:bg-accent-blue')}
          onClick={handleSend}
          disabled={!message.trim()}
          aria-label="发送"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export default ChatInput; 