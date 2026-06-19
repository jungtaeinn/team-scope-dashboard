'use client';

import { cn } from '@/lib/utils';
import { Download } from 'lucide-react';

/** ExportButton 컴포넌트 Props */
interface ExportButtonProps {
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 추가 클래스명 */
  className?: string;
}

/**
 * 엑셀 다운로드 버튼 컴포넌트
 * @description 다운로드 아이콘과 텍스트를 표시하며, 클릭 시 ExportDialog를 트리거
 */
export function ExportButton({ onClick, className }: ExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors',
        'hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
        'active:bg-green-800',
        className,
      )}
    >
      <Download className="h-4 w-4" />
      엑셀 다운로드
    </button>
  );
}
