import 'dotenv/config';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[TeamScope] DATABASE_URL 이 설정되어 있지 않아 대시보드 materialized view 를 새로고침할 수 없습니다.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('REFRESH MATERIALIZED VIEW dashboard_monthly_summary_mv');
    console.log('[TeamScope] dashboard_monthly_summary_mv 새로고침 완료');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[TeamScope] dashboard materialized view 새로고침 실패:', error);
  process.exit(1);
});
