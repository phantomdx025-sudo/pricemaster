// useFinancial.js — data fetching hook for Financial Reports feature.
// Phase FIN-1: fetches fin_parties, fin_address, fin_sync_log, fin_pinned.
// Phase FIN-2: adds lazy per-party fetchers: ledger, outstanding, contact, notes + pin/note writes.
// Phase FIN-6 (corrected): per-party label system — fetchPartyLabel, fetchAllPartyLabels, setPartyLabel,
//   fetchCustomLabels, addCustomLabel, deleteCustomLabel.

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Module-level cache — survives re-renders, cleared on full page reload.
const cache = {
  parties: null,      // { debtor: [], creditor: [] } | null
  address: null,      // Map<lowerName, row> | null
  syncLog: null,      // array | null
  pinned: null,       // Set<'type:name'> | null
}

export function useFinancial() {
  const [debtors,    setDebtors]    = useState([])
  const [creditors,  setCreditors]  = useState([])
  const [addressMap, setAddressMap] = useState(new Map())
  const [syncLog,    setSyncLog]    = useState([])
  const [pinned,     setPinned]     = useState(new Set())

  const [loadingParties, setLoadingParties] = useState(false)
  const [loadingAddress, setLoadingAddress] = useState(false)
  const [loadingSync,    setLoadingSync]    = useState(false)
  const [error, setError] = useState(null)

  const fetchParties = useCallback(async () => {
    if (cache.parties) {
      setDebtors(cache.parties.debtor)
      setCreditors(cache.parties.creditor)
      return cache.parties
    }
    setLoadingParties(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('fin_parties')
      .select('*')
      .order('party_name')
    setLoadingParties(false)
    if (err) {
      setError(err.message)
      return { debtor: [], creditor: [] }
    }
    const rows = data ?? []
    const result = {
      debtor:   rows.filter(r => r.party_type === 'debtor'),
      creditor: rows.filter(r => r.party_type === 'creditor'),
    }
    cache.parties = result
    setDebtors(result.debtor)
    setCreditors(result.creditor)
    return result
  }, [])

  const fetchAddress = useCallback(async () => {
    if (cache.address) {
      setAddressMap(cache.address)
      return cache.address
    }
    setLoadingAddress(true)
    const { data, error: err } = await supabase
      .from('fin_address')
      .select('*')
    setLoadingAddress(false)
    if (err) {
      if (import.meta.env.DEV) console.warn('useFinancial fetchAddress:', err.message)
      return new Map()
    }
    const map = new Map()
    ;(data ?? []).forEach(row => {
      map.set(row.party_name.trim().toLowerCase(), row)
    })
    cache.address = map
    setAddressMap(map)
    return map
  }, [])

  const fetchSyncLog = useCallback(async () => {
    if (cache.syncLog) {
      setSyncLog(cache.syncLog)
      return cache.syncLog
    }
    setLoadingSync(true)
    const { data, error: err } = await supabase
      .from('fin_sync_log')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(20)
    setLoadingSync(false)
    if (err) {
      if (import.meta.env.DEV) console.warn('useFinancial fetchSyncLog:', err.message)
      return []
    }
    const rows = data ?? []
    cache.syncLog = rows
    setSyncLog(rows)
    return rows
  }, [])

  const fetchPinned = useCallback(async () => {
    if (cache.pinned) {
      setPinned(cache.pinned)
      return cache.pinned
    }
    const { data, error: err } = await supabase
      .from('fin_pinned')
      .select('party_type, party_name')
    if (err) {
      if (import.meta.env.DEV) console.warn('useFinancial fetchPinned:', err.message)
      return new Set()
    }
    const s = new Set((data ?? []).map(r => `${r.party_type}:${r.party_name}`))
    cache.pinned = s
    setPinned(s)
    return s
  }, [])

  const loadAll = useCallback(async () => {
    await Promise.all([fetchParties(), fetchAddress(), fetchSyncLog(), fetchPinned()])
  }, [fetchParties, fetchAddress, fetchSyncLog, fetchPinned])

  const clearCache = useCallback(() => {
    cache.parties = null
    cache.address = null
    cache.syncLog = null
    cache.pinned  = null
  }, [])

  // ── FIN-2: Lazy per-party fetchers ───────────────────────────

  const fetchLedger = useCallback(async (partyType, partyName) => {
    const { data, error: err } = await supabase
      .from('fin_ledger')
      .select('*')
      .eq('party_type', partyType)
      .eq('party_name', partyName)
      .order('txn_date', { ascending: true })
      .order('id', { ascending: true })
    if (err) throw new Error(err.message)
    return data ?? []
  }, [])

  const fetchOutstanding = useCallback(async (partyType, partyName) => {
    const { data, error: err } = await supabase
      .from('fin_outstanding')
      .select('*')
      .eq('party_type', partyType)
      .eq('party_name', partyName)
      .order('inv_date', { ascending: true })
    if (err) throw new Error(err.message)
    return data ?? []
  }, [])

  const fetchContact = useCallback(async (partyName) => {
    const { data, error: err } = await supabase
      .from('fin_address')
      .select('*')
      .ilike('party_name', partyName.trim())
      .limit(1)
    if (err) throw new Error(err.message)
    return (data ?? [])[0] ?? null
  }, [])

  const fetchNotes = useCallback(async (partyType, partyName) => {
    const { data, error: err } = await supabase
      .from('fin_party_notes')
      .select('*')
      .eq('party_type', partyType)
      .eq('party_name', partyName)
      .order('created_at', { ascending: false })
    if (err) throw new Error(err.message)
    return data ?? []
  }, [])

  const addNote = useCallback(async (partyType, partyName, text) => {
    const { data, error: err } = await supabase
      .from('fin_party_notes')
      .insert({ party_type: partyType, party_name: partyName, note_text: text.trim() })
      .select()
      .single()
    if (err) throw new Error(err.message)
    return data
  }, [])

  const deleteNote = useCallback(async (noteId) => {
    const { error: err } = await supabase
      .from('fin_party_notes')
      .delete()
      .eq('id', noteId)
    if (err) throw new Error(err.message)
  }, [])

  // Optimistic pin toggle — updates cache + state immediately, reverts on error
  const togglePin = useCallback(async (partyType, partyName) => {
    const key = `${partyType}:${partyName}`
    const isPinned = cache.pinned?.has(key) ?? false

    const next = new Set(cache.pinned ?? [])
    if (isPinned) next.delete(key)
    else next.add(key)
    cache.pinned = next
    setPinned(new Set(next))

    if (isPinned) {
      const { error: err } = await supabase
        .from('fin_pinned')
        .delete()
        .eq('party_type', partyType)
        .eq('party_name', partyName)
      if (err) {
        next.add(key)
        cache.pinned = new Set(next)
        setPinned(new Set(next))
        throw new Error(err.message)
      }
    } else {
      const { error: err } = await supabase
        .from('fin_pinned')
        .insert({ party_type: partyType, party_name: partyName })
      if (err) {
        next.delete(key)
        cache.pinned = new Set(next)
        setPinned(new Set(next))
        throw new Error(err.message)
      }
    }
    return !isPinned
  }, [])

  // ── FIN-6 (corrected): Per-party label system ────────────────

  // Fetch the label for a single party → labelKey string | null
  const fetchPartyLabel = useCallback(async (partyType, partyName) => {
    const { data, error: err } = await supabase
      .from('fin_party_labels')
      .select('label_key')
      .eq('party_type', partyType)
      .eq('party_name', partyName)
      .limit(1)
    if (err) throw new Error(err.message)
    return (data ?? [])[0]?.label_key ?? null
  }, [])

  // Fetch all party labels for a given type → Map<partyName, labelKey>
  const fetchAllPartyLabels = useCallback(async (partyType) => {
    const { data, error: err } = await supabase
      .from('fin_party_labels')
      .select('party_name, label_key')
      .eq('party_type', partyType)
    if (err) throw new Error(err.message)
    const map = new Map()
    ;(data ?? []).forEach(r => map.set(r.party_name, r.label_key))
    return map
  }, [])

  // Upsert or delete a party label.
  // labelKey === null or 'not_reviewed' → DELETE the row (party becomes implicitly "not reviewed")
  const setPartyLabel = useCallback(async (partyType, partyName, labelKey) => {
    if (!labelKey || labelKey === 'not_reviewed') {
      const { error: err } = await supabase
        .from('fin_party_labels')
        .delete()
        .eq('party_type', partyType)
        .eq('party_name', partyName)
      if (err) throw new Error(err.message)
      return null
    }
    const { data, error: err } = await supabase
      .from('fin_party_labels')
      .upsert(
        {
          party_type: partyType,
          party_name: partyName,
          label_key:  labelKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'party_type,party_name' }
      )
      .select()
      .single()
    if (err) throw new Error(err.message)
    return data
  }, [])

  // Fetch all custom labels (used for label manager + picker)
  const fetchCustomLabels = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('fin_custom_labels')
      .select('*')
      .order('created_at', { ascending: true })
    if (err) throw new Error(err.message)
    return data ?? []
  }, [])

  // Add a new custom label
  const addCustomLabel = useCallback(async (name, colorHex) => {
    const labelKey = crypto.randomUUID()
    const { data, error: err } = await supabase
      .from('fin_custom_labels')
      .insert({ label_key: labelKey, label_name: name.trim(), color_hex: colorHex })
      .select()
      .single()
    if (err) throw new Error(err.message)
    return data
  }, [])

  // Delete a custom label by key — also cleans up any party labels using it
  const deleteCustomLabel = useCallback(async (labelKey) => {
    await supabase
      .from('fin_party_labels')
      .delete()
      .eq('label_key', labelKey)
    const { error: err } = await supabase
      .from('fin_custom_labels')
      .delete()
      .eq('label_key', labelKey)
    if (err) throw new Error(err.message)
  }, [])

  return {
    debtors,
    creditors,
    addressMap,
    syncLog,
    pinned,
    loadingParties,
    loadingAddress,
    loadingSync,
    loading: loadingParties || loadingAddress || loadingSync,
    error,
    loadAll,
    fetchParties,
    fetchAddress,
    fetchSyncLog,
    fetchPinned,
    clearCache,
    setPinned,
    // FIN-2
    fetchLedger,
    fetchOutstanding,
    fetchContact,
    fetchNotes,
    addNote,
    deleteNote,
    togglePin,
    // FIN-6 (corrected: per-party labels)
    fetchPartyLabel,
    fetchAllPartyLabels,
    setPartyLabel,
    fetchCustomLabels,
    addCustomLabel,
    deleteCustomLabel,
  }
}
