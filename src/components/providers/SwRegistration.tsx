'use client';

import { useEffect } from 'react';
import { registerSW } from '@/lib/sw-register';

export function SwRegistration() {
  useEffect(() => {
    registerSW();
  }, []);

  return null;
}
