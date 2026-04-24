import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';

export type AiProvider = 'openai' | 'gemini';

export interface AiSettingRecord {
  provider: AiProvider;
  apiKey: string | null;
  model: string | null;
  isEnabled: boolean;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  updatedAt: Date;
}

export interface AiSettingView {
  provider: AiProvider;
  label: string;
  isConfigured: boolean;
  isEnabled: boolean;
  maskedKey: string | null;
  model: string | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
}

export const AI_PROVIDERS: Array<{ provider: AiProvider; label: string; defaultModel: string }> = [
  { provider: 'openai', label: 'ChatGPT', defaultModel: 'gpt-4o-mini' },
  { provider: 'gemini', label: 'Gemini', defaultModel: 'gemini-2.5-flash-lite' },
];

type AiSettingRow = {
  provider: AiProvider;
  encrypted_api_key: string | null;
  model: string | null;
  is_enabled: boolean;
  last_tested_at: Date | null;
  last_test_status: string | null;
  last_test_message: string | null;
  updated_at: Date;
};

type LegacyAiSettingRow = {
  id: string;
  api_key: string | null;
};

type AiSettingsColumnRow = {
  column_name: string;
};

const ENCRYPTION_PREFIX = 'v1';
const REQUIRED_AI_SETTINGS_COLUMNS = [
  'id',
  'workspace_id',
  'provider',
  'encrypted_api_key',
  'model',
  'is_enabled',
  'last_tested_at',
  'last_test_status',
  'last_test_message',
  'created_at',
  'updated_at',
] as const;

function isEncryptedApiKey(value: string | null | undefined) {
  return Boolean(value?.startsWith(`${ENCRYPTION_PREFIX}:`));
}

function getEncryptionKey() {
  const secret =
    process.env.AI_SETTINGS_ENCRYPTION_KEY?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    'dev-only-better-auth-secret-change-me-before-production';

  return createHash('sha256').update(secret).digest();
}

function encryptApiKey(apiKey: string | null) {
  if (!apiKey) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [ENCRYPTION_PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(':');
}

function decryptApiKey(value: string | null) {
  if (!value) return null;
  if (!isEncryptedApiKey(value)) return null;

  const [version, ivValue, tagValue, encryptedValue] = value.split(':');
  if (version !== ENCRYPTION_PREFIX || !ivValue || !tagValue || !encryptedValue) {
    return null;
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

export async function ensureAiSettingsTable() {
  const tableRows = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ai_integration_settings'
  `;

  const columnRows = await prisma.$queryRaw<AiSettingsColumnRow[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'ai_integration_settings'
  `;

  const availableColumns = new Set(columnRows.map((row) => row.column_name));
  const hasCurrentShape =
    tableRows.length > 0 &&
    REQUIRED_AI_SETTINGS_COLUMNS.every((columnName) => availableColumns.has(columnName)) &&
    !availableColumns.has('api_key');

  if (!hasCurrentShape) {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ai_integration_settings" (
        "id" TEXT PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
        "workspace_id" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "encrypted_api_key" TEXT,
        "model" TEXT,
        "is_enabled" BOOLEAN NOT NULL DEFAULT false,
        "last_tested_at" TIMESTAMPTZ,
        "last_test_status" TEXT,
        "last_test_message" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "ai_integration_settings_workspace_provider_key" UNIQUE ("workspace_id", "provider")
      )
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ai_integration_settings"
        ADD COLUMN IF NOT EXISTS "workspace_id" TEXT NOT NULL DEFAULT 'default-workspace',
        ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'openai',
        ADD COLUMN IF NOT EXISTS "encrypted_api_key" TEXT,
        ADD COLUMN IF NOT EXISTS "model" TEXT,
        ADD COLUMN IF NOT EXISTS "is_enabled" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "last_tested_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "last_test_status" TEXT,
        ADD COLUMN IF NOT EXISTS "last_test_message" TEXT,
        ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "ai_integration_settings"
        ALTER COLUMN "id" SET DEFAULT md5(random()::text || clock_timestamp()::text)
    `);
  }

  if (!hasCurrentShape) {
    await prisma.$executeRawUnsafe(`
      UPDATE "ai_integration_settings"
      SET
        "workspace_id" = COALESCE(NULLIF("workspace_id", ''), 'default-workspace'),
        "provider" = COALESCE(NULLIF("provider", ''), 'openai'),
        "updated_at" = COALESCE("updated_at", now()),
        "created_at" = COALESCE("created_at", now())
    `);

    await prisma.$executeRawUnsafe(`
      DELETE FROM "ai_integration_settings" stale
      USING (
        SELECT id
        FROM (
          SELECT
            id,
            row_number() OVER (
              PARTITION BY "workspace_id", "provider"
              ORDER BY "updated_at" DESC NULLS LAST, "created_at" DESC NULLS LAST, id DESC
            ) AS row_number
          FROM "ai_integration_settings"
        ) ranked
        WHERE ranked.row_number > 1
      ) duplicates
      WHERE stale.id = duplicates.id
    `);

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ai_integration_settings_workspace_provider_key"
      ON "ai_integration_settings" ("workspace_id", "provider")
    `);

    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "ai_integration_settings_workspace_enabled_idx" ON "ai_integration_settings" ("workspace_id", "is_enabled")',
    );
  }

  const plaintextEncryptedRows = await prisma.$queryRaw<Array<{ id: string; encrypted_api_key: string }>>`
    SELECT id, encrypted_api_key
    FROM "ai_integration_settings"
    WHERE encrypted_api_key IS NOT NULL AND encrypted_api_key NOT LIKE ${`${ENCRYPTION_PREFIX}:%`}
  `;

  for (const row of plaintextEncryptedRows) {
    await prisma.$executeRaw`
      UPDATE "ai_integration_settings"
      SET encrypted_api_key = ${encryptApiKey(row.encrypted_api_key)}, updated_at = now()
      WHERE id = ${row.id}
    `;
  }

  if (availableColumns.has('api_key')) {
    const legacyRows = await prisma.$queryRaw<LegacyAiSettingRow[]>`
      SELECT id, api_key
      FROM "ai_integration_settings"
      WHERE api_key IS NOT NULL
    `;

    for (const row of legacyRows) {
      await prisma.$executeRaw`
        UPDATE "ai_integration_settings"
        SET encrypted_api_key = ${encryptApiKey(row.api_key)}, updated_at = now()
        WHERE id = ${row.id}
      `;
    }

    await prisma.$executeRawUnsafe('ALTER TABLE "ai_integration_settings" DROP COLUMN IF EXISTS "api_key"');
  }
}

export function getProviderLabel(provider: AiProvider) {
  return AI_PROVIDERS.find((item) => item.provider === provider)?.label ?? provider;
}

export function getDefaultModel(provider: AiProvider) {
  return AI_PROVIDERS.find((item) => item.provider === provider)?.defaultModel ?? null;
}

export function isAiProvider(value: unknown): value is AiProvider {
  return value === 'openai' || value === 'gemini';
}

export function maskApiKey(apiKey: string | null | undefined) {
  if (!apiKey) return null;
  if (apiKey.length <= 8) return '••••';

  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}

export function toAiSettingView(record: AiSettingRecord): AiSettingView {
  return {
    provider: record.provider,
    label: getProviderLabel(record.provider),
    isConfigured: Boolean(record.apiKey),
    isEnabled: record.isEnabled,
    maskedKey: maskApiKey(record.apiKey),
    model: record.model,
    lastTestedAt: record.lastTestedAt?.toISOString() ?? null,
    lastTestStatus: record.lastTestStatus,
    lastTestMessage: record.lastTestMessage,
  };
}

function mapRow(row: AiSettingRow): AiSettingRecord {
  return {
    provider: row.provider,
    apiKey: decryptApiKey(row.encrypted_api_key),
    model: row.model,
    isEnabled: row.is_enabled,
    lastTestedAt: row.last_tested_at,
    lastTestStatus: row.last_test_status,
    lastTestMessage: row.last_test_message,
    updatedAt: row.updated_at,
  };
}

export async function listAiSettings(workspaceId: string) {
  await ensureAiSettingsTable();

  const rows = await prisma.$queryRaw<AiSettingRow[]>`
    SELECT provider, encrypted_api_key, model, is_enabled, last_tested_at, last_test_status, last_test_message, updated_at
    FROM "ai_integration_settings"
    WHERE "workspace_id" = ${workspaceId}
  `;

  const byProvider = new Map(rows.map((row) => [row.provider, mapRow(row)]));

  return AI_PROVIDERS.map(({ provider, defaultModel }) => {
    const existing = byProvider.get(provider);
    return (
      existing ?? {
        provider,
        apiKey: null,
        model: defaultModel,
        isEnabled: false,
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestMessage: null,
        updatedAt: new Date(),
      }
    );
  });
}

export async function getAiSetting(workspaceId: string, provider: AiProvider) {
  await ensureAiSettingsTable();

  const rows = await prisma.$queryRaw<AiSettingRow[]>`
    SELECT provider, encrypted_api_key, model, is_enabled, last_tested_at, last_test_status, last_test_message, updated_at
    FROM "ai_integration_settings"
    WHERE "workspace_id" = ${workspaceId} AND "provider" = ${provider}
    LIMIT 1
  `;

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function upsertAiSetting(params: {
  workspaceId: string;
  provider: AiProvider;
  apiKey?: string | null;
  model?: string | null;
  isEnabled: boolean;
}) {
  await ensureAiSettingsTable();

  const existing = await getAiSetting(params.workspaceId, params.provider);
  const nextApiKey = params.apiKey?.trim() || existing?.apiKey || null;
  const encryptedApiKey = encryptApiKey(nextApiKey);
  const nextModel = params.model?.trim() || existing?.model || getDefaultModel(params.provider);
  const nextEnabled = Boolean(params.isEnabled && nextApiKey);

  const rows = await prisma.$queryRaw<AiSettingRow[]>`
    INSERT INTO "ai_integration_settings" ("id", "workspace_id", "provider", "encrypted_api_key", "model", "is_enabled", "updated_at")
    VALUES (${randomUUID()}, ${params.workspaceId}, ${params.provider}, ${encryptedApiKey}, ${nextModel}, ${nextEnabled}, now())
    ON CONFLICT ("workspace_id", "provider")
    DO UPDATE SET
      "encrypted_api_key" = EXCLUDED."encrypted_api_key",
      "model" = EXCLUDED."model",
      "is_enabled" = EXCLUDED."is_enabled",
      "updated_at" = now()
    RETURNING provider, encrypted_api_key, model, is_enabled, last_tested_at, last_test_status, last_test_message, updated_at
  `;

  return mapRow(rows[0]);
}

export async function deleteAiSetting(workspaceId: string, provider: AiProvider) {
  await ensureAiSettingsTable();

  await prisma.$executeRaw`
    DELETE FROM "ai_integration_settings"
    WHERE "workspace_id" = ${workspaceId} AND "provider" = ${provider}
  `;
}

export async function updateAiTestResult(params: {
  workspaceId: string;
  provider: AiProvider;
  status: 'success' | 'error';
  message: string;
}) {
  await ensureAiSettingsTable();

  const rows = await prisma.$queryRaw<AiSettingRow[]>`
    INSERT INTO "ai_integration_settings" (
      "id", "workspace_id", "provider", "model", "is_enabled", "last_tested_at", "last_test_status", "last_test_message", "updated_at"
    )
    VALUES (
      ${randomUUID()}, ${params.workspaceId}, ${params.provider}, ${getDefaultModel(params.provider)}, false, now(), ${params.status}, ${params.message}, now()
    )
    ON CONFLICT ("workspace_id", "provider")
    DO UPDATE SET
      "last_tested_at" = now(),
      "last_test_status" = EXCLUDED."last_test_status",
      "last_test_message" = EXCLUDED."last_test_message",
      "updated_at" = now()
    RETURNING provider, encrypted_api_key, model, is_enabled, last_tested_at, last_test_status, last_test_message, updated_at
  `;

  return mapRow(rows[0]);
}
