'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchBranding, type AppSettings } from '@/lib/supabase';

export default function Page() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Carga branding y aplica colores a CSS variables
  useEffect(() => {
    (async () => {
      const { settings, logoUrl } = await fetchBranding();
      setSettings(settings);
      setLogoUrl(logoUrl);

      const root = document.documentElement.style;
      if (settings?.brand_accent) root.setProperty('--brand-accent', settings.brand_accent);
      if (settings?.brand_navy) root.setProperty('--brand-navy', settings.brand_navy);
      if (settings?.danger) root.setProperty('--brand-danger', settings.danger);
    })();
  }, []);

  return (
    <main className="min-h-screen p-6 flex items-center justify-center">
      <div className="card p-8 space-y-6 text-center max-w-xl w-full">
        {/* Logo o título */}
        <div className="flex items-center justify-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-10 object-contain" />
          ) : null}
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--brand-navy)' }}>
            PTA-APP
          </h1>
        </div>

        <p className="text-gray-600">
          Elige tu perfil para continuar.
        </p>

        {/* Botones de rol */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Link href="/operadores" className="btn-brand">
            Soy Operador
          </Link>

          {/* Si tu módulo de managers/planners está en otra ruta, cambia el href */}
          <Link href="/admin?role=manager" className="btn-brand">
            Soy Driver Manager / Planner
          </Link>

          {/* Ruta de administración del sistema (ajústala si usas otra) */}
          <Link href="/admin?role=sysadmin" className="btn-brand">
            Administrador del sistema
          </Link>
        </div>

        {/* Nota de marca visible solo si no hay colores en settings */}
        {!settings?.brand_accent && (
          <p className="text-xs text-gray-500">
            *Usando colores por defecto. Sube tu paleta en <code>app_settings</code> o <code>v_app_settings</code>.
          </p>
        )}
      </div>
    </main>
  );
}
