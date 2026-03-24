'use client';

import { useState, useCallback } from 'react';

/** 내보내기 옵션 */
interface ExportOptions {
  /** 내보내기 범위 ('team' | 'developers') */
  scope?: 'team' | 'developers';
  /** 포함할 시트 키 배열 */
  sheets?: string[];
  /** 기간 필터 */
  period?: string;
  /** 선택된 개발자 ID 배열 */
  developerIds?: string[];
}

/** useExport 반환 타입 */
interface UseExportReturn {
  /** 엑셀 파일 내보내기 실행 함수 */
  exportToExcel: (options?: ExportOptions) => Promise<void>;
  /** 내보내기 진행 중 여부 */
  isExporting: boolean;
}

/**
 * 엑셀 내보내기 액션 훅
 * @description /api/export 엔드포인트를 호출하고 브라우저 다운로드를 트리거합니다.
 * @returns exportToExcel 함수와 isExporting 상태
 */
export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);

  const exportToExcel = useCallback(async (options?: ExportOptions) => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: options?.scope ?? 'team',
          sheets: options?.sheets ?? ['teamSummary', 'developerDetail', 'jiraIssues', 'gitlabMrs'],
          period: options?.period,
          developerIds: options?.developerIds,
        }),
      });

      if (!res.ok) throw new Error('내보내기 요청에 실패했습니다.');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `team-scope-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel export failed:', error);
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, []);

  return { exportToExcel, isExporting };
}
