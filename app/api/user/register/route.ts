import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();
  if (!email || !password) return NextResponse.json({ error: 'E-posta ve şifre gerekli' }, { status: 400 });
  const sb = getSupabaseAdmin() as any;
  const { data: existing } = await sb.from('users').select('id').eq('email', email).single();
  if (existing) return NextResponse.json({ error: 'Bu e-posta zaten kayıtlı.' }, { status: 409 });
  const hash = await bcrypt.hash(password, 12);
  const { error } = await sb.from('users').insert({
    id: email, email, name: name || email.split('@')[0], password_hash: hash, provider: 'credentials',
    email_verified: false,
  });
  if (error) return NextResponse.json({ error: 'Kayıt başarısız.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
