import { requireServerRole } from '@/lib/auth/session';
import { FlowLabClient } from '@/components/flow-lab/FlowLabClient';

export default async function FlowLabPage() {
  await requireServerRole(['owner']);
  return (
    <div className="w-full xl:relative xl:left-1/2 xl:w-[calc(100vw-var(--sidebar-width)-2rem)] xl:max-w-none xl:-translate-x-1/2 2xl:w-[calc(100vw-var(--sidebar-width)-3rem)]">
      <FlowLabClient />
    </div>
  );
}
