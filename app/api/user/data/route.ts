import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getSupabaseAdmin } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = getSupabaseAdmin() as any;
  const { data, error } = await sb
    .from('financial_data').select('data').eq('user_id', session.user.email).single();
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: 'DB error' }, { status: 500 });
  return NextResponse.json({ data: data?.data ?? null });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const sb = getSupabaseAdmin() as any;

  // Preserve existing data structures (e.g., notes, customRules) not sent in current payload
  const { data: existing } = await sb.from('financial_data').select('data').eq('user_id', session.user.email).single();
  const mergedData = { ...(existing?.data || {}), ...body };

  const { error } = await sb
    .from('financial_data')
    .upsert({ user_id: session.user.email, data: mergedData, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
