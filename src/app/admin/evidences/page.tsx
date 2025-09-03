'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Entry = {
  name: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  metadata?: any;
};

export default function EvidenciasPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);

  const [path, setPath] = useState<string>(''); // '' -> raíz (carpetas = userId)
  const [items, setItems] = useState<Entry[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setErr(null);
      // 1) sesión
      const { data: s } = await supabase.auth.getSession();
      const email = s?.session?.user?.email ?? '';
      setSessionEmail(email);
      if (!email) {
        setAllowed(false);
        return;
      }

      // 2) autorización robusta (user_roles; fallbacks opcionales)
      const ok = await hasAnyRole(email, ['admin', 'manager', 'planner']);
      setAllowed(ok);
      if (!ok) return;

      // 3) cargar carpeta actual
      await load(path);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  async function load(p: string) {
    const { data, error } = await supabase
      .from('storage.objects') // NO: usamos API de Storage (abajo). Dejo esta línea sólo para recordatorio.
      .select('*')
      .limit(1);

    // usamos la API nativa de Storage:
    const { data: list, error: listErr } = await supabase.storage
      .from('evidencias')
      .list(p, { limit: 100, sortBy: { column: 'updated_at', order: 'desc' } });

    if (listErr) {
      setErr(listErr.message);
      return;
    }

    setItems(list || []);

    // firmar archivos
    const tmp: Record<string, string> = {};
    for (const item of list || []) {
      // las carpetas no traen id
      if (!item.id) continue;
      const full = p ? `${p}/${item.name}` : item.name;
      const { data: signed } = await supabase.storage
        .from('evidences')
        .createSignedUrl(full, 3600);
      if (signed?.signedUrl) tmp[full] = signed.signedUrl;
    }
    setLinks(tmp);
  }

  function enterFolder(dir: string) {
    setPath((prev) => (prev ? `${prev}/${dir}` : dir));
  }
  function up() {
    if (!path) return;
    const parts = path.split('/');
    parts.pop();
    setPath(parts.join('/'));
  }

  if (allowed === null) return <main className="p-6">Cargando…</main>;
  if (!allowed) {
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold mb-2">No autorizado</h1>
        <p className="text-sm">Sesión: {sessionEmail || 'sin sesión'}</p>
        <p className="text-sm text-slate-600 mt-2">
          Requiere rol <b>admin/manager/planner</b> en <code>user_roles</code> (o en las tablas de
          respaldo <code>admins / managers / planners</code>).
        </p>
      </main>
    );
  }

  const isRoot = path === '';

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">Evidencias</h1>

      <div className="flex items-center gap-2">
        <button onClick={up} className="btn-brand disabled:opacity-50" disabled={isRoot}>
          Subir nivel
        </button>
        <div className="text-sm text-slate-600">
          Ruta: <code>{path || '/'}</code>
        </div>
        {err && <div className="text-sm text-red-700 ml-auto">{err}</div>}
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <Th>Nombre</Th>
              <Th>Última actualización</Th>
              <Th>Acción</Th>
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
                      <button onClick={() => enterFolder(it.name)} className="underline">
                        {it.name}/
                      </button>
                    ) : (
                      it.name
                    )}
                  </Td>
                  <Td>{it.updated_at ? new Date(it.updated_at).toLocaleString() : '—'}</Td>
                  <Td>
                    {!isDir ? (
                      <a
                        className="text-brand underline"
                        href={links[full]}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Descargar
                      </a>
                    ) : (
                      '—'
                    )}
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

/* ================= Helpers de autorización ================= */

async function hasAnyRole(email: string, roles: string[]): Promise<boolean> {
  // 1) user_roles (recomendado)
  const r = await supabase
    .from('user_roles')
    .select('role')
    .eq('email', email)
    .in('role', roles);

  if (!r.error && (r.data?.length ?? 0) > 0) return true;

  // 2) Fallbacks opcionales (si existen). Usamos select('*') para evitar
  //    errores de "column ... does not exist".
  try {
    const a = await supabase.from('admins').select('*').eq('email', email).maybeSingle();
    if (!a.error && a.data) return true;
  } catch {}
  try {
    const m = await supabase.from('managers').select('*').eq('email', email).maybeSingle();
    if (!m.error && m.data) return true;
  } catch {}
  try {
    const p = await supabase.from('planners').select('*').eq('email', email).maybeSingle();
    if (!p.error && p.data) return true;
  } catch {}

  return false;
}
