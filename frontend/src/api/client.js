const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      // response had no JSON body
    }
    throw new Error(detail)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  health: () => request('/health'),

  listEnvironments: () => request('/environments'),
  createEnvironment: (payload) =>
    request('/environments', { method: 'POST', body: JSON.stringify(payload) }),
  updateEnvironment: (key, payload) =>
    request(`/environments/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  listEnvironmentGroups: (key) => request(`/environments/${encodeURIComponent(key)}/groups`),
  listUserGroups: (key) => request(`/environments/${encodeURIComponent(key)}/user-groups`),
  upsertUserGroup: (key, payload) =>
    request(`/environments/${encodeURIComponent(key)}/user-groups`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteUserGroupMember: (key, groupKey, userId) =>
    request(
      `/environments/${encodeURIComponent(key)}/user-groups/${encodeURIComponent(groupKey)}/${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    ),

  listFlags: () => request('/flags'),
  getFlag: (key) => request(`/flags/${encodeURIComponent(key)}`),
  createFlag: (payload) => request('/flags', { method: 'POST', body: JSON.stringify(payload) }),
  updateFlag: (key, payload) =>
    request(`/flags/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteFlag: (key) => request(`/flags/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  getFlagVersions: (key) => request(`/flags/${encodeURIComponent(key)}/versions`),

  setEnvironmentOverride: (key, envKey, payload) =>
    request(`/flags/${encodeURIComponent(key)}/environments/${encodeURIComponent(envKey)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getTargetingRules: (key, envKey) =>
    request(`/flags/${encodeURIComponent(key)}/targeting/${encodeURIComponent(envKey)}`),
  setTargetingRules: (key, envKey, payload) =>
    request(`/flags/${encodeURIComponent(key)}/targeting/${encodeURIComponent(envKey)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  evaluateFlag: (payload) => request('/evaluate', { method: 'POST', body: JSON.stringify(payload) }),

  getAuditLog: (limit = 100) => request(`/audit-log?limit=${limit}`),
}
