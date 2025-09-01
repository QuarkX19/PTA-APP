// src/components/BrandLoader.tsx
'use client';

import { useEffect } from 'react';
import { fetchBranding } from '@/lib/supabase';

export default function BrandLoader() {
  useEffect(() => {
    (async () => {
      const { settings } = await fetchBranding();

      const root = document.documentElement;
      if (settings?.brand_navy)   root.style.setProperty('--brand-navy', settings.brand_navy);
      if (settings?.brand_accent) root.style.setProperty('--brand-accent', settings.brand_accent);
      if (settings?.danger)       root.style.setProperty('--danger', settings.danger!);
    })();
  }, []);

  return null;
}
