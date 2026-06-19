import { redirect } from 'next/navigation';
import { getServerWorkspaceContext } from '@/lib/auth/session';
import { ForcePasswordChange } from '@/components/auth/ForcePasswordChange';

export default async function ChangePasswordPage() {
  const context = await getServerWorkspaceContext();

  if (!context) {
    redirect('/login');
  }

  if (!context.user.mustChangePassword) {
    redirect('/');
  }

  return (
    <ForcePasswordChange
      userName={context.user.name}
      email={context.user.email}
    />
  );
}
