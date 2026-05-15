import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase] Missing env vars! Check your .env.local file:'
  )
  console.error('  VITE_SUPABASE_URL =', supabaseUrl ? '✓' : '✗ NOT SET')
  console.error('  VITE_SUPABASE_ANON_KEY =', supabaseAnonKey ? '✓' : '✗ NOT SET')
  console.error('')
  console.error('1. Copy .env.example → .env.local')
  console.error('2. Get values from: https://app.supabase.com/project/[your-id]/settings/api')
  console.error('3. Restart dev server')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
