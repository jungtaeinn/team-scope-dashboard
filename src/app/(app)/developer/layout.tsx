import { requireServerRole } from '@/lib/auth/session';

export default async function DeveloperLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireServerRole(['owner', 'maintainer', 'developer']);
  return children;
}
