import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';

/**
 * Prisma 클라이언트 싱글톤 인스턴스입니다.
 * 개발 환경에서 HMR로 인한 다중 인스턴스 생성을 방지합니다.
 * Prisma 7부터 SQLite 연결에는 adapter를 사용합니다.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function resolveSqlitePath(databaseUrl: string) {
  if (!databaseUrl.startsWith('file:')) {
    return databaseUrl;
  }

  const filePath = databaseUrl.slice('file:'.length);
  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
  const adapter = new PrismaBetterSqlite3({ url: resolveSqlitePath(databaseUrl) });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
