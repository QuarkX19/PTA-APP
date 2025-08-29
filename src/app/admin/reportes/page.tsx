'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Row = {
  id: number;
  created_at: string;
  zone: string;
  status: string;
  trip_type: string | null;
  truck: string | null;
  note: string | null;
  attachment_url: string | null;
  operators?: { full_name: string | null; email: string | null } | null;
};

export default function ReportesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [signed, setSigned] = useState<Record<number, string>>({}); // id -> url

  useEffect(() => {
    (async () => {
      // guard admin
      const { data: s } = await supabase.auth.getSession();
      const email = s?.session?.user?.email ?? '';
      if (!email) return setAllowed(false);
      const { data: adminRow } = await supabase.from('admins').select('email').eq('email', email).maybeSingle();
      setAllowed(!!adminRow);

      if (!adminRow) return;

      const { data, error } = await supabase
        .from('status_reports')
        .select('id,created_at,zone,status,trip_type,truck,note,attachment_url,operators(full_name,email)')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) {
        console.error(error.message);
        return;
      }
      setRows(data ?? []);

      // firmar evidencias
      const tmp: Record<number, string> = {};
      for (const r of data ?? []) {
        if (r.attachment_url) {
          const [bucket, ...rest] = r.attachment_url.split('/');
          const path = rest.join('/');
          const { data: signedUrl } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
          if (signedUrl?.signedUrl) tmp[r.id] = signedUrl.signedUrl;
        }
      }
      setSigned(tmp);
    })();
  }, []);

  if (allowed === null) return <main className="p-6">Cargando…</main>;
  if (!allowed) return <main className="p-6">No autorizado</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Reportes de estatus</h1>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <Th>Fecha</Th><Th>Operador</Th><Th>Zona</Th><Th>Estatus</Th><Th>Viaje</Th><Th>Camión</Th><Th>Nota</Th><Th>Evidencia</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <Td>{new Date(r.created_at).toLocaleString()}</Td>
                <Td>
                  <div className="font-medium">{r.operators?.full_name || '—'}</div>
                  <div className="text-xs text-slate-600">{r.operators?.email || '—'}</div>
                </Td>
                <Td>{r.zone}</Td>
                <Td>{r.status}</Td>
                <Td>{r.trip_type || '—'}</Td>
                <Td>{r.truck || '—'}</Td>
                <Td className="max-w-[28ch] truncate" title={r.note || ''}>{r.note || '—'}</Td>
                <Td>
                  {r.attachment_url ? (
                    <a className="text-brand underline" href={signed[r.id]} target="_blank" rel="noreferrer">Ver archivo</a>
                  ) : '—'}
                </Td>
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
