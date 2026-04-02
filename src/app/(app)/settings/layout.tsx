import { requireServerRole } from '@/lib/auth/session';

export default async function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireServerRole(['owner', 'maintainer']);
  return children;
}
