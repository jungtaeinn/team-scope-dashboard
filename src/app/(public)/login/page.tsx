import { redirect } from 'next/navigation';
import { LoginPageClient } from '@/components/auth/LoginPageClient';
import { getServerWorkspaceContext } from '@/lib/auth/session';

interface LoginPageProps {
  searchParams?: Promise<{ redirectTo?: string; email?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const context = await getServerWorkspaceContext();
  if (context) {
    redirect('/');
  }

  const resolvedSearchParams = (await searchParams) ?? {};

  return <LoginPageClient redirectTo={resolvedSearchParams.redirectTo ?? '/'} initialEmail={resolvedSearchParams.email ?? ''} />;
}
