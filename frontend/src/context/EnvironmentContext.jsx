import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

const EnvironmentContext = createContext(null)

const DEFAULT_ENVIRONMENTS = [
  { key: 'development', name: 'Development' },
  { key: 'staging', name: 'Staging' },
  { key: 'production', name: 'Production' },
]

export function EnvironmentProvider({ children }) {
  const [environments, setEnvironments] = useState([])
  const [selectedKey, setSelectedKey] = useState(
    () => localStorage.getItem('flagforge:selectedEnv') || 'development'
  )
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const loadEnvironments = useCallback(async () => {
    setLoading(true)
    try {
      const envs = await api.listEnvironments()
      setEnvironments(envs)

      if (envs.length === 0 && !seeding) {
        // First run: create the standard three environments automatically
        // so the switcher isn't empty on a brand-new backend.
        setSeeding(true)
        for (const env of DEFAULT_ENVIRONMENTS) {
          try {
            await api.createEnvironment(env)
          } catch {
            // ignore races / already-exists
          }
        }
        const seeded = await api.listEnvironments()
        setEnvironments(seeded)
        setSeeding(false)
      }
    } finally {
      setLoading(false)
    }
  }, [seeding])

  useEffect(() => {
    loadEnvironments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem('flagforge:selectedEnv', selectedKey)
  }, [selectedKey])

  const selected = environments.find((e) => e.key === selectedKey) || environments[0]

  return (
    <EnvironmentContext.Provider
      value={{
        environments,
        selected,
        selectedKey: selected?.key || selectedKey,
        setSelectedKey,
        loading,
        refresh: loadEnvironments,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  )
}

export function useEnvironment() {
  const ctx = useContext(EnvironmentContext)
  if (!ctx) throw new Error('useEnvironment must be used within EnvironmentProvider')
  return ctx
}
