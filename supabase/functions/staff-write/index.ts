// staff-write — admin-only edge function for all staff_users mutations.
// Protected: caller must send a valid Supabase Auth JWT (admin session).
// Actions: approve, reject, revoke, delete

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    // ── Auth check ──────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Service role client ───────────────────────────────────
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const body = await req.json()
    const { action, payload } = body

    switch (action) {

      // ── Approve: set approved=true ─────────────────────────
      case 'approve': {
        const { id } = payload
        const { data, error } = await admin
          .from('staff_users')
          .update({ approved: true })
          .eq('id', id)
          .select('id, name, phone, designation, approved, created_at')
          .single()
        if (error) throw error
        return json({ data })
      }

      // ── Revoke: set approved=false ─────────────────────────
      case 'revoke': {
        const { id } = payload
        const { data, error } = await admin
          .from('staff_users')
          .update({ approved: false })
          .eq('id', id)
          .select('id, name, phone, designation, approved, created_at')
          .single()
        if (error) throw error
        return json({ data })
      }

      // ── Delete: remove staff member entirely ───────────────
      case 'delete': {
        const { id } = payload
        const { error } = await admin
          .from('staff_users')
          .delete()
          .eq('id', id)
        if (error) throw error
        return json({ success: true })
      }

      // ── List all staff (for initial load + after mutations) ─
      case 'list': {
        const { data, error } = await admin
          .from('staff_users')
          .select('id, name, phone, designation, approved, created_at')
          .order('created_at', { ascending: false })
        if (error) throw error
        return json({ data })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
