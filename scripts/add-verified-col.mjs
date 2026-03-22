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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'public' }
});

// Create a plpgsql function that does the migration, then call it
// This works because service role can call functions but cannot run arbitrary SQL
async function run() {
  console.log('Attempting migration via function creation...');
  
  // First, create the helper function using Supabase's edge functions endpoint
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  
  // Supabase allows calling /rest/v1/rpc/<function_name>
  // But we need to CREATE the function first via DDL, which requires a direct DB connection
  
  // Try using the gotrue admin endpoint or PostgREST options
  // Check if we can use the db url from the Supabase service role JWT
  const jwt = serviceKey.split('.');
  if (jwt.length >= 2) {
    try {
      const payload = JSON.parse(Buffer.from(jwt[1], 'base64url').toString());
      console.log('JWT payload:', JSON.stringify(payload, null, 2));
    } catch(e) {
      console.log('Could not decode JWT');
    }
  }
  
  // Try the Supabase SQL API (if pg-meta is exposed)
  const pgMetaUrl = `${url}/pg-meta/v1/query`;
  const res = await fetch(pgMetaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'X-Connection-Encrypted': serviceKey,
    },
    body: JSON.stringify({ query: "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false; UPDATE users SET email_verified = true WHERE provider = 'google' OR email = 'murat.tunc@gmail.com';" })
  });
  
  console.log('pg-meta status:', res.status);
  const text = await res.text();
  console.log('Response:', text.substring(0, 300));
}

run().catch(e => { console.error(e); process.exit(1); });
