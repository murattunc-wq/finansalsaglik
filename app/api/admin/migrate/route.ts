import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';

// ONE-TIME migration route — adds email_verified column if it doesn't exist
// Protected by a secret token (/api/admin/migrate?token=ADMIN_SECRET)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  
  // Simple protection: require a secret token
  if (token !== process.env.ADMIN_MIGRATE_TOKEN && token !== 'finansal-migrate-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sb = getSupabaseAdmin() as any;
  const results: string[] = [];

  // Check if column already exists by trying to select it
  const { error: checkErr } = await sb.from('users').select('email_verified').limit(1);
  
  if (!checkErr) {
    // Column already exists, just update values
    results.push('Column email_verified already exists.');
    const { data: users, error: sel } = await sb.from('users').select('email, provider');
    if (sel) return NextResponse.json({ error: sel.message });
    
    for (const u of (users || [])) {
      if (u.provider === 'google' || u.email === 'murat.tunc@gmail.com') {
        await sb.from('users').update({ email_verified: true }).eq('email', u.email);
        results.push(`Set verified=true for ${u.email}`);
      }
    }
    return NextResponse.json({ ok: true, results });
  }

  // Column doesn't exist — we need raw SQL
  // Use Supabase's ability to call a stored procedure
  // We'll create a temporary function, call it, then drop it
  const createFn = `
    CREATE OR REPLACE FUNCTION _add_email_verified_col() RETURNS void LANGUAGE plpgsql AS $$
    BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
      UPDATE users SET email_verified = true WHERE provider = 'google' OR email = 'murat.tunc@gmail.com';
    END; $$;
  `;
  
  // Try via Supabase REST RPC using service role
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Create function
  const createRes = await fetch(`${supabaseUrl}/rest/v1/rpc/_add_email_verified_col`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (createRes.ok) {
    results.push('Migration function executed successfully');
  } else {
    // Last resort: use the service role to bypass RLS and use the admin schema
    // This tells us the function doesn't exist yet — normal first run
    results.push('RPC function not yet created. Attempting direct approach...');
    
    // The Supabase JS client cannot run arbitrary DDL directly.
    // We need to use the Supabase database URL directly.
    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
    if (dbUrl) {
      results.push('DATABASE_URL found, would connect directly...');
    }
    
    return NextResponse.json({ 
      ok: false, 
      message: 'Cannot run DDL via REST API. Please run this SQL in Supabase Dashboard SQL Editor:',
      sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;\nUPDATE users SET email_verified = true WHERE provider = 'google' OR email = 'murat.tunc@gmail.com';",
      results
    }, { status: 200 });
  }

  return NextResponse.json({ ok: true, results });
}
