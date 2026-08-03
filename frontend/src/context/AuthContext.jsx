import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // "checking" until we know whether the stored token is still good, so the
  // app doesn't flash the login screen for an already-signed-in user.
  const [checking, setChecking] = useState(Boolean(getToken()))

  const signOut = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  // The fetch layer calls this when the API rejects a token mid-session.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    if (!getToken()) {
      setChecking(false)
      return
    }

    let cancelled = false
    api
      .me()
      .then((profile) => !cancelled && setUser(profile))
      // A stored token that's expired or belongs to a deleted account: the
      // request interceptor has already cleared it.
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setChecking(false))

    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    const result = await api.login(email, password)
    setToken(result.access_token)
    setUser(result.user)
    return result.user
  }, [])

  const value = useMemo(
    () => ({
      user,
      checking,
      signIn,
      signOut,
      isAuthenticated: Boolean(user),
      // Everything a viewer must not be able to do is gated on this. The
      // backend enforces it too — this only keeps the UI honest.
      isAdmin: user?.role === 'admin',
    }),
    [user, checking, signIn, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
