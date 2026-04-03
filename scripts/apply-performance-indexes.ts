import 'dotenv/config';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[TeamScope] DATABASE_URL 이 설정되어 있지 않아 성능 최적화 인덱스를 적용할 수 없습니다.');
  process.exit(1);
}

const statements = [
  'DROP INDEX IF EXISTS jira_issue_workspace_assignee_gantt_start_idx',
  'DROP INDEX IF EXISTS jira_issue_workspace_assignee_gantt_end_idx',
  'DROP INDEX IF EXISTS jira_issue_workspace_assignee_due_idx',
  'DROP INDEX IF EXISTS gitlab_mr_workspace_author_created_idx',
  'DROP INDEX IF EXISTS gitlab_mr_workspace_author_merged_idx',
  'DROP INDEX IF EXISTS gitlab_note_workspace_author_created_idx',
  `CREATE INDEX IF NOT EXISTS account_user_provider_idx
    ON account ("userId", "providerId")`,
  `CREATE INDEX IF NOT EXISTS session_user_updated_desc_idx
    ON session ("userId", "updatedAt" DESC)`,
  `CREATE INDEX IF NOT EXISTS member_organization_user_idx
    ON member ("organizationId", "userId")`,
  `CREATE INDEX IF NOT EXISTS invitation_pending_email_expires_idx
    ON invitation (lower(email), "expiresAt")
    WHERE status = 'pending'`,
  `CREATE INDEX IF NOT EXISTS invitation_organization_pending_email_idx
    ON invitation ("organizationId", lower(email))
    WHERE status = 'pending'`,
  `CREATE INDEX IF NOT EXISTS developer_workspace_active_name_idx
    ON "Developer" ("workspaceId", name)
    INCLUDE (id)
    WHERE "isActive" = true`,
  `CREATE INDEX IF NOT EXISTS score_workspace_period_start_developer_idx
    ON "Score" ("workspaceId", "periodStart", "developerId")`,
  `CREATE INDEX IF NOT EXISTS jira_issue_workspace_assignee_updated_idx
    ON "JiraIssue" ("workspaceId", "assigneeId", "updatedAt" DESC)
    WHERE "assigneeId" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS jira_issue_workspace_assignee_gantt_start_idx
    ON "JiraIssue" ("workspaceId", "assigneeId", "ganttStartOn")
    WHERE "assigneeId" IS NOT NULL AND "ganttStartOn" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS jira_issue_workspace_assignee_gantt_end_idx
    ON "JiraIssue" ("workspaceId", "assigneeId", "ganttEndOn")
    WHERE "assigneeId" IS NOT NULL AND "ganttEndOn" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS jira_issue_workspace_assignee_due_idx
    ON "JiraIssue" ("workspaceId", "assigneeId", "dueOn")
    WHERE "assigneeId" IS NOT NULL AND "dueOn" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS gitlab_mr_workspace_author_created_idx
    ON "GitlabMR" ("workspaceId", "authorId", "mrCreatedAtTs")
    WHERE "authorId" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS gitlab_mr_workspace_author_merged_idx
    ON "GitlabMR" ("workspaceId", "authorId", "mrMergedAtTs")
    WHERE "authorId" IS NOT NULL AND "mrMergedAtTs" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS gitlab_note_workspace_author_created_idx
    ON "GitlabNote" ("workspaceId", "authorId", "noteCreatedAtTs")
    WHERE "authorId" IS NOT NULL`,
];

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('[TeamScope] 성능 최적화 인덱스를 적용합니다...');
    for (const statement of statements) {
      await client.query(statement);
    }
    await client.query('ANALYZE');
    console.log(`[TeamScope] 성능 최적화 인덱스 ${statements.length}건 적용 완료`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[TeamScope] 성능 최적화 인덱스 적용 실패:', error);
  process.exit(1);
});
