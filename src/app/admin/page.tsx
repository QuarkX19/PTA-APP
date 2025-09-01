'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

/* ========= Tipos ========= */
type Row = {
  id: number;
  created_at: string;
  zone: string | null;
  status: string | null;
  trip_type: string | null;
  truck: string | null;
  note: string | null;
  attachment_url: string | null;
  operator_id?: string | null;
  operators?: { full_name: string | null; email: string | null } | null;
};

export default function AdminHomePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setErrorMsg(null);

        // 👇 importante: incluye operator_id y relación operators
        const { data, error } = await supabase
          .from('status_reports')
          .select(
            'id,created_at,zone,status,trip_type,truck,note,attachment_url,operator_id,operators(full_name,email)'
          )
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        // 👇 normaliza operators: array -> objeto
        const normalized: Row[] = (data ?? []).map((d: any) => {
          const op = Array.isArray(d.operators)
            ? d.operators[0] ?? {}
            : d.operators ?? {};
          return {
            id: d.id,
            created_at: d.created_at,
            zone: d.zone ?? null,
            status: d.status ?? null,
            trip_type: d.trip_type ?? null,
            truck: d.truck ?? null,
            note: d.note ?? null,
            attachment_url: d.attachment_url ?? null,
            operator_id: d.operator_id ?? null,
            operators: {
              full_name: op.full_name ?? null,
              email: op.email ?? null,
            },
          };
        });

        setRows(normalized);
      } catch (e: any) {
        setErrorMsg(e?.message ?? 'Error al cargar datos');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--brand-navy)' }}>
          Admin
        </h1>
        <p className="text-slate-600">Cargando…</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--brand-navy)' }}>
          Panel de administración
        </h1>
        <nav className="flex gap-2">
          <Link href="/" className="btn-brand">Inicio</Link>
          <Link href="/admin/reportes" className="btn-brand">Reportes</Link>
        </nav>
      </header>

      {errorMsg && (
        <div className="card p-3 text-sm text-red-700 bg-red-50 border border-red-200">
          {errorMsg}
        </div>
      )}

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
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <Td>{new Date(r.created_at).toLocaleString()}</Td>
                <Td>{r.operators?.full_name || '—'}</Td>
                <Td className="text-xs text-slate-600">{r.operators?.email || '—'}</Td>
                <Td>{r.zone || '—'}</Td>
                <Td>{r.status || '—'}</Td>
                <Td>{r.trip_type || '—'}</Td>
                <Td>{r.truck || '—'}</Td>
                <Td className="max-w-[28ch] truncate" title={r.note || ''}>
                  {r.note || '—'}
                </Td>
                <Td>
                  {r.attachment_url ? (
                    <span className="text-slate-500">(protegido)</span>
                  ) : (
                    '—'
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

/* ===== Helpers de celdas aceptando props nativas (title, colSpan, etc.) ===== */
function Th(props: React.ThHTMLAttributes<HTMLTableCellElement>) {
  const { children, className = '', ...rest } = props;
  return (
    <th className={`px-3 py-2 ${className}`} {...rest}>
      {children}
    </th>
  );
}
function Td(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  const { children, className = '', ...rest } = props;
  return (
    <td className={`px-3 py-2 align-top ${className}`} {...rest}>
      {children}
    </td>
  );
}
