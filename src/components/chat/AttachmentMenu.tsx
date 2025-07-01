import React from 'react';
import { ImageIcon, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AttachmentType = 'media' | 'file';

interface AttachmentMenuProps {
  open: boolean;
  onSelect: (type: AttachmentType) => void;
  className?: string;
}

const menuItems: { type: AttachmentType; label: string; icon: React.ElementType }[] = [
  { type: 'media', label: '照片/视频', icon: ImageIcon },
  { type: 'file', label: '文件', icon: FolderOpen },
];

const AttachmentMenu: React.FC<AttachmentMenuProps> = ({ open, onSelect, className }) => {
  if (!open) return null;

  return (
    <div
      className={cn(
        'absolute bottom-full mb-2 w-40 rounded-xl border bg-popover p-2 shadow-lg backdrop-blur transition-all',
        className,
      )}
    >
      {menuItems.map(({ type, label, icon: Icon }) => (
        <button
          key={type}
          onClick={() => onSelect(type)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted-foreground/10"
        >
          <Icon className="h-5 w-5 text-muted-foreground" />
          <span className="flex-1 text-foreground">{label}</span>
        </button>
      ))}
    </div>
  );
};

export default AttachmentMenu; 