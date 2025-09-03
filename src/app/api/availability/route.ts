import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const operatorId =
    searchParams.get('operator_id') ?? '00000000-0000-0000-0000-000000000001';

  // Simulación de PTA para demo
  const pta = new Date(Date.now() + 8 * 3600 * 1000).toISOString();

  return NextResponse.json({
    operator_id: operatorId,
    pta,
    status: 'AVAILABLE_AT',
    source: 'AAT',
  });
}
