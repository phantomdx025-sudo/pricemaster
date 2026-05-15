// ⚠️  This file must ONLY be imported in Supabase Edge Functions (Deno runtime).
// NEVER import this in any browser-side React component or page.
// The service_role key has full database access and bypasses RLS.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
