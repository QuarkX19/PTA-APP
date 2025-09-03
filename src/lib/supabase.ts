// /lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const E2E_BYPASS = process.env.NEXT_PUBLIC_E2E_BYPASS === 'true';

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}
