import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

/**
 * Hash a plain-text password.
 * Used in the staff-signup Edge Function (and optionally in the React app before calling the edge function).
 */
export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

/**
 * Compare a plain-text password against a bcrypt hash.
 */
export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

// ── JWT helpers (for staff custom session) ─────────────────
// The staff session token is created by the staff-login Edge Function
// and stored in localStorage as a plain JSON object (not a real JWT in Phase 1).
// Phase 2 will upgrade this to a proper signed JWT.

const STAFF_SESSION_KEY = 'pm_staff_session'

export function saveStaffSession(session) {
  localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session))
}

export function getStaffSession() {
  const raw = localStorage.getItem(STAFF_SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearStaffSession() {
  localStorage.removeItem(STAFF_SESSION_KEY)
}
