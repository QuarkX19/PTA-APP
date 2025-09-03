'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const em = data?.session?.user?.email ?? null;

      if (!em) {
        router.push('/login');
        return;
      }

      setEmail(em);
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-slate-600">Cargando sesión…</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#001F3F]">Panel Administrativo</h1>
        <span className="text-sm text-gray-600">Sesión: {email}</span>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Link href="/admin/reportes" className="bg-[#FFB400] text-black px-4 py-2 rounded-lg text-center font-semibold">
          Reportes
        </Link>
        <Link href="/admin/evidencias" className="bg-[#FFB400] text-black px-4 py-2 rounded-lg text-center font-semibold">
          Evidencias
        </Link>
        <Link href="/admin/asignaciones" className="bg-[#FFB400] text-black px-4 py-2 rounded-lg text-center font-semibold">
          Asignaciones
        </Link>
      </section>
    </main>
  );
}
