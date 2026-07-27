import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'

const EnvironmentContext = createContext(null)
const STORAGE_KEY = 'flagforge:selectedEnv'

const DEFAULT_ENVIRONMENTS = [
  { key: 'development', name: 'Development' },
  { key: 'staging', name: 'Staging' },
  { key: 'production', name: 'Production' },
]

export function EnvironmentProvider({ children }) {
  const [environments, setEnvironments] = useState([])
  const [selectedKey, setSelectedKey] = useState(
    () => localStorage.getItem(STORAGE_KEY) || 'development'
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // A ref rather than state: seeding must not be part of the callback's
  // identity, or the effect that calls it re-runs and seeds twice.
  const seeding = useRef(false)

  const loadEnvironments = useCallback(async () => {
    setLoading(true)
    try {
      let envs = await api.listEnvironments()

      if (envs.length === 0 && !seeding.current) {
        // First run: create the standard three so the switcher isn't empty on a
        // brand-new backend.
        seeding.current = true
        try {
          await Promise.all(
            DEFAULT_ENVIRONMENTS.map((env) => api.createEnvironment(env).catch(() => null))
          )
          envs = await api.listEnvironments()
        } finally {
          seeding.current = false
        }
      }

      setEnvironments(envs)
      setError(null)
    } catch (err) {
      // Previously this failed silently and every page just rendered empty.
      setEnvironments([])
      setError(err.message || 'Could not reach the API.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEnvironments()
  }, [loadEnvironments])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, selectedKey)
  }, [selectedKey])

  const selected = environments.find((env) => env.key === selectedKey) || environments[0]

  const value = useMemo(
    () => ({
      environments,
      selected,
      selectedKey: selected?.key || selectedKey,
      setSelectedKey,
      loading,
      error,
      refresh: loadEnvironments,
    }),
    [environments, selected, selectedKey, loading, error, loadEnvironments]
  )

  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>
}

export function useEnvironment() {
  const ctx = useContext(EnvironmentContext)
  if (!ctx) throw new Error('useEnvironment must be used within an EnvironmentProvider')
  return ctx
}
