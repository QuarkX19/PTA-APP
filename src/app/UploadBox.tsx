'use client';

import { useEffect, useMemo, useState } from 'react';
// Si tu cliente está en src/lib/supabase.ts, esta ruta es correcta.
// Si usas alias "@/lib/supabase", cámbialo por:  import { supabase } from '@/lib/supabase';
import { supabase } from '../lib/supabase';

type Row = {
  name: string;
  path: string;
  size?: number;
  created_at?: string | null;
  signedUrl?: string;
};

const BUCKET = 'evidencias';

export default function UploadBox() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [files, setFiles] = useState<Row[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Carga/escucha usuario
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      setUserId(data.user?.id ?? null);
      setLoadingUser(false);
    })();

    const { data: authSub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, []);

  // Prefijo de carpeta del usuario
  const prefix = useMemo(() => (userId ? `${userId}` : null), [userId]);

  // Listar archivos del usuario
  const refreshList = async () => {
    if (!prefix) return;
    setRefreshing(true);
    setMessage(null);

    try {
      // Lista dentro de la carpeta del usuario
      const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      });

      if (error) throw error;

      const rows: Row[] = (data ?? []).map((f) => ({
        name: f.name,
        path: `${prefix}/${f.name}`,
        created_at: (f as any).created_at ?? null,
        size: (f as any).metadata?.size,
      }));

      // Genera enlaces firmados (útil si el bucket es privado)
      // Si prefieres descargar vía API (.download), puedes omitir esta parte.
      const enriched = await Promise.all(
        rows.map(async (r) => {
          const { data: signed, error: signErr } = await supabase
            .storage
            .from(BUCKET)
            .createSignedUrl(r.path, 60 * 10); // 10 minutos

          return {
            ...r,
            signedUrl: signErr ? undefined : signed?.signedUrl,
          };
        })
      );

      setFiles(enriched);
    } catch (err: any) {
      console.error(err);
      setMessage(err?.message ?? 'Error listando archivos');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (prefix) refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix]);

  // Subir archivos
  const onPickFiles = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const picked = ev.target.files;
    if (!picked || !userId) return;

    setUploading(true);
    setMessage(null);

    try {
      for (const file of Array.from(picked)) {
        // Evita colisiones: prefija con timestamp
        const path = `${userId}/${Date.now()}-${file.name}`;

        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'application/octet-stream',
          });

        if (error) throw error;
      }

      setMessage('✅ Archivo(s) subido(s) correctamente.');
      await refreshList();
    } catch (err: any) {
      console.error(err);
      setMessage(err?.message ?? 'Error subiendo archivo');
    } finally {
      setUploading(false);
      ev.target.value = ''; // limpia el input
    }
  };

  if (loadingUser) {
    return <div className="p-6">Cargando usuario…</div>;
  }

  if (!userId) {
    return (
      <div className="p-6 rounded border">
        <p className="mb-2 font-medium">Debes iniciar sesión para subir/consultar evidencias.</p>
        <p>Vuelve a la pantalla de login (Magic Link) e inicia sesión.</p>
      </div>
    );
  }

  return (
    <section className="max-w-2xl mx-auto p-6 rounded-xl border bg-white">
      <h2 className="text-xl font-semibold mb-3">Mis evidencias</h2>
      <p className="text-sm text-gray-600 mb-4">
        Los archivos se guardan en <code>/{userId}/</code> dentro del bucket <code>{BUCKET}</code>.
      </p>

      <div className="flex items-center gap-3 mb-5">
        <label className="inline-block">
          <span className="px-4 py-2 rounded-lg border cursor-pointer bg-gray-50 hover:bg-gray-100">
            {uploading ? 'Subiendo…' : 'Seleccionar archivos'}
          </span>
          <input
            type="file"
            multiple
            onChange={onPickFiles}
            className="hidden"
            disabled={uploading}
          />
        </label>

        <button
          onClick={refreshList}
          disabled={refreshing}
          className="px-4 py-2 rounded-lg border bg-gray-50 hover:bg-gray-100 disabled:opacity-50"
        >
          {refreshing ? 'Actualizando…' : 'Actualizar lista'}
        </button>
      </div>

      {message && (
        <div className="mb-4 text-sm">
          {message}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">Archivo</th>
              <th className="text-left px-3 py-2">Tamaño</th>
              <th className="text-left px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {files.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-gray-500">
                  No hay archivos todavía.
                </td>
              </tr>
            )}

            {files.map((f) => (
              <tr key={f.path} className="border-t">
                <td className="px-3 py-2 break-all">{f.name}</td>
                <td className="px-3 py-2">
                  {typeof f.size === 'number' ? prettyBytes(f.size) : '—'}
                </td>
                <td className="px-3 py-2">
                  {f.signedUrl ? (
                    <a
                      href={f.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Abrir / Descargar
                    </a>
                  ) : (
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={async () => {
                        // Alternativa: descarga por API (no usa URL firmada).
                        const { data, error } = await supabase.storage
                          .from(BUCKET)
                          .download(f.path);
                        if (error) {
                          alert(error.message);
                          return;
                        }
                        // Descarga en el navegador
                        const url = URL.createObjectURL(data);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = f.name;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Descargar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Utilidad chiquita para formatear bytes */
function prettyBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1)} GB`;
}
