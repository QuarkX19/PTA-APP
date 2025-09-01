// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
export const E2E_BYPASS = process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === '1';
export type AppSettings = {
  brand_navy: string | null;
  brand_accent: string | null;
  danger?: string | null;
  logo_path: string | null;
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

/**
 * Lee colores y logo de v_app_settings (si no existe, cae a app_settings id=1).
 * Devuelve también la URL pública del logo.
 */
export async function fetchBranding(): Promise<{
  settings: AppSettings | null;
  logoUrl: string | null;
  error?: string;
}> {
  // 1) Intento leer la vista
  const v = await supabase
    .from('v_app_settings')
    .select('brand_navy, brand_accent, danger, logo_path')
    .maybeSingle();

  if (!v.error && v.data) {
    const logoUrl = await resolvePublicUrl(v.data.logo_path);
    return { settings: v.data, logoUrl };
  }

  // 2) Si la vista no existe, intento con app_settings (id=1)
  const r = await supabase
    .from('app_settings')
    .select('brand_navy, brand_accent, danger, logo_path')
    .eq('id', 1)
    .maybeSingle();

  if (r.error) {
    return { settings: null, logoUrl: null, error: r.error.message };
  }

  const logoUrl = await resolvePublicUrl(r.data?.logo_path ?? null);
  return { settings: r.data, logoUrl };
}

async function resolvePublicUrl(storagePath: string | null): Promise<string | null> {
  if (!storagePath) return null;
  const [bucket, ...rest] = storagePath.split('/');
  if (!bucket || rest.length === 0) return null;
  const path = rest.join('/');
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? null;
}
