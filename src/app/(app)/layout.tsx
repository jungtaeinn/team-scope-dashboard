import { Sidebar } from '@/components/_ui';
import { AppHeader } from '@/components/_ui/app-header';
import { FloatingPromptBar } from '@/components/_ui/floating-prompt';
import { ChangelogAutoOpen } from '@/components/changelog/ChangelogAutoOpen';
import { AutoSyncOnLogin } from '@/components/sync';
import { canManageData, getVisibleNavItems } from '@/lib/auth/roles';
import { requireServerWorkspaceContext } from '@/lib/auth/session';
import { APP_VERSION } from '@/lib/app-info';
import { prisma } from '@/lib/db';

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await requireServerWorkspaceContext();
  const navigationItems = getVisibleNavItems(context.membership.role);
  const syncableProjectCount = canManageData(context.membership.role)
    ? await prisma.project.count({
        where: {
          workspaceId: context.workspace.id,
          isActive: true,
          token: { not: 'PENDING_TOKEN' },
        },
      })
    : 0;

  return (
    <>
      <Sidebar navigationItems={navigationItems} version={APP_VERSION} role={context.membership.role} />
      <main className="min-h-screen pl-0 lg:pl-[var(--sidebar-width)]">
        <AppHeader
          userName={context.user.name}
          role={context.membership.role}
          showSyncButton={canManageData(context.membership.role)}
        />
        <AutoSyncOnLogin
          enabled={canManageData(context.membership.role) && syncableProjectCount > 0}
          workspaceId={context.workspace.id}
          sessionId={context.session.id}
        />
        <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">{children}</div>
      </main>
      <FloatingPromptBar />
      <ChangelogAutoOpen version={APP_VERSION} />
    </>
  );
}
