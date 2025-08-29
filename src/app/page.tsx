'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import UploadBox from './UploadBox';

const ZONAS = [
  'NLD TSLF',
  'NL-COAHUILA',
  'BAJIO-QRO',
  'EDO Y CDMX',
  'PUEBLA TLAXCALA',
  'CHIHUAHUA',
] as const;

const MAIN_STATUSES = [
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
] as const;

const ALERT_STATUSES = ['SINIESTRO_ROBO', 'EMERGENCIA_MEDICA'] as const;

type Trip = 'LARGO' | 'CORTO';
type Zone = (typeof ZONAS)[number];
type Status =
  | (typeof MAIN_STATUSES)[number]
  | (typeof ALERT_STATUSES)[number];

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [zone, setZone] = useState<Zone | ''>('');
  const [trip, setTrip] = useState<Trip | ''>('');
  const [truck, setTruck] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  // ---------------------------
  // Sesión
  // ---------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // ---------------------------
  // Magic Link
  // ---------------------------
  const signIn = async () => {
    if (!email) return alert('Escribe tu correo');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) alert(error.message);
    else alert('Revisa tu correo y entra con el Magic Link.');
  };

  // ---------------------------
  // Asegurar/crear operador
  // ---------------------------
  const ensureOperator = async (userEmail: string) => {
    const { data, error } = await supabase
      .from('operators')
      .select('*')
      .eq('email', userEmail)
      .maybeSingle();
    if (error) throw error;

    if (data) return data.id;

    const fullName = userEmail.split('@')[0].replace('.', ' ').toUpperCase();
    const ins = await supabase
      .from('operators')
      .insert({
        email: userEmail,
        full_name: fullName,
        current_truck: truck || null,
      })
      .select('id')
      .single();

    if (ins.error) throw ins.error;
    return ins.data.id;
  };

  // ---------------------------
  // Subir evidencia
  // ---------------------------
  const uploadEvidence = async (userId: string) => {
    if (!file) return null;
    const path = `${userId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from('evidencias')
      .upload(path, file, { upsert: false });
    if (error) throw error;
    return path; // guardamos la ruta; /admin genera Signed URL
  };

  // ---------------------------
  // Enviar estatus
  // ---------------------------
  const sendStatus = async (status: Status) => {
    if (!session?.user) return alert('Primero inicia sesión.');
    if (!zone) return alert('Selecciona zona.');
    if (!trip && ['FIN_DE_VIAJE', 'EN_RUTA', 'DESCANSO'].includes(status)) {
      return alert('Selecciona tipo de viaje (LARGO/CORTO).');
    }

    setBusy(true);
    try {
      const operatorId = await ensureOperator(session.user.email);
      const path = await uploadEvidence(session.user.id);

      const { error } = await supabase.from('status_reports').insert({
        operator_id: operatorId,
        truck: truck || null,
        zone,
        status,
        trip_type: trip || null,
        note: note || null,
        attachment_url: path,
      });

      if (error) throw error;
      alert('Estatus enviado ✅');
      setFile(null);
      setNote('');
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const label = (s: string) => s.replace(/_/g, ' ');

  // ---------------------------
  // Pantalla de login
  // ---------------------------
  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md card p-6 space-y-4">
          <h1 className="text-2xl font-semibold">PTA Operadores</h1>
          <p className="text-sm text-gray-600">Inicia sesión con tu correo.</p>

          <input
            className="input-base w-full"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button onClick={signIn} className="btn-brand w-full" disabled={busy}>
            Enviar Magic Link
          </button>
        </div>
      </main>
    );
  }

  // ---------------------------
  // Pantalla principal
  // ---------------------------
  return (
    <main className="min-h-screen p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Hola, {session.user.email}</div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="btn-brand rounded-2xl px-4 py-2"
        >
          Salir
        </button>
      </div>

      {/* Filtros + archivo */}
      <div className="grid md:grid-cols-4 gap-2">
        <select
          className="input-base"
          value={zone}
          onChange={(e) => setZone(e.target.value as Zone)}
        >
          <option value="">Zona</option>
          {ZONAS.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>

        <select
          className="input-base"
          value={trip}
          onChange={(e) => setTrip(e.target.value as Trip)}
        >
          <option value="">Tipo de viaje</option>
          <option value="LARGO">LARGO</option>
          <option value="CORTO">CORTO</option>
        </select>

        <input
          className="input-base"
          placeholder="Camión (opcional)"
          value={truck}
          onChange={(e) => setTruck(e.target.value)}
        />

        <input
          type="file"
          accept="image/*,application/pdf"
          className="input-base"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      <textarea
        className="input-base w-full"
        rows={3}
        placeholder="Notas (opcional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {/* Botones azules */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {MAIN_STATUSES.map((s) => (
          <button
            key={s}
            disabled={busy}
            onClick={() => sendStatus(s)}
            className="btn-brand"
          >
            {label(s)}
          </button>
        ))}
      </div>

      {/* En móvil, los dos de alerta como botones rojos normales */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {ALERT_STATUSES.map((s) => (
          <button
            key={s}
            disabled={busy}
            onClick={() => sendStatus(s)}
            className="btn-danger"
          >
            {label(s)}
          </button>
        ))}
      </div>

      {/* Bloque de evidencias con los dos círculos rojos a los lados (md+) */}
      <section className="relative mt-8">
        {/* Círculo izquierdo */}
        <button
          type="button"
          onClick={() => sendStatus('SINIESTRO_ROBO')}
          disabled={busy}
          className="
            hidden md:flex items-center justify-center
            absolute -left-24 xl:-left-28 top-1/2 -translate-y-1/2
            w-40 h-40 xl:w-48 xl:h-48
            rounded-full shadow-lg
            bg-danger text-white font-bold text-center leading-tight
            ring-4 ring-danger/30 hover:bg-danger-700
          "
        >
          <span className="px-4">SINIESTRO<br />ROBO</span>
        </button>

        {/* Círculo derecho */}
        <button
          type="button"
          onClick={() => sendStatus('EMERGENCIA_MEDICA')}
          disabled={busy}
          className="
            hidden md:flex items-center justify-center
            absolute -right-24 xl:-right-28 top-1/2 -translate-y-1/2
            w-40 h-40 xl:w-48 xl:h-48
            rounded-full shadow-lg
            bg-danger text-white font-bold text-center leading-tight
            ring-4 ring-danger/30 hover:bg-danger-700
          "
        >
          <span className="px-4">EMERGENCIA<br />MEDICA</span>
        </button>

        {/* Tarjeta de evidencias */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-2">Mis evidencias</h2>
          <UploadBox />
        </div>
      </section>
    </main>
  );
}
