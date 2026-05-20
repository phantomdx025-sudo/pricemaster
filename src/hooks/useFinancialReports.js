// useFinancialReports.js — data fetching hook for the Reports page.
// Phase AX-2: fetchPeriodSummary, fetchCurrentOutstanding.
// Phase AX-4: fetchLastPayments, fetchOutstandingPerParty — implemented.

import { useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useFinancialReports() {

  /**
   * fetchPeriodSummary(from, to)
   * Fetches all fin_ledger rows where txn_date is between `from` and `to` (inclusive).
   * Both `from` and `to` are ISO date strings e.g. '2024-04-01'.
   * Returns { debtorRows: [], creditorRows: [] }
   * Caller computes all metrics client-side from these arrays.
   *
   * NOTE: Always uses a date range — never fetches unfiltered.
   */
  const fetchPeriodSummary = useCallback(async (from, to) => {
    const { data, error } = await supabase
      .from('fin_ledger')
      .select('party_name, party_type, txn_date, debit, credit, vch_type, vch_no, balance')
      .gte('txn_date', from)
      .lte('txn_date', to)
      .order('txn_date', { ascending: true })
      .order('id', { ascending: true })

    if (error) throw new Error(error.message)

    const rows = data ?? []
    return {
      debtorRows:   rows.filter(r => r.party_type === 'debtor'),
      creditorRows: rows.filter(r => r.party_type === 'creditor'),
    }
  }, [])

  /**
   * fetchCurrentOutstanding()
   * Returns the current outstanding snapshot (not date-filtered — it's always current).
   * Returns { debtorTotal: number, creditorTotal: number }
   */
  const fetchCurrentOutstanding = useCallback(async () => {
    const { data, error } = await supabase
      .from('fin_outstanding')
      .select('party_type, remaining')

    if (error) throw new Error(error.message)

    let debtorTotal = 0
    let creditorTotal = 0
    ;(data ?? []).forEach(r => {
      const amt = parseFloat(r.remaining) || 0
      if (r.party_type === 'debtor')   debtorTotal   += amt
      else if (r.party_type === 'creditor') creditorTotal += amt
    })

    return { debtorTotal, creditorTotal }
  }, [])

  /**
   * fetchLastPayments(partyType) — AX-4
   * Returns the latest payment date per party.
   * For debtors: last row where credit > 0
   * For creditors: last row where debit > 0
   */
  const fetchLastPayments = useCallback(async (partyType) => {
    // The filter column depends on party type
    const amtCol = partyType === 'debtor' ? 'credit' : 'debit'

    const { data, error } = await supabase
      .from('fin_ledger')
      .select('party_name, txn_date')
      .eq('party_type', partyType)
      .gt(amtCol, 0)
      .order('txn_date', { ascending: false })

    if (error) throw new Error(error.message)

    // Keep only the latest row per party_name
    const map = new Map()
    ;(data ?? []).forEach(r => {
      if (!map.has(r.party_name)) {
        map.set(r.party_name, r.txn_date)
      }
    })

    return Array.from(map.entries()).map(([party_name, last_payment_date]) => ({
      party_name,
      last_payment_date,
    }))
  }, [])

  /**
   * fetchOutstandingPerParty(partyType) — AX-4
   * Returns outstanding sum per party.
   */
  const fetchOutstandingPerParty = useCallback(async (partyType) => {
    const { data, error } = await supabase
      .from('fin_outstanding')
      .select('party_name, remaining')
      .eq('party_type', partyType)

    if (error) throw new Error(error.message)

    // Sum per party
    const map = new Map()
    ;(data ?? []).forEach(r => {
      const prev = map.get(r.party_name) ?? 0
      map.set(r.party_name, prev + (parseFloat(r.remaining) || 0))
    })

    return Array.from(map.entries()).map(([party_name, outstanding]) => ({
      party_name,
      outstanding,
    }))
  }, [])

  /**
   * fetchAllLedger() — BX-1
   * Fetches ALL fin_ledger rows with no date filter.
   * Returns { debtorRows: [], creditorRows: [] }
   */
  const fetchAllLedger = useCallback(async () => {
    const { data, error } = await supabase
      .from('fin_ledger')
      .select('party_name, party_type, txn_date, debit, credit, vch_type, vch_no, balance')
      .order('txn_date', { ascending: true })
      .order('id',       { ascending: true })

    if (error) throw new Error(error.message)
    const rows = data ?? []
    return {
      debtorRows:   rows.filter(r => r.party_type === 'debtor'),
      creditorRows: rows.filter(r => r.party_type === 'creditor'),
    }
  }, [])

  return {
    fetchPeriodSummary,
    fetchCurrentOutstanding,
    fetchLastPayments,
    fetchOutstandingPerParty,
    fetchAllLedger,
  }
}
