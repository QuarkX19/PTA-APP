'use client';

import { useEffect, useState } from 'react';
import { supabase, E2E_BYPASS } from '@/lib/supabase';

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
  const [sessionEmail, setSessionEmail] = useState<string>('');

  useEffect(() => {
    (async () => {
      // BYPASS para e2e (sin login)
      if (E2E_BYPASS) {
        setAllowed(true);
        setSessionEmail('e2e@pta-app.local');
        setOps([
          // puedes dejar vacío [] si prefieres sin mock
          {
            id: 'op-e2e-1',
            email: 'op1@pta-app.local',
            full_name: 'OPERADOR E2E',
            current_truck: 'TX-01',
            created_at: new Date().toISOString(),
          },
        ]);
        return;
      }

      // Flujo real
      const { data: s } = await supabase.auth.getSession();
      const email = s?.session?.user?.email ?? '';
      setSessionEmail(email);
      if (!email) return setAllowed(false);

      const permitted = await canView(email); // admin/manager/planner ven
      setAllowed(permitted);
      if (!permitted) return;

      const { data, error } = await supabase
        .from('operators')
        .select('id,email,full_name,current_truck,created_at')
        .order('full_name', { ascending: true });

      if (error) console.error(error.message);
      setOps(data ?? []);
    })();
  }, []);

  if (allowed === null) return <main className="p-6">Cargando…</main>;
  if (!allowed && !E2E_BYPASS) return <main className="p-6">No autorizado</main>;

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Operadores</h1>
        <div className="text-sm text-slate-600">Sesión: {sessionEmail}</div>
      </div>

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

      {E2E_BYPASS && <p className="text-xs text-slate-500">Modo prueba (bypass auth)</p>}
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-2">{children}</th>; }
function Td({ children, className='' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

/* ===== Permisos (viewer) ===== */
async function canView(email: string): Promise<boolean> {
  // user_roles (roles de lectura)
  const r = await supabase
    .from('user_roles')
    .select('role')
    .eq('email', email)
    .in('role', ['admin', 'manager', 'driver_manager', 'planner'])
    .maybeSingle();
  if (!r.error && r.data) return true;

  // Fallbacks
  const a = await supabase.from('admins').select('email').eq('email', email).maybeSingle();
  if (!a.error && a.data) return true;
  const p = await supabase.from('planners').select('email').eq('email', email).maybeSingle();
  if (!p.error && p.data) return true;

  return false;
}