import { Sidebar } from '@/components/_ui';
import { AppHeader } from '@/components/_ui/app-header';
import { ChangelogAutoOpen } from '@/components/changelog/ChangelogAutoOpen';
import { AutoSyncOnLogin } from '@/components/sync';
import { canManageData, getVisibleNavItems } from '@/lib/auth/roles';
import { requireServerWorkspaceContext } from '@/lib/auth/session';
import { APP_VERSION } from '@/lib/app-info';

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await requireServerWorkspaceContext();
  const navigationItems = getVisibleNavItems(context.membership.role);

  return (
    <>
      <Sidebar navigationItems={navigationItems} version={APP_VERSION} />
      <main className="min-h-screen pl-0 lg:pl-[var(--sidebar-width)]">
        <AppHeader
          userName={context.user.name}
          role={context.membership.role}
          showSyncButton={canManageData(context.membership.role)}
        />
        <AutoSyncOnLogin
          enabled={canManageData(context.membership.role)}
          workspaceId={context.workspace.id}
          sessionId={context.session.id}
        />
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
      <ChangelogAutoOpen version={APP_VERSION} />
    </>
  );
}
