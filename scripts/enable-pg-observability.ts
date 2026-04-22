import './load-env.mjs';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
const containerName = process.env.TEAMSCOPE_DB_CONTAINER ?? 'teamscope-postgres';

if (!connectionString) {
  console.error('[TeamScope] DATABASE_URL 이 설정되어 있지 않아 pg_stat_statements 를 설정할 수 없습니다.');
  process.exit(1);
}

async function querySetting(client: Client, name: string) {
  const result = await client.query<{ setting: string }>(`SHOW ${name}`);
  return result.rows[0]?.setting ?? '';
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectClient() {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

async function reconnectWithRetry() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await connectClient();
    } catch (error) {
      if (attempt === 19) throw error;
      await wait(1000);
    }
  }

  throw new Error('PostgreSQL 재연결에 실패했습니다.');
}

async function main() {
  let client = await connectClient();

  try {
    const sharedPreloadLibraries = await querySetting(client, 'shared_preload_libraries');
    const computeQueryId = await querySetting(client, 'compute_query_id');

    const libraries = sharedPreloadLibraries
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    let requiresRestart = false;

    if (!libraries.includes('pg_stat_statements')) {
      libraries.push('pg_stat_statements');
      const nextValue = libraries.join(',');
      await client.query(`ALTER SYSTEM SET shared_preload_libraries = '${nextValue}'`);
      requiresRestart = true;
    }

    if (!['auto', 'on'].includes(computeQueryId)) {
      await client.query(`ALTER SYSTEM SET compute_query_id = 'auto'`);
      requiresRestart = true;
    }

    await client.end();

    if (requiresRestart) {
      console.log('[TeamScope] pg_stat_statements 활성화를 위해 PostgreSQL 컨테이너를 재시작합니다...');
      execFileSync('docker', ['restart', containerName], { stdio: 'inherit' });
    }

    client = await reconnectWithRetry();
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
    console.log('[TeamScope] pg_stat_statements 활성화 완료');
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error('[TeamScope] pg_stat_statements 설정 실패:', error);
  process.exit(1);
});
