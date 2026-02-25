'use client';

import { useEffect } from 'react';
import { migrateLocalStorage } from '@/lib/migrate-storage';

export default function StorageMigration() {
  useEffect(() => {
    migrateLocalStorage();
  }, []);
  return null;
}
