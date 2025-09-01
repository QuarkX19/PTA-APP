'use client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabase, E2E_BYPASS } from '@/lib/supabase';

type AllowedRole = 'admin' | 'manager' | 'planner';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      // BYPASS para e2e/tests sin login
      if (E2E_BYPASS) {
        setEmail('e2e@pta-app.local');
        setAllowed(true);
        setLoading(false);
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        // En build/prerender podría ser null: evita crashear
        setLoading(false);
        setAllowed(false);
        return;
      }

      // 1) ¿Hay sesión?
      const { data } = await supabase.auth.getSession();
      const sessionEmail = data?.session?.user?.email ?? null;
      setEmail(sessionEmail);

      if (!sessionEmail) {
        router.replace('/login?redirect=/admin');
        return;
      }

      // 2) ¿Tiene rol permitido?
      const canSee = await hasAllowedRole(sessionEmail);
      setAllowed(canSee);
      setLoading(false);
    })();
  }, [router]);

  if (loading || allowed === null) {
    return (
      <main className="min-h-screen p-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--brand-navy)' }}>
          Panel de Administración
        </h1>
        <p className="text-slate-600 mt-2">Verificando permisos…</p>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen p-6 space-y-4">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--brand-navy)' }}>
          No autorizado
        </h1>
        <p className="text-sm text-slate-600">
          Sesión: {email || '—'}. Se requiere rol <code>admin</code>, <code>manager</code> o <code>planner</code>.
        </p>
        <Link href="/" className="btn-brand inline-block">Volver al inicio</Link>
      </main>
    );
  }

  // ======= Dashboard de admin =======
  return (
    <main className="min-h-screen p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--brand-navy)' }}>
            Panel de Administración
          </h1>
          <p className="text-sm text-slate-600">Sesión: {email}</p>
        </div>
        <nav className="flex gap-2">
          <Link href="/" className="btn-brand">Inicio</Link>
          <button
            className="btn-brand"
            onClick={async () => {
              const supabase = getSupabase();
              if (supabase) {
                await supabase.auth.signOut();
              }
              router.replace('/login?redirect=/admin');
            }}
          >
            Cerrar sesión
          </button>
        </nav>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/asignaciones" className="card p-6 hover:shadow-lg transition">
          <h2 className="font-semibold text-lg">Asignaciones</h2>
          <p className="text-sm text-slate-600">Gestiona cargas y operadores.</p>
        </Link>

        <Link href="/admin/evidencias" className="card p-6 hover:shadow-lg transition">
          <h2 className="font-semibold text-lg">Evidencias</h2>
          <p className="text-sm text-slate-600">Revisa y valida archivos subidos.</p>
        </Link>

        <Link href="/admin/reportes" className="card p-6 hover:shadow-lg transition">
          <h2 className="font-semibold text-lg">Reportes</h2>
          <p className="text-sm text-slate-600">Consulta informes y exporta datos.</p>
        </Link>
      </section>
    </main>
  );
}

/* ===== Helpers ===== */
async function hasAllowedRole(email: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  // Revisa user_roles primero
  const { data: ur, error: urErr } = await supabase
    .from('user_roles')
    .select('role')
    .eq('email', email)
    .in('role', ['admin', 'manager', 'planner'] as AllowedRole[])
    .maybeSingle();

  if (!urErr && ur) return true;

  // Fallbacks si no tienes user_roles
  const a = await supabase.from('admins').select('email').eq('email', email).maybeSingle();
  if (!a.error && a.data) return true;

  const m = await supabase.from('managers').select('email').eq('email', email).maybeSingle();
  if (!m.error && m.data) return true;

  const p = await supabase.from('planners').select('email').eq('email', email).maybeSingle();
  if (!p.error && p.data) return true;

  return false;
}
