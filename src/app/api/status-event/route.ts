import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== 'Bearer DEMO-PTA') {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { assignment_id, status_type, occurred_at } = body ?? {};
  if (!assignment_id || !status_type || !occurred_at) {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  // Simulación PTA: occurred_at + 8h
  const pta = new Date(occurred_at);
  pta.setHours(pta.getHours() + 8);

  return NextResponse.json({
    ok: true,
    pta_recalculated: true,
    pta: pta.toISOString(),
    source: 'AAT',
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}
