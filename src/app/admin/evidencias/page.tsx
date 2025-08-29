'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Entry = { name: string; id?: string; updated_at?: string; created_at?: string; metadata?: any; };

export default function EvidenciasPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [path, setPath] = useState<string>('');  // '' -> raíz (carpetas = userId)
  const [items, setItems] = useState<Entry[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const email = s?.session?.user?.email ?? '';
      if (!email) return setAllowed(false);
      const { data: adminRow } = await supabase.from('admins').select('email').eq('email', email).maybeSingle();
      setAllowed(!!adminRow);
      if (!adminRow) return;

      await load(path);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  async function load(p: string) {
    const { data, error } = await supabase.storage.from('evidencias').list(p, { limit: 100, sortBy: { column: 'updated_at', order: 'desc' }});
    if (error) { console.error(error.message); return; }
    setItems(data || []);

    // firmar archivos
    const tmp: Record<string, string> = {};
    for (const item of data || []) {
      if (!item.id) continue; // folders no traen id
      const full = p ? `${p}/${item.name}` : item.name;
      const { data: signed } = await supabase.storage.from('evidencias').createSignedUrl(full, 3600);
      if (signed?.signedUrl) tmp[full] = signed.signedUrl;
    }
    setLinks(tmp);
  }

  function enterFolder(dir: string) { setPath(prev => (prev ? `${prev}/${dir}` : dir)); }
  function up() {
    if (!path) return;
    const parts = path.split('/'); parts.pop();
    setPath(parts.join('/'));
  }

  if (allowed === null) return <main className="p-6">Cargando…</main>;
  if (!allowed) return <main className="p-6">No autorizado</main>;

  const isRoot = path === '';

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">Evidencias</h1>
      <div className="flex items-center gap-2">
        <button onClick={up} className="btn-brand disabled:opacity-50" disabled={isRoot}>Subir nivel</button>
        <div className="text-sm text-slate-600">Ruta: <code>{path || '/'}</code></div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <Th>Nombre</Th><Th>Última actualización</Th><Th>Acción</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const isDir = !it.id; // storage.list no da id para carpetas
              const full = path ? `${path}/${it.name}` : it.name;
              return (
                <tr key={full} className="border-t">
                  <Td>
                    {isDir ? (
                      <button onClick={() => enterFolder(it.name)} className="underline">{it.name}/</button>
                    ) : it.name}
                  </Td>
                  <Td>{it.updated_at ? new Date(it.updated_at).toLocaleString() : '—'}</Td>
                  <Td>
                    {!isDir ? (
                      <a className="text-brand underline" href={links[full]} target="_blank" rel="noreferrer">Descargar</a>
                    ) : '—'}
                  </Td>
                </tr>
              );
            })}
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
