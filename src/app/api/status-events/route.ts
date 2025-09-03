// src/app/api/status-events/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // necesario si usas service role

// --------- ENV requeridas (Vercel Project Settings → Environments) ----------
// NEXT_PUBLIC_SUPABASE_URL
// NEXT_PUBLIC_SUPABASE_ANON_KEY
// SUPABASE_SERVICE_ROLE_KEY  (¡solo en servidor!)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client (permite escribir/omitir RLS desde el servidor)
function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false }
  });
}

// (Opcional) valida JWT de Supabase si no quieres usar DEMO-PTA
async function validateAuth(authHeader?: string) {
  if (!authHeader) return { ok: false, reason: 'missing_auth' };

  // Bypass de demo:
  if (authHeader === 'Bearer DEMO-PTA') return { ok: true, userId: 'demo-user' };

  // Validación real de JWT con anon key (no eleva privilegios)
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) return { ok: false, reason: 'invalid_token' };
  return { ok: true, userId: data.user.id };
}

// Aplica las reglas de PTA (simple: long = max_hours o 8; short = 4 por defecto)
function computePTA(baseISO: string, tripType: string, rule?: { min_hours: number | null; max_hours: number | null }) {
  const base = new Date(baseISO);
  const fallback =
    tripType === 'long'
      ? 8
      : 4;

  const buffer =
    (rule?.max_hours ?? rule?.min_hours ?? fallback);

  const pta = new Date(base);
  pta.setHours(pta.getHours() + buffer);
  return { ptaISO: pta.toISOString(), bufferHours: buffer };
}

export async function POST(req: Request) {
  // --------- AUTH ----------
  const auth = req.headers.get('authorization') ?? '';
  const authRes = await validateAuth(auth);
  if (!authRes.ok) {
    return NextResponse.json({ ok: false, error: authRes.reason }, { status: 401 });
  }

  // --------- INPUT ----------
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const {
    assignment_id,
    status_type,
    occurred_at,
    geo,            // { lat, lon }
    comment,
    evidence        // [{ kind, url, hash }]
  } = body ?? {};

  if (!assignment_id || !status_type || !occurred_at) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // --------- RESOLVER assignment → trip + operator ----------
  const { data: asg, error: asgErr } = await admin
    .from('assignments')
    .select('id, trip_id, operator_id')
    .eq('id', assignment_id)
    .single();

  if (asgErr || !asg) {
    return NextResponse.json({ ok: false, error: 'assignment_not_found' }, { status: 404 });
  }

  const tripId = asg.trip_id;
  const operatorId = asg.operator_id;

  // --------- INSERT status_event ----------
  const statusEventRow: any = {
    assignment_id: assignment_id,
    status_type,
    occurred_at,
    lat: geo?.lat ?? null,
    lon: geo?.lon ?? null,
    evidence_required: Array.isArray(evidence) && evidence.length > 0,
    comment: comment ?? null
  };

  const { data: evt, error: evtErr } = await admin
    .from('status_events')   // NOTE: usa el nombre real de tu tabla: STATUSEVENT vs status_events
    .insert(statusEventRow)
    .select('id')             // necesitamos el id para evidencias
    .single();

  if (evtErr || !evt) {
    console.error('insert status_event error', evtErr);
    return NextResponse.json({ ok: false, error: 'insert_status_event_failed' }, { status: 500 });
  }

  // --------- INSERT evidences (si llegan) ----------
  if (Array.isArray(evidence) && evidence.length > 0) {
    const evRows = evidence.map((e: any) => ({
      status_id: evt.id,           // FK al status_event
      kind: e.kind,
      url: e.url,
      hash: e.hash ?? null
    }));

    const { error: evErr } = await admin.from('evidences')  // nombre real de tu tabla
      .insert(evRows);

    if (evErr) {
      console.error('insert evidences error', evErr);
      // No abortamos la petición; dejamos trazado en logs
    }
  }

  // --------- REGLAS + TRIP ----------
  // Si ARRIVAL_DESTINATION → actualiza trips.aat y recalcula PTA
  let ptaISO: string | null = null;
  let ptaSource: 'AAT' | 'ETA' | null = null;

  if (status_type === 'ARRIVAL_DESTINATION') {
    // 1) lee el trip (type, eta, aat)
    const { data: trip, error: tripErr } = await admin
      .from('trips')
      .select('id, type, eta, aat, status')
      .eq('id', tripId)
      .single();

    if (tripErr || !trip) {
      console.error('trip fetch error', tripErr);
      return NextResponse.json({ ok: false, error: 'trip_not_found' }, { status: 404 });
    }

    // 2) actualiza aat con occurred_at
    const { error: updTripErr } = await admin
      .from('trips')
      .update({ aat: occurred_at, status: 'LLEGADA' })
      .eq('id', tripId);

    if (updTripErr) {
      console.error('trip update error', updTripErr);
      return NextResponse.json({ ok: false, error: 'trip_update_failed' }, { status: 500 });
    }

    // 3) trae regla PTA (por tipo de viaje y región si aplica)
    //    Si no tienes region, aplica por trip.type
    const { data: rule, error: ruleErr } = await admin
      .from('rulespta')
      .select('trip_type, min_hours, max_hours, region')
      .eq('trip_type', trip.type)
      .limit(1)
      .single();

    if (ruleErr) {
      // No abortes: usa fallback (8h long / 4h short)
      console.warn('rulespta missing, using fallback', ruleErr?.message);
    }

    // 4) calcula PTA desde AAT (source AAT)
    const { ptaISO: ptaCalc } = computePTA(occurred_at, trip.type, rule ?? undefined);
    ptaISO = ptaCalc;
    ptaSource = 'AAT';

    // 5) upsert en availability (una fila por operador)
    const upsertRow = {
      operator_id: operatorId,
      pta: ptaISO,
      source: ptaSource,
      reason: 'ARRIVAL_DESTINATION'
    };

    const { error: upErr } = await admin
      .from('availability')
      .upsert(upsertRow, { onConflict: 'operator_id' }); // requiere unique/PK sobre operator_id

    if (upErr) {
      console.error('availability upsert error', upErr);
      return NextResponse.json({ ok: false, error: 'availability_upsert_failed' }, { status: 500 });
    }

    // (Opcional) si tienes Realtime activado bastará con el upsert; si no, podrías llamar un RPC/NOTIFY.
  }

  return NextResponse.json({
    ok: true,
    pta_recalculated: Boolean(ptaISO),
    pta: ptaISO,
    source: ptaSource ?? undefined,
    assignment_id,
    operator_id: operatorId
  });
}
