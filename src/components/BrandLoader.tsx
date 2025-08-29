'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function BrandLoader() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Lee settings (id=1)
      const { data, error } = await supabase
        .from('app_settings')
        .select('brand_navy, brand_accent, danger, logo_path')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.error('Brand settings error:', error.message);
        return;
      }

      // Aplica colores al tema (Tailwind v4 con @theme)
      if (data?.brand_navy) {
        document.documentElement.style.setProperty('--color-brand', data.brand_navy);
      }
      if (data?.brand_accent) {
        document.documentElement.style.setProperty('--color-accent', data.brand_accent);
      }
      if (data?.danger) {
        document.documentElement.style.setProperty('--color-danger', data.danger);
      }

      // Resuelve URL pública del logo
      if (data?.logo_path) {
        const [bucket, ...rest] = data.logo_path.split('/');
        const path = rest.join('/');
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        setLogoUrl(pub?.publicUrl ?? null);
      }
    })();
  }, []);

  return (
    <header className="w-full flex items-center gap-4 py-4">
      {/* Cuadro del logo */}
      <div className="h-14 w-14 rounded-md overflow-hidden ring-1 ring-slate-200 flex items-center justify-center bg-brand">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="FLEETS FLOW"
            className="h-10 w-auto select-none"
            draggable={false}
          />
        ) : null}
      </div>

      {/* Títulos */}
      <div className="leading-tight">
        <h1 className="m-0 text-2xl md:text-3xl font-bold tracking-wide text-brand">
          GESTIÓN DE ESTATUS
        </h1>
        <p className="m-0 text-sm md:text-base uppercase tracking-wide text-slate-600">
          ASIGNACIONES A OPERADORES
        </p>
      </div>
    </header>
  );
}
