import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * A rounded search bar with subtle shadow and accent focus ring.
 * Matches the desktop two-column chat layout design.
 */
const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = '搜索用户...',
  className,
}) => {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-xl bg-background/70 pl-12 pr-4 shadow-sm backdrop-blur placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-accent-blue"
      />
    </div>
  );
};

export default SearchBar; 