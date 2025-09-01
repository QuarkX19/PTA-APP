'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Notif = {
  id: number;
  created_at: string;
  recipient_email: string;
  type: string;
  payload: any;
  read_at: string | null;
};

export default function NotiBell() {
  const [email, setEmail] = useState<string | null>(null);
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const em = s?.session?.user?.email ?? null;
      setEmail(em);
      if (!em) return;

      await load(em);

      // Realtime: nuevas notificaciones
      const ch = supabase
        .channel('notif-inserts')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        }, (payload) => {
          const row = payload.new as Notif;
          if (row.recipient_email === em) {
            setItems(prev => [row, ...prev].slice(0, 50));
          }
        })
        .subscribe();

      return () => { supabase.removeChannel(ch); };
    })();
  }, []);

  async function load(em: string) {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_email', em)
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data as Notif[]) ?? []);
  }

  const unread = items.filter(i => !i.read_at).length;

  return (
    <div className="relative">
      <button className="btn-brand" onClick={() => setOpen(v => !v)}>
        🔔 {unread ? `(${unread})` : ''}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto card p-2 text-sm z-50">
          {items.length === 0 ? (
            <div className="p-2 text-slate-500">Sin notificaciones</div>
          ) : items.map(n => (
            <div key={n.id} className="border-b last:border-0 p-2">
              <div className="text-xs text-slate-500">
                {new Date(n.created_at).toLocaleString()}
              </div>
              {renderText(n)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderText(n: { type: string; payload: any }) {
  if (n.type === 'assignment_assigned') {
    return (
      <div>
        Nueva asignación <b>{n.payload?.load_ref}</b> marcada como <b>ASIGNADO</b>.
      </div>
    );
  }
  return <div>Notificación: {n.type}</div>;
}
