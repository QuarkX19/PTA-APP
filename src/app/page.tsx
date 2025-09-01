'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchBranding, type AppSettings } from '@/lib/supabase';

export default function Page() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga branding y aplica colores a CSS variables
  useEffect(() => {
    (async () => {
      try {
        const { settings, logoUrl } = await fetchBranding();
        setSettings(settings);
        setLogoUrl(logoUrl);

        const root = document.documentElement.style;
        if (settings?.brand_accent) root.setProperty('--brand-accent', settings.brand_accent);
        if (settings?.brand_navy) root.setProperty('--brand-navy', settings.brand_navy);
        if (settings?.danger) root.setProperty('--brand-danger', settings.danger);
      } catch (e) {
        console.error('Error cargando branding:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-slate-600">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 flex items-center justify-center">
      <div className="card p-8 space-y-6 text-center max-w-xl w-full">
        {/* Logo o título */}
        <div className="flex items-center justify-center gap-3">
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-10 object-contain" />}
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--brand-navy)' }}>
            PTA-APP
          </h1>
        </div>

        <p className="text-gray-600">Elige tu perfil para continuar.</p>

        {/* Botones de rol */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link href="/operadores" className="btn-brand">Soy Operador</Link>
          <Link href="/admin?role=manager" className="btn-brand">Soy Driver Manager / Planner</Link>
          <Link href="/admin?role=sysadmin" className="btn-brand">Administrador del sistema</Link>
        </div>

        {!settings?.brand_accent && (
          <p className="text-xs text-gray-500 mt-4">
            *Usando colores por defecto. Configura tu paleta en <code>app_settings</code>.
          </p>
        )}
      </div>
    </main>
  );
}
