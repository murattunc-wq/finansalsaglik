import { createClient } from '@supabase/supabase-js';

// Lazy singleton — only created at request time, not at module evaluation (build time)
let _admin: ReturnType<typeof createClient> | null = null;
let _public: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _admin;
}

export function getSupabasePublic() {
  if (!_public) {
    _public = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _public;
}
