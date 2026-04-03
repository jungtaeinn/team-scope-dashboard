import 'dotenv/config';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[TeamScope] DATABASE_URL 이 설정되어 있지 않아 대시보드 materialized view 를 설정할 수 없습니다.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('DROP MATERIALIZED VIEW IF EXISTS dashboard_monthly_summary_mv');
    await client.query(`
      CREATE MATERIALIZED VIEW dashboard_monthly_summary_mv AS
      SELECT
        "workspaceId",
        "periodStart",
        period,
        COUNT(*)::int AS "developerCount",
        ROUND(AVG("jiraScore")::numeric, 2) AS "avgJira",
        ROUND(AVG("gitlabScore")::numeric, 2) AS "avgGitlab",
        ROUND(AVG("compositeScore")::numeric, 2) AS "avgComposite"
      FROM "Score"
      GROUP BY "workspaceId", "periodStart", period
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS dashboard_monthly_summary_mv_workspace_period_idx
      ON dashboard_monthly_summary_mv ("workspaceId", "periodStart")
    `);
    console.log('[TeamScope] dashboard_monthly_summary_mv 생성 완료');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[TeamScope] dashboard materialized view 설정 실패:', error);
  process.exit(1);
});
