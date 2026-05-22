import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// How long (ms) a successful reconfirmation stays valid before re-prompting
const RECONFIRM_TTL = 5 * 60 * 1000 // 5 minutes

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reconfirmedAt, setReconfirmedAt] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  // Re-confirm the admin's identity before a destructive structural action.
  // Returns { success: boolean, error?: string }
  const reconfirmIdentity = useCallback(async (password) => {
    const email = session?.user?.email
    if (!email) return { success: false, error: 'No active session' }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error: 'Incorrect password' }

    setReconfirmedAt(Date.now())
    return { success: true }
  }, [session])

  // True if the admin reconfirmed within the last 5 minutes
  const isReconfirmed = reconfirmedAt !== null && (Date.now() - reconfirmedAt) < RECONFIRM_TTL

  return {
    session,
    loading,
    isAdmin: !!session,
    login,
    logout,
    reconfirmIdentity,
    isReconfirmed,
    reconfirmedAt,
  }
}
