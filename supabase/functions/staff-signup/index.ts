// supabase/functions/staff-signup/index.ts
// Supabase Edge Function (Deno runtime)
// Hashes password with bcrypt and inserts into staff_users with approved=false.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const { name, phone, designation, password } = await req.json()

    if (!name || !phone || !designation || !password) {
      return new Response(
        JSON.stringify({ error: 'All fields are required: name, phone, designation, password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Check for duplicate phone
    const { data: existing } = await supabase
      .from('staff_users')
      .select('id')
      .eq('phone', phone)
      .single()

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'An account with this phone number already exists.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10)

    // Insert
    const { data, error } = await supabase
      .from('staff_users')
      .insert({ name, phone, designation, password_hash, approved: false })
      .select('id, name, phone, designation, approved, created_at')
      .single()

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to create account. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ user: data }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
