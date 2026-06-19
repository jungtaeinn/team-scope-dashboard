import { SCORE_STATUS_THRESHOLDS } from '@/common/constants';
import type { ZoomableLineDataRow } from '@/components/charts';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundToFive(value: number) {
  return Math.round(value / 5) * 5;
}

export function buildDynamicScoreThresholds(trendData: ZoomableLineDataRow[]) {
  if (!trendData.length) {
    return SCORE_STATUS_THRESHOLDS.composite;
  }

  const averages = ['composite', 'jira', 'gitlab'].map((key) => {
    const values = trendData
      .map((row) => Number(row[key] ?? 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });

  const validAverages = averages.filter((value) => value > 0);
  if (!validAverages.length) {
    return SCORE_STATUS_THRESHOLDS.composite;
  }

  const minAverage = Math.min(...validAverages);
  const maxAverage = Math.max(...validAverages);
  const meanAverage = validAverages.reduce((sum, value) => sum + value, 0) / validAverages.length;
  const spread = Math.max(8, maxAverage - minAverage);

  const warnMin = clamp(roundToFive(minAverage - Math.max(5, spread * 0.25)), 20, 75);
  const goodMin = clamp(roundToFive(meanAverage + Math.max(8, spread * 0.35)), warnMin + 10, 95);

  return { warnMin, goodMin };
}
