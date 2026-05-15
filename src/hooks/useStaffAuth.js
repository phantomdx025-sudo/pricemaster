import { useState, useEffect, useCallback } from 'react'
import { saveStaffSession, getStaffSession, clearStaffSession } from '../utils/auth'

export function useStaffAuth() {
  const [staffUser, setStaffUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = getStaffSession()
    if (session) {
      // If the session has an expiresAt, check it; otherwise fall back to 7-day TTL from loginAt
      const expiry = session.expiresAt
        ? new Date(session.expiresAt).getTime()
        : new Date(session.loginAt).getTime() + 7 * 24 * 60 * 60 * 1000

      if (Date.now() < expiry) {
        setStaffUser(session)
      } else {
        clearStaffSession()
      }
    }
    setLoading(false)
  }, [])

  const login = useCallback((sessionPayload) => {
    saveStaffSession(sessionPayload)
    setStaffUser(sessionPayload)
  }, [])

  const logout = useCallback(() => {
    clearStaffSession()
    setStaffUser(null)
  }, [])

  return {
    staffUser,
    loading,
    isStaff: !!staffUser,
    login,
    logout,
  }
}
