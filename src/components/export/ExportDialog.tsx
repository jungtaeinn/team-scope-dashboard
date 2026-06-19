'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X, Download, Loader2 } from 'lucide-react';
import { ExportButton } from './ExportButton';

/** 내보내기 범위 유형 */
type ExportScope = 'team' | 'developers';

/** 포함할 시트 목록 */
interface SheetSelection {
  /** 팀 요약 시트 포함 여부 */
  teamSummary: boolean;
  /** 개발자 상세 시트 포함 여부 */
  developerDetail: boolean;
  /** Jira 이슈 시트 포함 여부 */
  jiraIssues: boolean;
  /** GitLab MR 시트 포함 여부 */
  gitlabMrs: boolean;
}

/** ExportDialog 컴포넌트 Props */
interface ExportDialogProps {
  /** 추가 클래스명 */
  className?: string;
}

/** 시트 체크박스 옵션 정의 */
const SHEET_OPTIONS: { key: keyof SheetSelection; label: string }[] = [
  { key: 'teamSummary', label: '팀 전체 요약' },
  { key: 'developerDetail', label: '개발자 상세' },
  { key: 'jiraIssues', label: 'Jira 이슈 목록' },
  { key: 'gitlabMrs', label: 'GitLab MR 목록' },
];

/**
 * 엑셀 내보내기 옵션 다이얼로그 컴포넌트
 * @description 내보내기 범위, 기간, 포함 시트를 선택하여 /api/export로 요청
 */
export function ExportDialog({ className }: ExportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [scope, setScope] = useState<ExportScope>('team');
  const [sheets, setSheets] = useState<SheetSelection>({
    teamSummary: true,
    developerDetail: true,
    jiraIssues: true,
    gitlabMrs: true,
  });

  const handleSheetToggle = useCallback((key: keyof SheetSelection) => {
    setSheets((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const selectedSheets = Object.entries(sheets)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key);

      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, sheets: selectedSheets }),
      });

      if (!res.ok) throw new Error('내보내기에 실패했습니다.');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `team-scope-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsOpen(false);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [scope, sheets]);

  const hasSelectedSheets = Object.values(sheets).some(Boolean);

  return (
    <div className={className}>
      <ExportButton onClick={() => setIsOpen(true)} />

      {/* 다이얼로그 오버레이 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            {/* 헤더 */}
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">엑셀 내보내기</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 내보내기 범위 */}
            <fieldset className="mb-5">
              <legend className="mb-2 text-sm font-medium text-gray-700">내보내기 범위</legend>
              <div className="flex gap-3">
                {([
                  { value: 'team', label: '팀 전체' },
                  { value: 'developers', label: '선택된 개발자' },
                ] as const).map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm transition-colors',
                      scope === option.value
                        ? 'border-blue-500 bg-blue-50 font-medium text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300',
                    )}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={option.value}
                      checked={scope === option.value}
                      onChange={() => setScope(option.value)}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* 포함 시트 */}
            <fieldset className="mb-6">
              <legend className="mb-2 text-sm font-medium text-gray-700">포함할 시트</legend>
              <div className="space-y-2">
                {SHEET_OPTIONS.map((option) => (
                  <label
                    key={option.key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={sheets[option.key]}
                      onChange={() => handleSheetToggle(option.key)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* 액션 */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isExporting}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || !hasSelectedSheets}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors',
                  'bg-green-600 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    내보내는 중...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    다운로드
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
