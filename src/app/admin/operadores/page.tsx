'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Op = {
  id: string;
  email: string;
  full_name: string | null;
  current_truck: string | null;
  created_at: string;
};

export default function OperadoresPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [ops, setOps] = useState<Op[]>([]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const email = s?.session?.user?.email ?? '';
      if (!email) return setAllowed(false);
      const { data: adminRow } = await supabase.from('admins').select('email').eq('email', email).maybeSingle();
      setAllowed(!!adminRow);
      if (!adminRow) return;

      const { data, error } = await supabase
        .from('operators')
        .select('id,email,full_name,current_truck,created_at')
        .order('full_name', { ascending: true });

      if (error) console.error(error.message);
      setOps(data ?? []);
    })();
  }, []);

  if (allowed === null) return <main className="p-6">Cargando…</main>;
  if (!allowed) return <main className="p-6">No autorizado</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Operadores</h1>
      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <Th>Nombre</Th><Th>Correo</Th><Th>Camión actual</Th><Th>Creado</Th><Th>ID</Th>
            </tr>
          </thead>
          <tbody>
            {ops.map(o => (
              <tr key={o.id} className="border-t">
                <Td className="font-medium">{o.full_name || '—'}</Td>
                <Td>{o.email}</Td>
                <Td>{o.current_truck || '—'}</Td>
                <Td>{new Date(o.created_at).toLocaleString()}</Td>
                <Td className="text-xs text-slate-500">{o.id}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-2">{children}</th>; }
function Td({ children, className='' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
