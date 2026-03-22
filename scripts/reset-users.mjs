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
const PROTECTED = 'murat.tunc@gmail.com';

async function run() {
  console.log('Fetching all financial_data records...');
  const { data: allData, error } = await supabase.from('financial_data').select('user_id');
  if (error) { console.error('Fetch error:', error.message); process.exit(1); }

  const toDelete = (allData || []).filter(r => r.user_id !== PROTECTED).map(r => r.user_id);
  console.log('All records:', (allData||[]).map(r=>r.user_id));
  console.log('Will delete:', toDelete);

  if (toDelete.length === 0) { console.log('Nothing to delete.'); return; }

  const { error: delErr } = await supabase.from('financial_data').delete().in('user_id', toDelete);
  if (delErr) { console.error('Delete error:', delErr.message); process.exit(1); }
  console.log('Successfully deleted all financial_data except', PROTECTED, '!');
}

run().catch(e => { console.error(e); process.exit(1); });
