// Add email_verified column and set it properly for existing users
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envLines = fs.readFileSync('/Users/murattunc/finance-tracker/.env.local', 'utf8').split('\n');
const env = {};
for (const line of envLines) {
  const idx = line.indexOf('=');
  if (idx > 0) {
    const key = line.substring(0, idx).trim();
    const val = line.substring(idx + 1).trim().replace(/^["'](.*)["']$/, '$1');
    env[key] = val;
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // Add email_verified column if it doesn't exist
  console.log('Adding email_verified column if missing...');
  const { error: alterErr } = await supabase.rpc('exec_sql', { 
    sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;" 
  });
  
  if (alterErr) {
    console.log('RPC not available, trying raw approach...');
    // Try direct SQL via service role
    const { error: tryErr } = await supabase.from('users').select('email_verified').limit(1);
    if (tryErr && tryErr.message.includes('does not exist')) {
      console.error('Column does not exist and cannot be added via client SDK.');
      console.log('\n⚠️  MANUAL ACTION REQUIRED:');
      console.log('Run this SQL in your Supabase dashboard SQL editor:');
      console.log('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;');
      console.log('UPDATE users SET email_verified = true WHERE provider = \'google\' OR email = \'murat.tunc@gmail.com\';');
      process.exit(0);
    }
  }

  // Set verified for google users and protected user
  const { data: users } = await supabase.from('users').select('id, email, provider');
  console.log('Users:', (users||[]).map(u => `${u.email} (${u.provider})`));
  
  const verified = (users||[]).filter(u => u.provider === 'google' || u.email === 'murat.tunc@gmail.com');
  for (const u of verified) {
    const { error } = await supabase.from('users').update({ email_verified: true }).eq('email', u.email);
    console.log(error ? `❌ ${u.email}: ${error.message}` : `✅ ${u.email} = verified`);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
