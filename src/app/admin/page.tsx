'use client';

import { useEffect, useMemo, useState } from 'react';
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
  operators: {
    full_name: string | null;
    email: string;
  } | null;
};

// Si quieres, cambia estas listas por las que usas en la app principal:
const ZONAS = [
  'NLD TSLF',
  'NL-COAHUILA',
  'BAJIO-QRO',
  'EDO Y CDMX',
  'PUEBLA TLAXCALA',
  'CHIHUAHUA',
] as const;

const STATUSES = [
  'DISPONIBLE',
  'EN_RUTA',
  'DESCANSO',
  'LLEGADA_DESTINO',
  'EN_CARGA',
  'EN_DESCARGA',
  'FIN_DE_VIAJE',
  'VACACIONES',
  'FALLA_MECANICA',
  'RECARGA_DIESEL',
  'SINIESTRO_ROBO',
  'EMERGENCIA_MEDICA',
] as const;

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
const PDF_EXTS = ['pdf'];

function getExt(path: string | null) {
  if (!path) return '';
  const p = path.split('?')[0]; // limpia query
  const parts = p.split('.');
  return (parts.pop() || '').toLowerCase();
}

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // ---------- Filtros ----------
  const [from, setFrom] = useState<string>(''); // YYYY-MM-DD
  const [to, setTo] = useState<string>('');     // YYYY-MM-DD
  const [zone, setZone] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [q, setQ] = useState<string>('');       // búsqueda libre

  // ---------- Modal de preview ----------
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<'image' | 'pdf' | null>(null);

  useEffect(() => {
    (async () => {
      // 1) ¿Soy admin?
      const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin');
      if (adminErr) {
        console.error(adminErr);
        setAllowed(false);
        return;
      }
      setAllowed(!!isAdmin);

      if (!isAdmin) return;

      // 2) carga inicial
      fetchRows();
    })();
  }, []);

  const fetchRows = async () => {
    setLoading(true);
    // Traer TODOS los reportes + datos del operador (filtros server-side donde es fácil)
    let query = supabase
      .from('status_reports')
      .select(`
        id, created_at, zone, status, trip_type, truck, note, attachment_url,
        operators:operator_id ( full_name, email )
      `)
      .order('created_at', { ascending: false });

    if (from) query = query.gte('created_at', new Date(from).toISOString());
    if (to) {
      // sumar 1 día para que incluya todo el día "to"
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lt('created_at', toDate.toISOString());
    }
    if (zone) query = query.eq('zone', zone);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data || []) as Row[]);
    }
    setLoading(false);
  };

  // Búsqueda simple en cliente (sobre lo ya filtrado por server)
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const qq = q.toLowerCase();
    return rows.filter((r) => {
      const op = r.operators;
      const hay =
        (op?.full_name || '').toLowerCase().includes(qq) ||
        (op?.email || '').toLowerCase().includes(qq) ||
        (r.truck || '').toLowerCase().includes(qq) ||
        (r.note || '').toLowerCase().includes(qq) ||
        r.zone.toLowerCase().includes(qq) ||
        r.status.toLowerCase().includes(qq);
      return hay;
    });
  }, [rows, q]);

  const resetFilters = () => {
    setFrom('');
    setTo('');
    setZone('');
    setStatus('');
    setQ('');
    fetchRows();
  };

  // Generar un link firmado al vuelo para un adjunto
  const openAttachment = async (path: string) => {
    const { data, error } = await supabase
      .storage
      .from('evidencias')
      .createSignedUrl(path, 60 * 60); // 1 hora

    if (error) {
      alert('No se pudo abrir el adjunto: ' + error.message);
      return;
    }
    if (!data?.signedUrl) return;

    const ext = getExt(path);
    if (IMAGE_EXTS.includes(ext)) {
      setPreviewKind('image');
      setPreviewUrl(data.signedUrl);
    } else if (PDF_EXTS.includes(ext)) {
      setPreviewKind('pdf');
      setPreviewUrl(data.signedUrl);
    } else {
      // otro tipo de archivo: lo abrimos en pestaña nueva
      window.open(data.signedUrl, '_blank');
    }
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewKind(null);
  };

  // Exportar CSV de lo que se ve en pantalla (filtered)
  const exportCSV = () => {
    const headers = [
      'Fecha',
      'Operador',
      'Correo',
      'Zona',
      'Estatus',
      'Viaje',
      'Camion',
      'Notas',
      'Adjunto(ruta)',
    ];
    const lines = filtered.map((r) => [
      new Date(r.created_at).toLocaleString(),
      (r.operators?.full_name || '').replaceAll('"', '""'),
      (r.operators?.email || '').replaceAll('"', '""'),
      r.zone.replaceAll('"', '""'),
      r.status.replaceAll('"', '""'),
      (r.trip_type || '').replaceAll('"', '""'),
      (r.truck || '').replaceAll('"', '""'),
      (r.note || '').replaceAll('"', '""'),
      (r.attachment_url || '').replaceAll('"', '""'),
    ]);
    const csv =
      [headers, ...lines]
        .map((row) => row.map((c) => `"${c}"`).join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `reportes_${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (allowed === null) {
    return <main className="p-6">Verificando permisos…</main>;
  }
  if (!allowed) {
    return <main className="p-6">No autorizado. Esta vista es solo para administradores.</main>;
  }

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Turnos / Reportes de Operadores</h1>
          <p className="text-sm text-slate-600">
            Filtra, previsualiza adjuntos y exporta a CSV.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-brand rounded-2xl px-4 py-2" onClick={exportCSV}>
            Exportar CSV
          </button>
          <button className="btn rounded-2xl px-4 py-2 border" onClick={resetFilters}>
            Limpiar filtros
          </button>
        </div>
      </header>

      {/* Filtros */}
      <section className="grid md:grid-cols-6 gap-2">
        <div className="md:col-span-2">
          <label className="block text-xs text-slate-500 mb-1">Desde</label>
          <input
            type="date"
            className="input-base"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-slate-500 mb-1">Hasta</label>
          <input
            type="date"
            className="input-base"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Zona</label>
          <select className="input-base" value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="">Todas</option>
            {ZONAS.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Estatus</label>
          <select className="input-base" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="md:col-span-4">
          <label className="block text-xs text-slate-500 mb-1">Búsqueda (operador, correo, camión, notas, zona, estatus)</label>
          <input
            className="input-base"
            placeholder="Escribe para filtrar rápido…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="md:col-span-2 flex items-end gap-2">
          <button className="btn-brand rounded-2xl px-4 py-2 w-full" onClick={fetchRows}>
            Aplicar filtros
          </button>
        </div>
      </section>

      {loading ? <p>Cargando…</p> : null}

      <div className="overflow-x-auto rounded-2xl border">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Operador</th>
              <th className="px-3 py-2 text-left">Correo</th>
              <th className="px-3 py-2 text-left">Zona</th>
              <th className="px-3 py-2 text-left">Estatus</th>
              <th className="px-3 py-2 text-left">Viaje</th>
              <th className="px-3 py-2 text-left">Camión</th>
              <th className="px-3 py-2 text-left">Notas</th>
              <th className="px-3 py-2 text-left">Adjunto</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2">{r.operators?.full_name || '—'}</td>
                <td className="px-3 py-2">{r.operators?.email}</td>
                <td className="px-3 py-2">{r.zone}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2">{r.trip_type || '—'}</td>
                <td className="px-3 py-2">{r.truck || '—'}</td>
                <td className="px-3 py-2 max-w-[360px]">
                  <span title={r.note || ''} className="line-clamp-2">
                    {r.note || '—'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {r.attachment_url ? (
                    <button
                      className="btn-brand px-3 py-1 rounded-2xl"
                      onClick={() => openAttachment(r.attachment_url!)}
                    >
                      Ver
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length && !loading ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={9}>
                  No hay reportes con los filtros actuales.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Modal simple para preview */}
      {previewUrl && previewKind && (
        <div
          className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-auto p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Vista previa</h3>
              <button className="btn rounded-2xl px-3 py-1 border" onClick={closePreview}>
                Cerrar
              </button>
            </div>

            {previewKind === 'image' ? (
              <img
                src={previewUrl}
                alt="Adjunto"
                className="w-full h-auto rounded-xl"
              />
            ) : previewKind === 'pdf' ? (
              <iframe
                src={previewUrl}
                className="w-full h-[75vh] rounded-xl"
              />
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
