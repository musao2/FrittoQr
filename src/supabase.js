import { createClient } from '@supabase/supabase-js'

export const config = {
  url:        import.meta.env.VITE_SUPABASE_URL,
  anonKey:    import.meta.env.VITE_SUPABASE_ANON_KEY,
  // "auto" — kompyuterning hozirgi Wi-Fi manzili (vite.config.js da aniqlanadi)
  userAppUrl: (
    !import.meta.env.VITE_USER_APP_URL || import.meta.env.VITE_USER_APP_URL === 'auto'
      // eslint-disable-next-line no-undef
      ? __LAN_USER_APP_URL__
      : import.meta.env.VITE_USER_APP_URL
  ).replace(/\/$/, ''),
}

export const isConfigured = Boolean(config.url && config.anonKey && config.userAppUrl)

// Kiosk Supabase'ga oddiy foydalanuvchi sifatida kirmaydi —
// email/parol bilan o'z sessiya kodini oladi va shu bilan server funksiyalarini chaqiradi
export const supabase = isConfigured
  ? createClient(config.url, config.anonKey, { auth: { persistSession: false } })
  : null

// ─── Kirish ma'lumotini shu qurilmada eslab qolish ───────────────────────
const KEY = 'fritto_kiosk_session'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Saqlangan kirish ma'lumoti buzilgan bo'lsa — o'chirib, qayta kirishni so'raymiz
export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY))
    if (s && UUID_RE.test(s.kioskId) && /^[0-9a-f]{64}$/.test(s.token)) return s
    localStorage.removeItem(KEY)
  } catch {
    // ahamiyatsiz
  }
  return null
}
function saveSession(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ahamiyatsiz */ }
}
export function clearSession() {
  try { localStorage.removeItem(KEY) } catch { /* ahamiyatsiz */ }
}

export async function login(email, password) {
  const { data, error } = await supabase.rpc('kiosk_login', { p_email: email, p_password: password })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error || 'INVALID_LOGIN')
  const session = { kioskId: data.kiosk_id, token: data.token, name: data.kiosk_name, email }
  saveSession(session)
  return session
}

export async function logout(session) {
  try {
    await supabase.rpc('kiosk_logout', { p_kiosk_id: session.kioskId, p_token: session.token })
  } finally {
    clearSession()
  }
}

export async function issueToken(session) {
  const { data, error } = await supabase.rpc('kiosk_issue_token', {
    p_kiosk_id: session.kioskId,
    p_secret: session.token,
  })
  if (error) throw error
  return data[0] // { qr_token, valid_until }
}

export async function getRecent(session) {
  const { data, error } = await supabase.rpc('kiosk_recent', {
    p_kiosk_id: session.kioskId,
    p_secret: session.token,
  })
  if (error) throw error
  return data || []
}
