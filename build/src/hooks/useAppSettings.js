/**
 * useAppSettings — fetch and update app_settings from Supabase.
 *
 * fetchEntityName() — anon read, safe for client
 * setEntityName()   — authenticated write; RLS allows INSERT/UPDATE for authenticated users
 *
 * Never imports supabaseAdmin — that file uses Deno.env and is browser-incompatible.
 */

import { supabase } from '../lib/supabase'

export async function fetchEntityName() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'entity_name')
      .maybeSingle()

    if (error) throw error
    return data?.value ?? 'ANKxIOUS'
  } catch (err) {
    if (import.meta.env.DEV) console.log('[useAppSettings] fetchEntityName error:', err)
    return 'ANKxIOUS'
  }
}

export async function setEntityName(name) {
  const trimmed = (name ?? '').trim()
  if (!trimmed) throw new Error('Entity name cannot be empty')

  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'entity_name', value: trimmed }, { onConflict: 'key' })

  if (error) throw error
}
// ── BX-7: PDF Outstanding Breakdown toggle ───────────────────────────────────
// Stored in app_settings with key 'pdf_breakdown', value '1' (enabled) or '0' (disabled).
// Default is disabled (false) — not showing breakdown in PDFs by default.

export async function fetchPdfBreakdownSetting() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'pdf_breakdown')
      .maybeSingle()

    if (error) throw error
    // If the key doesn't exist yet, default is false (breakdown hidden)
    return data?.value === '1'
  } catch (err) {
    if (import.meta.env.DEV) console.log('[useAppSettings] fetchPdfBreakdownSetting error:', err)
    return false
  }
}

export async function setPdfBreakdownSetting(enabled) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'pdf_breakdown', value: enabled ? '1' : '0' }, { onConflict: 'key' })

  if (error) throw error
}

// ── BX-8: Colour Theme ───────────────────────────────────────────────────────
// Stored in app_settings with key 'theme', value is the theme ID string.
// Default is 'space' (the original deep space dark palette).
// Saved globally so ALL users (admin + staff) load the same theme.

export async function fetchTheme() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'theme')
      .maybeSingle()

    if (error) throw error
    return data?.value ?? 'space'
  } catch (err) {
    if (import.meta.env.DEV) console.log('[useAppSettings] fetchTheme error:', err)
    return 'space'
  }
}

export async function setTheme(themeId) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'theme', value: themeId }, { onConflict: 'key' })

  if (error) throw error
}
