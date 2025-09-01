'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase, E2E_BYPASS } from '@/lib/supabase';

/* ===== Tipos ===== */
type Row = {
  id: number;
  created_at: string;
  zone: string;
  status: string;
  trip_type: string | null;
  truck: string | null;
  note: string | null;
  attachment_url: string | null;
  operator_id: string; // necesario para cruzar con assignments
  operators?: { full_name: string | null; email: string | null } | null;
};

type AssignmentStatus = 'POR_ASIGNAR' | 'ASIGNADO' | 'CANCELADO' | 'COMPLETADO';

type AssignmentLite = {
  id: number;
  created_at: string;
  operator_id: string;
  load_ref: string;
  status: AssignmentStatus;
};

type Notif = {
  id: number;
  created_at: string;
  recipient_email: string;
  type: string;
  payload: any;
  read_at: string | null;
};

/* ===== Página ===== */
export default function ReportesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string>('');

  const [rows, setRows] = useState<Row[]>([]);
  const [signed, setSigned] = useState<Record<number, string>>({}); // id -> signed url

  // operator_id -> última asignación
  const [latestAssignByOp, setLatestAssignByOp] = useState<
    Record<string, AssignmentLite | undefined>
  >({});

  const [filter, setFilter] = useState<
    'ALL' | 'ASIGNADO' | 'POR_ASIGNAR' | 'CANCELADO' | 'COMPLETADO'
  >('ALL');

  useEffect(() => {
    (async () => {
      /* ---------- BYPASS E2E ---------- */
      if (E2E_BYPASS) {
        setAllowed(true);
        const email = 'e2e@pta-app.local';
        setSessionEmail(email);

        const fakeRows: Row[] = [
          {
            id: 1001,
            created_at: new Date().toISOString(),
            zone: 'BAJIO-QRO',
            status: 'EN_RUTA',
            trip_type: 'LARGO',
            truck: 'TX-01',
            note: 'Demo e2e',
            attachment_url: 'evidencias/user-123/foto-1.jpg',
            operator_id: 'op-e2e-1',
            operators: { full_name: 'OPERADOR E2E', email: 'op1@pta-app.local' },
          },
          {
            id: 1002,
            created_at: new Date(Date.now() - 3600_000).toISOString(),
            zone: 'NLD TSLF',
            status: 'DESCANSO',
            trip_type: 'CORTO',
            truck: 'TX-02',
            note: 'Pausa programada',
            attachment_url: null,
            operator_id: 'op-e2e-2',
            operators: { full_name: 'OPERADOR 2', email: 'op2@pta-app.local' },
          },
        ];
        setRows(fakeRows);

        // firmadas “de mentira”
        setSigned({
          1001: 'about:blank',
        });

        // últimas asignaciones
        const assignMap: Record<string, AssignmentLite> = {
          'op-e2e-1': {
            id: 9001,
            created_at: new Date().toISOString(),
            operator_id: 'op-e2e-1',
            load_ref: 'LOAD-12345',
            status: 'ASIGNADO',
          },
          'op-e2e-2': {
            id: 9002,
            created_at: new Date().toISOString(),
            operator_id: 'op-e2e-2',
            load_ref: 'LOAD-99999',
            status: 'POR_ASIGNAR',
          },
        };
        setLatestAssignByOp(assignMap);

        return; // no pegar a BD en e2e
      }

      /* ---------- FLUJO REAL ---------- */
      // auth
      const { data: s } = await supabase.auth.getSession();
      const email = s?.session?.user?.email ?? '';
      setSessionEmail(email);
      if (!email) return setAllowed(false);

      const permitted = await isReportViewer(email); // admin/manager/planner
      setAllowed(permitted);
      if (!permitted) return;

      // 1) Trae status_reports (incluye operator_id y relación operators)
      const { data, error } = await supabase
        .from('status_reports')
        .select(
          'id,created_at,zone,status,trip_type,truck,note,attachment_url,operator_id,operators(full_name,email)'
        )
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) {
        console.error(error.message);
        return;
      }

      // 🔧 Normalizamos los operadores (array -> objeto) para cumplir con Row.operators
      const reports: Row[] = (data ?? []).map((d: any) => {
        const op = Array.isArray(d.operators) ? d.operators[0] ?? {} : (d.operators ?? {});
        return {
          id: d.id,
          created_at: d.created_at,
          zone: d.zone,
          status: d.status,
          trip_type: d.trip_type,
          truck: d.truck,
          note: d.note,
          attachment_url: d.attachment_url,
          operator_id: d.operator_id,
          operators: {
            full_name: op.full_name ?? null,
            email: op.email ?? null,
          },
        };
      });

      setRows(reports);

      // 2) Firma evidencias
      const tmp: Record<number, string> = {};
      for (const r of reports) {
        if (r.attachment_url) {
          const [bucket, ...rest] = r.attachment_url.split('/');
          const path = rest.join('/');
          const { data: signedUrl } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 3600);
          if (signedUrl?.signedUrl) tmp[r.id] = signedUrl.signedUrl;
        }
      }
      setSigned(tmp);

      // 3) Carga últimas asignaciones por operador
      const { data: aData, error: aErr } = await supabase
        .from('assignments')
        .select('id,created_at,operator_id,load_ref,status')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (aErr) {
        console.error(aErr.message);
      } else {
        const map: Record<string, AssignmentLite> = {};
        for (const a of (aData ?? []) as AssignmentLite[]) {
          if (!map[a.operator_id]) {
            map[a.operator_id] = a; // primer visto es el más reciente (por orden desc)
          }
        }
        setLatestAssignByOp(map);
      }
    })();
  }, []);

  const filteredRows = useMemo(() => {
    if (filter === 'ALL') return rows;
    return rows.filter((r) => {
      const a = latestAssignByOp[r.operator_id];
      if (filter === 'POR_ASIGNAR') {
        return !a || a.status === 'POR_ASIGNAR';
      }
      return a?.status === filter;
    });
  }, [rows, latestAssignByOp, filter]);

  /* ========= EXPORTS ========= */
  function flatten(r: Row) {
    const a = latestAssignByOp[r.operator_id];
    return {
      Fecha: new Date(r.created_at).toLocaleString(),
      Operador: r.operators?.full_name || '',
      Correo: r.operators?.email || '',
      Zona: r.zone,
      Estatus: r.status,
      Viaje: r.trip_type || '',
      Camion: r.truck || '',
      Nota: r.note || '',
      LOAD: a?.load_ref || '',
      EstadoAsignacion: a?.status || (!a ? 'POR_ASIGNAR' : ''),
      Evidencia: signed[r.id] || '',
    };
  }

  function exportCSV() {
    const data = filteredRows.map(flatten);
    if (data.length === 0) return alert('No hay datos para exportar.');
    const cols = Object.keys(data[0]);

    const csvLines = [
      cols.join(','),
      ...data.map((row) =>
        cols
          .map((k) => {
            const val = String((row as any)[k] ?? '');
            if (/[",\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
            return val;
          })
          .join(',')
      ),
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reportes_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportXLSX() {
    const data = filteredRows.map(flatten);
    if (data.length === 0) return alert('No hay datos para exportar.');
    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reportes');

      const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reportes_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Falta dependencia "xlsx". Instala con: npm i xlsx');
    }
  }

  async function exportPDF() {
    const data = filteredRows.map(flatten);
    if (data.length === 0) return alert('No hay datos para exportar.');

    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default as any;

      const doc = new jsPDF({ orientation: 'landscape' });
      const cols = Object.keys(data[0]);
      const body = data.map((row) => cols.map((k) => (row as any)[k]));

      autoTable(doc, {
        head: [cols],
        body,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [37, 99, 235] },
        margin: { top: 14 },
      });

      doc.save(`reportes_${Date.now()}.pdf`);
    } catch (e: any) {
      alert('Faltan dependencias "jspdf" y "jspdf-autotable".');
    }
  }

  /* =========================== */
  if (allowed === null) return <main className="p-6">Cargando…</main>;
  if (!allowed && !E2E_BYPASS) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold mb-2">No autorizado</h1>
        <p className="text-sm">Sesión: {sessionEmail || 'sin sesión'}</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--brand-navy)' }}>
          Reportes de estatus
        </h1>
        <InlineNotiBell />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Filtrar por Asignación:</label>
          <select
            className="input-base"
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'ALL' | AssignmentStatus)}
          >
            <option value="ALL">Todos</option>
            <option value="ASIGNADO">Asignado</option>
            <option value="POR_ASIGNAR">Por asignar</option>
            <option value="CANCELADO">Cancelado</option>
            <option value="COMPLETADO">Completado</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button className="btn-brand" onClick={exportCSV}>Exportar CSV</button>
          <button className="btn-brand" onClick={exportXLSX}>Exportar Excel</button>
          <button className="btn-brand" onClick={exportPDF}>Exportar PDF</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <Th>Fecha</Th>
              <Th>Operador</Th>
              <Th>Correo</Th>
              <Th>Zona</Th>
              <Th>Estatus</Th>
              <Th>Viaje</Th>
              <Th>Camión</Th>
              <Th>Nota</Th>
              <Th>Evidencia</Th>
              <Th>Asignación (LOAD)</Th>
              <Th>Estado Asignación</Th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const a = latestAssignByOp[r.operator_id];
              return (
                <tr key={r.id} className="border-t">
                  <Td>{new Date(r.created_at).toLocaleString()}</Td>
                  <Td>{r.operators?.full_name || '—'}</Td>
                  <Td className="text-xs text-slate-600">{r.operators?.email || '—'}</Td>
                  <Td>{r.zone}</Td>
                  <Td>{r.status}</Td>
                  <Td>{r.trip_type || '—'}</Td>
                  <Td>{r.truck || '—'}</Td>
                  <Td className="max-w-[28ch] truncate" title={r.note || ''}>
                    {r.note || '—'}
                  </Td>
                  <Td>
                    {r.attachment_url ? (
                      <a
                        className="text-brand underline"
                        href={signed[r.id] || '#'}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver archivo
                      </a>
                    ) : '—'}
                  </Td>
                  <Td>{a?.load_ref || '—'}</Td>
                  <Td>{a ? <Badge status={a.status} /> : <Badge status="POR_ASIGNAR" asFallback />}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {E2E_BYPASS && <p className="text-xs text-slate-500">Modo prueba (bypass auth)</p>}
    </main>
  );
}

/* ===== Mini UI helpers ===== */
function Th(props: React.ThHTMLAttributes<HTMLTableCellElement>) {
  const { children, className = '', ...rest } = props;
  return <th className={`px-3 py-2 ${className}`} {...rest}>{children}</th>;
}

function Td(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  const { children, className = '', ...rest } = props;
  return <td className={`px-3 py-2 align-top ${className}`} {...rest}>{children}</td>;
}

function Badge({ status, asFallback = false }: { status: AssignmentStatus; asFallback?: boolean }) {
  const label = status.replace(/_/g, ' ');
  const cls =
    status === 'ASIGNADO'
      ? 'bg-green-600'
      : status === 'CANCELADO'
      ? 'bg-red-600'
      : status === 'COMPLETADO'
      ? 'bg-blue-600'
      : 'bg-slate-500';
  const title = asFallback ? 'Sin asignación (por asignar)' : undefined;
  return (
    <span title={title} className={`${cls} text-white text-xs px-2 py-1 rounded-full`}>
      {label}
    </span>
  );
}

/* ===== Campanita inline ===== */
function InlineNotiBell() {
  const [email, setEmail] = useState<string | null>(null);
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (E2E_BYPASS) {
        const em = 'e2e@pta-app.local';
        setEmail(em);
        setItems([
          {
            id: 5001,
            created_at: new Date().toISOString(),
            recipient_email: em,
            type: 'assignment_assigned',
            payload: { load_ref: 'LOAD-12345' },
            read_at: null,
          },
        ]);
        return;
      }

      const { data: s } = await supabase.auth.getSession();
      const em = s?.session?.user?.email ?? null;
      setEmail(em);
      if (!em) return;

      await load(em);

      const ch = supabase
        .channel('notif-inserts')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          (payload) => {
            const row = payload.new as any as Notif;
            if (row.recipient_email === em) {
              setItems((prev) => [row, ...prev].slice(0, 50));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(ch);
      };
    })();
  }, []);

  async function load(em: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_email', em)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems(((data ?? []) as any) as Notif[]);
  }

  const unread = items.filter((i) => !i.read_at).length;

  return (
    <div className="relative">
      <button className="btn-brand" onClick={() => setOpen((v) => !v)}>
        🔔 {unread ? `(${unread})` : ''}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto card p-2 text-sm z-50">
          {items.length === 0 ? (
            <div className="p-2 text-slate-500">Sin notificaciones</div>
          ) : (
            items.map((n) => (
              <div key={n.id} className="border-b last:border-0 p-2">
                <div className="text-xs text-slate-500">
                  {new Date(n.created_at).toLocaleString()}
                </div>
                {renderText(n)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function renderText(n: Notif) {
  if (n.type === 'assignment_assigned') {
    return (
      <div>
        Nueva asignación <b>{n.payload?.load_ref}</b> marcada como <b>ASIGNADO</b>.
      </div>
    );
  }
  return <div>Notificación: {n.type}</div>;
}

/* ===== Helpers de autorización ===== */
async function isReportViewer(email: string): Promise<boolean> {
  // admin, manager o planner pueden ver
  const r = await supabase
    .from('user_roles')
    .select('role')
    .eq('email', email)
    .in('role', ['admin', 'manager', 'planner'])
    .maybeSingle();
  if (!r.error && r.data) return true;

  // Fallbacks si no existe user_roles
  const a = await supabase
    .from('admins')
    .select('email')
    .eq('email', email)
    .maybeSingle();
  if (!a.error && a.data) return true;

  const m = await supabase
    .from('managers')
    .select('email')
    .eq('email', email)
    .maybeSingle();
  if (!m.error && m.data) return true;

  const p = await supabase
    .from('planners')
    .select('email')
    .eq('email', email)
    .maybeSingle();
  if (!p.error && p.data) return true;

  return false;
}
