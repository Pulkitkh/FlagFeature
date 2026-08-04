export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TOKEN_KEY = 'flagforge:token'

// Set once at sign-in and read on every request. Kept here rather than passed
// through every call site, so no request can accidentally go out unsigned.
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Private browsing: the session just won't survive a reload.
  }
}

// Called when the API rejects our token, so the app can bounce to the login
// screen from inside the fetch layer without importing React here.
let onUnauthorized = null
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, options = {}) {
  const token = getToken()
  let res
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
  } catch {
    // fetch only rejects on a network-level failure, which deserves a clearer
    // message than "Failed to fetch".
    throw new ApiError(`Can't reach the API at ${API_BASE_URL}. Is the backend running?`, 0)
  }

  if (!res.ok) {
    // An expired or revoked token: drop it and let the app show the login
    // screen rather than leaving every page stuck on an error.
    if (res.status === 401 && !path.startsWith('/auth/login')) {
      setToken(null)
      onUnauthorized?.()
    }

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
      // response had no JSON body
    }
    throw new ApiError(detail, res.status)
  }

  if (res.status === 204) return null
  return res.json()
}

function queryString(params) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.set(key, value)
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const api = {
  health: () => request('/health'),

  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  changeOwnPassword: (currentPassword, newPassword) =>
    request('/auth/me/password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
  listAccounts: () => request('/auth/users'),
  createAccount: (payload) =>
    request('/auth/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateAccount: (id, payload) =>
    request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

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

  // URLSearchParams encodes the "+" in an ISO offset, which would otherwise
  // arrive as a space and fail validation.
  getAuditLog: (filters = {}) => request(`/audit-log${queryString({ limit: 100, ...filters })}`),
  getAuditActors: () => request('/audit-log/actors'),

  getFlagAnalytics: (key, { days = 7, environmentKey } = {}) =>
    request(
      `/flags/${encodeURIComponent(key)}/analytics${queryString({
        days,
        environment_key: environmentKey,
      })}`
    ),

  getCleanupSuggestions: ({ staleDays = 30, includeReviewed = false } = {}) =>
    request(
      `/cleanup/suggestions${queryString({
        stale_days: staleDays,
        include_reviewed: includeReviewed ? 'true' : '',
      })}`
    ),
  reviewFlagCleanup: (key, note = '') =>
    request(`/cleanup/${encodeURIComponent(key)}/review`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  unreviewFlagCleanup: (key) =>
    request(`/cleanup/${encodeURIComponent(key)}/review`, { method: 'DELETE' }),

  getSnapshot: (envKey) => request(`/snapshot/${encodeURIComponent(envKey)}`),
}
