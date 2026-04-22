import './load-env.mjs';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[TeamScope] DATABASE_URL 이 설정되어 있지 않아 느린 쿼리를 조회할 수 없습니다.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const result = await client.query<{
      calls: string;
      total_exec_time: string;
      mean_exec_time: string;
      rows: string;
      query: string | null;
    }>(`
      SELECT
        calls,
        round(total_exec_time::numeric, 2) AS total_exec_time,
        round(mean_exec_time::numeric, 2) AS mean_exec_time,
        rows,
        query
      FROM pg_stat_statements
      WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      ORDER BY mean_exec_time DESC
      LIMIT 20
    `);

    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[TeamScope] 느린 쿼리 조회 실패:', error);
  process.exit(1);
});
