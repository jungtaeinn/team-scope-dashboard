'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { Search, X, Sparkles } from 'lucide-react';

type SearchMode = 'text' | 'prompt';

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mode?: SearchMode;
  className?: string;
}

export function SearchFilter({ value, onChange, placeholder = '검색어를 입력하세요...', mode = 'text', className }: SearchFilterProps) {
  const [currentMode, setCurrentMode] = useState<SearchMode>(mode);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClear = useCallback(() => onChange(''), [onChange]);
  const handleModeToggle = useCallback(() => {
    if (currentMode === 'text') { setShowTooltip(true); setTimeout(() => setShowTooltip(false), 2000); }
    else setCurrentMode('text');
  }, [currentMode]);

  const isPromptMode = currentMode === 'prompt';

  return (
    <div className={cn('relative flex items-center', className)}>
      <Search className={cn('absolute left-3 h-4 w-4', isPromptMode ? 'text-purple-400' : 'text-[var(--muted-foreground)]')} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isPromptMode ? 'AI 프롬프트 입력...' : placeholder}
        className={cn(
          'h-9 w-full rounded-lg border bg-[var(--background)] py-2 pl-9 pr-16 text-sm text-[var(--foreground)] transition-colors focus:outline-none focus:ring-1',
          isPromptMode
            ? 'border-purple-200 bg-purple-50 focus:border-purple-400 focus:ring-purple-400 dark:border-purple-800 dark:bg-purple-950'
            : 'focus:border-[var(--primary)] focus:ring-[var(--primary)]',
        )}
      />
      <div className="absolute right-2 flex items-center gap-1">
        {value && (
          <button type="button" onClick={handleClear} className="rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            onClick={handleModeToggle}
            onMouseEnter={() => currentMode === 'text' && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className={cn(
              'rounded p-1 transition-colors',
              isPromptMode ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]',
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
          {showTooltip && (
            <div className="absolute bottom-full right-0 z-50 mb-1.5 whitespace-nowrap rounded-md bg-[var(--popover)] border px-2.5 py-1.5 text-xs text-[var(--popover-foreground)] shadow-lg">
              추후 Azure AI 연동 예정
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
