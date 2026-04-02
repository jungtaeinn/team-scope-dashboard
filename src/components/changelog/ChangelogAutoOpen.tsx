'use client';

import { useEffect, useState } from 'react';
import { ChangelogDialog } from '@/components/changelog/ChangelogDialog';

interface ChangelogAutoOpenProps {
  version: string;
}

const STORAGE_KEY = 'team-scope:last-viewed-version';

export function ChangelogAutoOpen({ version }: ChangelogAutoOpenProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(window.localStorage.getItem(STORAGE_KEY) !== version);
  }, [version]);

  useEffect(() => {
    if (open) {
      window.localStorage.setItem(STORAGE_KEY, version);
    }
  }, [open, version]);

  return <ChangelogDialog open={open} onClose={() => setOpen(false)} />;
}
