import { supabase } from '../lib/supabase'

const PENDING_KEY = 'pendingGoogleRegistration'

export function getGoogleRedirectTo({ link = false } = {}) {
  const url = new URL(`${window.location.origin}/auth/callback`)
  if (link) url.searchParams.set('link', '1')
  return url.toString()
}

export async function startGoogleOAuth({ link = false } = {}) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getGoogleRedirectTo({ link }),
      queryParams: {
        access_type: 'offline',
        prompt: link ? 'consent' : 'select_account'
      }
    }
  })
  if (error) throw error
  return data
}

export async function startGoogleLink() {
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo: getGoogleRedirectTo({ link: true })
    }
  })
  if (error) throw error
  return data
}

export function savePendingGoogleRegistration({ email, name, avatar } = {}) {
  try {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        email: (email || '').toLowerCase(),
        name: name || '',
        avatar: avatar || null,
        at: Date.now()
      })
    )
  } catch {
    /* ignore */
  }
}

export function readPendingGoogleRegistration() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // 30 minutes
    if (parsed?.at && Date.now() - parsed.at > 30 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPendingGoogleRegistration() {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignore */
  }
}

export async function getGoogleLinkedStatus() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()
  if (error || !user) return { linked: false, email: null }
  const linked = (user.identities || []).some((i) => i.provider === 'google')
  return { linked, email: user.email || null }
}
