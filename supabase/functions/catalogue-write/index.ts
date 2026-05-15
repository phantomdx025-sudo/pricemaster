// catalogue-write — admin-only edge function for all catalogue mutations.
// Protected: caller must send a valid Supabase Auth JWT (admin session).
// Actions: add-item, update-item, delete-item, add-tab, delete-tab, add-category, delete-category

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

    // Verify the JWT with the anon client — getUser validates the token against Supabase Auth
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

    // ── Service role client for actual writes ─────────────────
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const body = await req.json()
    const { action, payload } = body

    // ── Route to action ───────────────────────────────────────
    switch (action) {

      // ── ITEM: add ──────────────────────────────────────────
      case 'add-item': {
        const { tab_id, item_name, rate, rate_without_gst, unit_qty, qty, qty_with_gst } = payload
        // Compute next row_index
        const { data: existing } = await admin
          .from('inv_items')
          .select('row_index')
          .eq('tab_id', tab_id)
          .order('row_index', { ascending: false })
          .limit(1)
        const nextIndex = (existing?.[0]?.row_index ?? -1) + 1
        const { data, error } = await admin
          .from('inv_items')
          .insert({
            tab_id,
            row_index: nextIndex,
            item_name: item_name?.trim() ?? null,
            rate: rate?.trim() || null,
            rate_without_gst: rate_without_gst?.trim() || null,
            unit_qty: unit_qty?.trim() || null,
            qty: qty?.trim() || null,
            qty_with_gst: qty_with_gst?.trim() || null,
          })
          .select()
          .single()
        if (error) throw error
        return json({ data })
      }

      // ── ITEM: update ───────────────────────────────────────
      case 'update-item': {
        const { id, item_name, rate, rate_without_gst, unit_qty, qty, qty_with_gst } = payload
        const { data, error } = await admin
          .from('inv_items')
          .update({
            item_name: item_name?.trim() ?? null,
            rate: rate?.trim() || null,
            rate_without_gst: rate_without_gst?.trim() || null,
            unit_qty: unit_qty?.trim() || null,
            qty: qty?.trim() || null,
            qty_with_gst: qty_with_gst?.trim() || null,
          })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return json({ data })
      }

      // ── ITEM: delete ───────────────────────────────────────
      case 'delete-item': {
        const { id } = payload
        const { error } = await admin.from('inv_items').delete().eq('id', id)
        if (error) throw error
        return json({ success: true })
      }

      // ── TAB: add ───────────────────────────────────────────
      case 'add-tab': {
        const { category_id, name } = payload
        const { data: existing } = await admin
          .from('inv_tabs')
          .select('position')
          .eq('category_id', category_id)
          .order('position', { ascending: false })
          .limit(1)
        const nextPos = (existing?.[0]?.position ?? -1) + 1
        const { data, error } = await admin
          .from('inv_tabs')
          .insert({ category_id, name: name.trim(), position: nextPos })
          .select()
          .single()
        if (error) throw error
        return json({ data })
      }

      // ── TAB: delete (cascades to items via FK) ─────────────
      case 'delete-tab': {
        const { id } = payload
        const { error } = await admin.from('inv_tabs').delete().eq('id', id)
        if (error) throw error
        return json({ success: true })
      }

      // ── CATEGORY: add ──────────────────────────────────────
      case 'add-category': {
        const { name, icon } = payload
        const { data: existing } = await admin
          .from('inv_categories')
          .select('position')
          .order('position', { ascending: false })
          .limit(1)
        const nextPos = (existing?.[0]?.position ?? -1) + 1
        const { data, error } = await admin
          .from('inv_categories')
          .insert({ name: name.trim(), icon: icon?.trim() || null, position: nextPos })
          .select()
          .single()
        if (error) throw error
        return json({ data })
      }

      // ── CATEGORY: delete (cascades to tabs + items) ────────
      case 'delete-category': {
        const { id } = payload
        const { error } = await admin.from('inv_categories').delete().eq('id', id)
        if (error) throw error
        return json({ success: true })
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
