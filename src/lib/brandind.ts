// src/lib/branding.ts
import { supabase } from '@/lib/supabase';

export type AppSettings = {
  brand_navy: string | null;
  brand_accent: string | null;
  danger?: string | null;
  logo_path: string | null;
};

export async function fetchBranding(): Promise<{
  settings: AppSettings | null;
  logoUrl: string | null;
  error?: string;
}> {
  // Intentamos leer la vista; si no existe, vamos directo a la tabla
  let settings: AppSettings | null = null;
  let error: string | undefined;

  const { data, error: e1 } = await supabase
    .from('v_app_settings')
    .select('brand_navy, brand_accent, logo_path')
    .maybeSingle();

  if (e1?.code === '42P01') {
    // La vista no existe: leemos la tabla app_settings, fila id=1
    const { data: d2, error: e2 } = await supabase
      .from('app_settings')
      .select('brand_navy, brand_accent, logo_path')
      .eq('id', 1)
      .maybeSingle();

    settings = d2 as any;
    error = e2?.message;
  } else {
    settings = data as any;
    error = e1?.message;
  }

  // Resolvemos URL pública del logo si hay ruta
  let logoUrl: string | null = null;
  if (settings?.logo_path) {
    const [bucket, ...rest] = settings.logo_path.split('/');
    const path = rest.join('/');
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    logoUrl = pub?.publicUrl ?? null;
  }

  return { settings, logoUrl, error };
}
