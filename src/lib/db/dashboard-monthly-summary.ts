import { prisma } from '@/lib/db';

export interface DashboardMonthlySummaryRow {
  workspaceId: string;
  periodStart: Date;
  period: string;
  developerCount: number;
  avgJira: number;
  avgGitlab: number;
  avgComposite: number;
}

export async function refreshDashboardMonthlySummaryView() {
  try {
    await prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW dashboard_monthly_summary_mv');
  } catch (error) {
    console.warn('[DB] dashboard_monthly_summary_mv 새로고침 실패:', error);
  }
}

export async function getDashboardMonthlySummary(params: {
  workspaceId: string;
  from: Date;
  to: Date;
}) {
  const rows = await prisma.$queryRawUnsafe<DashboardMonthlySummaryRow[]>(
    `
      SELECT
        "workspaceId",
        "periodStart",
        period,
        "developerCount",
        "avgJira",
        "avgGitlab",
        "avgComposite"
      FROM dashboard_monthly_summary_mv
      WHERE "workspaceId" = $1
        AND "periodStart" >= $2
        AND "periodStart" <= $3
      ORDER BY "periodStart" ASC
    `,
    params.workspaceId,
    params.from,
    params.to,
  );

  return rows;
}
