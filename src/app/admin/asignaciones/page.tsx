'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type Counts = { reports: number; operators: number };

export default function AdminHome() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string>('');
  const [counts, setCounts] = useState<Counts>({ reports: 0, operators: 0 });

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const email = s?.session?.user?.email ?? '';
      setSessionEmail(email);

      if (!email) return setAllowed(false);

      // ¿está en tabla admins?
      const { data: adminRow, error } = await supabase
        .from('admins')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (error) {
        console.error(error);
        setAllowed(false);
        return;
      }
      setAllowed(!!adminRow);

      // contadores
      const { count: c1 } = await supabase
        .from('status_reports')
        .select('id', { count: 'exact', head: true });
      const { count: c2 } = await supabase
        .from('operators')
        .select('id', { count: 'exact', head: true });

      setCounts({ reports: c1 ?? 0, operators: c2 ?? 0 });
    })();
  }, []);

  if (allowed === null) return <main className="p-6">Cargando…</main>;
  if (!allowed) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold mb-2">No autorizado</h1>
        <p className="text-sm">Sesión: {sessionEmail || 'sin sesión'}</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Centro de administración</h1>
          <p className="text-sm text-slate-600">Sesión: {sessionEmail}</p>
        </div>
        <Link href="/admin/asignaciones" className="btn-brand">Ir a Asignaciones</Link>
      </header>

      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card
          title="Reportes de estatus"
          subtitle={`${counts.reports.toLocaleString()} registros`}
          href="/admin/reportes"
        />
        <Card
          title="Operadores"
          subtitle={`${counts.operators.toLocaleString()} operadores`}
          href="/admin/operadores"
        />
        <Card
          title="Evidencias (Storage)"
          subtitle="Ver/descargar archivos"
          href="/admin/evidencias"
        />
      </section>
    </main>
  );
}

function Card({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <Link href={href} className="card p-4 hover:shadow">
      <div className="font-semibold">{title}</div>
      <div className="text-slate-600 text-sm">{subtitle}</div>
    </Link>
  );
}
