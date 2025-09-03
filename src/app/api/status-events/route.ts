// src/app/api/status-events/route.ts  (o app/api/... si no usas src/)
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ ok: true, allow: ['GET','POST'] });
}

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== 'Bearer DEMO-PTA') {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  let body: any;
  try { body = await req.json(); } catch { 
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const { assignment_id, status_type, occurred_at } = body ?? {};
  if (!assignment_id || !status_type || !occurred_at) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  const pta = new Date(occurred_at);
  pta.setHours(pta.getHours() + 8);
  return NextResponse.json({ ok: true, pta_recalculated: true, pta: pta.toISOString(), source: 'AAT' });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  });
}
