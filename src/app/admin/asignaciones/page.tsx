'use client';

import { useEffect, useState } from 'react';
import { supabase, E2E_BYPASS } from '@/lib/supabase';

type Operator = { id: string; full_name: string | null; email: string };
type Assignment = {
  id: number;
  created_at: string;
  operator_id: string;
  load_ref: string;
  zone: string | null;
  trip_type: 'LARGO' | 'CORTO' | null;
  truck: string | null;
  note: string | null;
  status: 'POR_ASIGNAR' | 'ASIGNADO' | 'CANCELADO' | 'COMPLETADO';
};

export default function AsignacionesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [sessionEmail, setSessionEmail] = useState('');
  const [ops, setOps] = useState<Operator[]>([]);
  const [recent, setRecent] = useState<Assignment[]>([]);

  // Form
  const [operatorId, setOperatorId] = useState('');
  const [loadRef, setLoadRef] = useState('');
  const [zone, setZone] = useState('');
  const [trip, setTrip] = useState<'LARGO' | 'CORTO' | ''>('');
  const [truck, setTruck] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      // --- BYPASS PARA E2E (sin login) ---
      if (E2E_BYPASS) {
        setAllowed(true);
        setSessionEmail('e2e@pta-app.local');
        setOps([]);          // puedes meter mocks si lo deseas
        setRecent([]);       // lista vacía para pruebas
        return;
      }

      // --- FLUJO REAL ---
      const { data: s } = await supabase.auth.getSession();
      const email = s?.session?.user?.email ?? '';
      setSessionEmail(email);
      if (!email) return setAllowed(false);

      const permitted = await isPlannerOrAdmin(email); // manager NO escribe
      setAllowed(permitted);
      if (!permitted) return;

      const { data: opsData } = await supabase
        .from('operators')
        .select('id,full_name,email')
        .order('full_name', { ascending: true });
      setOps(opsData ?? []);

      await reloadRecent();
    })();
  }, []);

  async function reloadRecent() {
    if (E2E_BYPASS) return; // en e2e no pegamos a DB
    const { data } = await supabase
      .from('assignments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setRecent((data as Assignment[]) ?? []);
  }

  const resetForm = () => {
    setLoadRef('');
    setZone('');
    setTrip('');
    setTruck('');
    setNote('');
  };

  const save = async () => {
    if (!operatorId || !loadRef) {
      alert('Selecciona operador y captura la referencia de carga.');
      return;
    }
    setBusy(true); setOk(false); setLastError(null);

    try {
      // --- Simulación local en e2e ---
      if (E2E_BYPASS) {
        const fake: Assignment = {
          id: Date.now(),
          created_at: new Date().toISOString(),
          operator_id: operatorId || 'fake-op',
          load_ref: loadRef,
          zone: zone || null,
          trip_type: (trip || null) as any,
          truck: truck || null,
          note: note || null,
          status: 'POR_ASIGNAR',
        };
        setRecent(prev => [fake, ...prev].slice(0, 50));
        setOk(true);
        resetForm();
        return;
      }

      // --- Inserción real ---
      const { error } = await supabase.from('assignments').insert({
        operator_id: operatorId,
        load_ref: loadRef,
        zone: zone || null,
        trip_type: (trip || null) as any,
        truck: truck || null,
        note: note || null,
        status: 'POR_ASIGNAR',
        created_by: sessionEmail || null,
      });
      if (error) throw error;
      setOk(true);
      resetForm();
      await reloadRecent();
    } catch (e: any) {
      setLastError(e?.message ?? 'Error inesperado');
    } finally {
      setBusy(false);
    }
  };

  async function markAssigned(id: number) {
    setBusy(true); setLastError(null);
    try {
      // --- Simulación local en e2e ---
      if (E2E_BYPASS) {
        setRecent(prev => prev.map(a => a.id === id ? { ...a, status: 'ASIGNADO' } : a));
        return;
      }

      // --- Update real ---
      const { error } = await supabase
        .from('assignments')
        .update({ status: 'ASIGNADO' })
        .eq('id', id);
      if (error) throw error;
      await reloadRecent(); // el trigger creará notificaciones
    } catch (e: any) {
      setLastError(e?.message ?? 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) return <main className="p-6">Cargando…</main>;
  if (!allowed && !E2E_BYPASS) return <main className="p-6">No autorizado</main>;

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--brand-navy)' }}>
          Asignaciones (Planner)
        </h1>
        <div className="text-sm text-slate-600">Sesión: {sessionEmail || (E2E_BYPASS ? 'e2e@pta-app.local' : '')}</div>
      </header>

      <div className="card p-4 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <select className="input-base" value={operatorId} onChange={e => setOperatorId(e.target.value)}>
            <option value="">Selecciona operador</option>
            {ops.map(o => (
              <option key={o.id} value={o.id}>{o.full_name || o.email}</option>
            ))}
          </select>

          <input
            className="input-base"
            placeholder="Referencia de carga (LOAD #)"
            value={loadRef}
            onChange={e => setLoadRef(e.target.value)}
          />

          <input className="input-base" placeholder="Zona (opcional)" value={zone} onChange={e => setZone(e.target.value)} />

          <select className="input-base" value={trip} onChange={e => setTrip(e.target.value as any)}>
            <option value="">Tipo de viaje (opcional)</option>
            <option value="LARGO">LARGO</option>
            <option value="CORTO">CORTO</option>
          </select>

          <input className="input-base" placeholder="Camión (opcional)" value={truck} onChange={e => setTruck(e.target.value)} />

          <input
            className="input-base md:col-span-2"
            placeholder="Notas (opcional)"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <button className="btn-brand" onClick={save} disabled={busy}>Guardar asignación</button>
          {ok && <span className="text-green-700 text-sm">Guardado ✅</span>}
          {lastError && <span className="text-red-700 text-sm">{lastError}</span>}
          {E2E_BYPASS && <span className="text-xs text-slate-500 ml-auto">Modo prueba (bypass auth)</span>}
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Recientes</h2>
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <Th>Fecha</Th><Th>LOAD</Th><Th>Zona</Th><Th>Viaje</Th><Th>Camión</Th><Th>Estado</Th><Th>Acción</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map(a => (
                <tr key={a.id} className="border-t">
                  <Td>{new Date(a.created_at).toLocaleString()}</Td>
                  <Td>{a.load_ref}</Td>
                  <Td>{a.zone || '—'}</Td>
                  <Td>{a.trip_type || '—'}</Td>
                  <Td>{a.truck || '—'}</Td>
                  <Td>{a.status}</Td>
                  <Td>
                    {a.status === 'POR_ASIGNAR' ? (
                      <button className="btn-brand" onClick={() => markAssigned(a.id)} disabled={busy}>
                        Marcar ASIGNADO
                      </button>
                    ) : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-2">{children}</th>; }
function Td({ children, className='' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

/* ===== Helpers ===== */
async function isPlannerOrAdmin(email: string): Promise<boolean> {
  // planner o admin pueden escribir
  const r = await supabase
    .from('user_roles')
    .select('role')
    .eq('email', email)
    .in('role', ['planner','admin'])
    .maybeSingle();
  if (!r.error && r.data) return true;

  // Fallbacks si no tienes user_roles
  const a = await supabase.from('admins').select('email').eq('email', email).maybeSingle();
  if (!a.error && a.data) return true;

  const p = await supabase.from('planners').select('email').eq('email', email).maybeSingle();
  if (!p.error && p.data) return true;

  return false;
}
