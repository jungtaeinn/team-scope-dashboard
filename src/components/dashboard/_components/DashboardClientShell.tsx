'use client';

import dynamic from 'next/dynamic';

function CardSkeleton() {
  return <div className="h-48 animate-pulse rounded-xl bg-[var(--muted)]" />;
}

const DashboardClient = dynamic(
  () => import('@/components/dashboard/_components/DashboardClient').then((module) => module.DashboardClient),
  {
    ssr: false,
    loading: () => <CardSkeleton />,
  },
);

export function DashboardClientShell() {
  return <DashboardClient />;
}
