const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    // fetch only rejects on a network-level failure, which is worth naming
    // explicitly — "Failed to fetch" tells a user nothing.
    throw new ApiError(`Can't reach the API at ${API_BASE_URL}. Is the backend running?`, 0)
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') {
        detail = body.detail
      } else if (Array.isArray(body.detail)) {
        // FastAPI validation errors arrive as a list of {loc, msg}.
        detail = body.detail
          .map((issue) => `${issue.loc?.slice(1).join('.') || 'request'}: ${issue.msg}`)
          .join(', ')
      }
    } catch {
      // Response had no JSON body; the status text stands.
    }
    throw new ApiError(detail, res.status)
  }

  if (res.status === 204) return null
  return res.json()
}

const encode = encodeURIComponent

export const api = {
  health: () => request('/health'),
  getOverview: (environmentKey) =>
    request(`/overview${environmentKey ? `?environment_key=${encode(environmentKey)}` : ''}`),

  listEnvironments: () => request('/environments'),
  createEnvironment: (payload) =>
    request('/environments', { method: 'POST', body: JSON.stringify(payload) }),
  updateEnvironment: (key, payload) =>
    request(`/environments/${encode(key)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  listEnvironmentGroups: (key) => request(`/environments/${encode(key)}/groups`),
  listUserGroups: (key) => request(`/environments/${encode(key)}/user-groups`),
  upsertUserGroup: (key, payload) =>
    request(`/environments/${encode(key)}/user-groups`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteUserGroupMember: (key, groupKey, userId) =>
    request(`/environments/${encode(key)}/user-groups/${encode(groupKey)}/${encode(userId)}`, {
      method: 'DELETE',
    }),

  listFlags: () => request('/flags'),
  getFlag: (key) => request(`/flags/${encode(key)}`),
  createFlag: (payload) => request('/flags', { method: 'POST', body: JSON.stringify(payload) }),
  updateFlag: (key, payload) =>
    request(`/flags/${encode(key)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteFlag: (key) => request(`/flags/${encode(key)}`, { method: 'DELETE' }),
  getFlagVersions: (key) => request(`/flags/${encode(key)}/versions`),

  setEnvironmentOverride: (key, envKey, payload) =>
    request(`/flags/${encode(key)}/environments/${encode(envKey)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getTargetingRules: (key, envKey) =>
    request(`/flags/${encode(key)}/targeting/${encode(envKey)}`),
  setTargetingRules: (key, envKey, payload) =>
    request(`/flags/${encode(key)}/targeting/${encode(envKey)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  evaluateFlag: (payload) => request('/evaluate', { method: 'POST', body: JSON.stringify(payload) }),

  getAuditLog: (limit = 100) => request(`/audit-log?limit=${limit}`),
}
