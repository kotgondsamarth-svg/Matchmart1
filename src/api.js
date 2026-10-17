const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export function getToken() { return localStorage.getItem('matchmart_token') }
export function setSession(token, user) {
  localStorage.setItem('matchmart_token', token)
  localStorage.setItem('matchmart_user', JSON.stringify(user))
}
export function clearSession() {
  localStorage.removeItem('matchmart_token')
  localStorage.removeItem('matchmart_user')
}
export function getUser() {
  try { return JSON.parse(localStorage.getItem('matchmart_user') || 'null') } catch { return null }
}
export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${API}${path}`, { ...options, headers })
  if (response.status === 204) return null
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.detail || 'Something went wrong')
  return body
}
