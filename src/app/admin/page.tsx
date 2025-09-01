'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminIndex() {
  const params = useSearchParams();
  const devOverride = useMemo(
    () => process.env.NODE_ENV !== 'production' && params.get('role') === 'sysadmin',
    [params]
  );

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // 1) Sesión
      const { data: s } = await supabase.auth.getSession();
      const email = s?.session?.user?.email ?? null;
      setSessionEmail(email);

      // 2) DEV OVERRIDE: /admin?role=sysadmin (solo local)
      if (devOverride) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      // 3) Autorización normal
      if (!email) {
        setAllowed(false);
        setLoading(false);
        return;
      }

      // user_roles (admin/manager/planner) o fallback a tablas separadas
      const r = await supabase
        .from('user_roles')
        .select('role')
        .eq('email', email)
        .in('role', ['admin', 'manager', 'planner'])
        .maybeSingle();

      if (!r.error && r.data) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      // Fallbacks si no existe user_roles
      const a = await supabase.from('admins').select('email').eq('email', email).maybeSingle();
      if (!a.error && a.data) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      const m = await supabase.from('managers').select('email').eq('email', email).maybeSingle();
      if (!m.error && m.data) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      const p = await supabase.from('planners').select('email').eq('email', email).maybeSingle();
      if (!p.error && p.data) {
        setAllowed(true);
        setLoading(false);
        return;
      }

      setAllowed(false);
      setLoading(false);
    })();
  }, [devOverride]);

  if (loading) {
    return <main className="p-6">Cargando…</main>;
  }

  // Sin sesión -> mostramos tarjeta de login para crearla
  if (!sessionEmail && !devOverride) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md card p-6 space-y-4">
          <h1 className="text-xl font-semibold">PTA-APP</h1>
          <p className="text-sm text-slate-600">
            Inicia sesión con tu correo corporativo para acceder al Centro de administración.
          </p>
          <LoginInline redirectPath="/admin" />
          <p className="text-xs text-slate-500">
            Asegúrate de que la URL de este sitio esté en los <i>Redirect URLs</i> de Supabase Auth.
          </p>
        </div>
      </main>
    );
  }

  // Con sesión, pero sin permisos
  if (!allowed && !devOverride) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold mb-2">No autorizado</h1>
        <p className="text-sm mb-4">Sesión: {sessionEmail || 'sin sesión'}</p>
        <p className="text-sm text-slate-600">
          Tu usuario no tiene rol de <b>admin/manager/planner</b>. Pide a un administrador que te agregue a{' '}
          <code>user_roles</code> o a la tabla <code>admins</code>.
        </p>
        <div className="mt-4">
          <button
            className="btn-brand"
            onClick={() => supabase.auth.signOut().then(() => location.reload())}
          >
            Cerrar sesión
          </button>
        </div>
      </main>
    );
  }

  // Autorizado
  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Centro de administración</h1>
          <p className="text-sm text-slate-600">Sesión: {sessionEmail || 'dev@local'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-brand" onClick={() => supabase.auth.signOut().then(() => location.reload())}>
            Salir
          </button>
        </div>
      </header>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card title="Asignaciones" subtitle="Crear y marcar asignaciones" href="/admin/asignaciones" />
        <Card title="Operadores" subtitle="Listado de operadores" href="/admin/operadores" />
        <Card title="Reportes" subtitle="Reportes + exportaciones" href="/admin/reportes" />
        <Card title="Evidencias" subtitle="Archivos subidos (Signed URLs)" href="/admin/evidencias" />
      </section>
    </main>
  );
}

/* ---------- UI helpers ---------- */
function Card({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <Link href={href} className="card p-4 hover:shadow">
      <div className="font-semibold">{title}</div>
      <div className="text-slate-600 text-sm">{subtitle}</div>
    </Link>
  );
}

function LoginInline({ redirectPath = '/' }: { redirectPath?: string }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sendMagicLink = async () => {
    if (!email) return setMsg('Escribe tu correo.');
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}${redirectPath}` },
      });
      if (error) throw error;
      setMsg('Te enviamos un Magic Link. Revisa tu correo.');
    } catch (e: any) {
      setMsg(e?.message || 'Error al enviar Magic Link.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <input
        className="input-base w-full"
        placeholder="tu@correo.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button className="btn-brand w-full" onClick={sendMagicLink} disabled={busy}>
        Enviar Magic Link
      </button>
      {msg && <div className="text-sm text-slate-600">{msg}</div>}
    </div>
  );
}
