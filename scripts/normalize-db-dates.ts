import 'dotenv/config';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[TeamScope] DATABASE_URL 이 설정되어 있지 않아 날짜 정규화를 진행할 수 없습니다.');
  process.exit(1);
}

const statements = [
  `UPDATE "JiraIssue"
   SET
     "ganttStartOn" = CASE WHEN nullif("ganttStartDate", '') IS NULL THEN NULL ELSE nullif("ganttStartDate", '')::date END,
     "ganttEndOn" = CASE WHEN nullif("ganttEndDate", '') IS NULL THEN NULL ELSE nullif("ganttEndDate", '')::date END,
     "baselineStartOn" = CASE WHEN nullif("baselineStart", '') IS NULL THEN NULL ELSE nullif("baselineStart", '')::date END,
     "baselineEndOn" = CASE WHEN nullif("baselineEnd", '') IS NULL THEN NULL ELSE nullif("baselineEnd", '')::date END,
     "dueOn" = CASE WHEN nullif("dueDate", '') IS NULL THEN NULL ELSE nullif("dueDate", '')::date END`,
  `UPDATE "GitlabMR"
   SET
     "mrCreatedAtTs" = COALESCE(nullif("mrCreatedAt", '')::timestamptz, "createdAt"),
     "mrMergedAtTs" = CASE WHEN nullif("mrMergedAt", '') IS NULL THEN NULL ELSE nullif("mrMergedAt", '')::timestamptz END`,
  `UPDATE "GitlabNote"
   SET
     "noteCreatedAtTs" = COALESCE(nullif("noteCreatedAt", '')::timestamptz, "createdAt")`,
  `UPDATE "Score"
   SET
     "periodStart" = to_date(period || '-01', 'YYYY-MM-DD')`,
  'ANALYZE',
];

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('[TeamScope] 날짜 정규화 컬럼을 백필합니다...');
    for (const statement of statements) {
      await client.query(statement);
    }
    console.log('[TeamScope] 날짜 정규화 완료');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[TeamScope] 날짜 정규화 실패:', error);
  process.exit(1);
});
