import { createClient } from '@supabase/supabase-js'
import { setAuthTokens, isRememberMeEnabled, getStoredToken } from '../utils/tokenStorage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bmzaoaeykfmmppwrsrxn.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtemFvYWV5a2ZtbXBwd3JzcnhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxODQ4MzEsImV4cCI6MjEwMDc2MDgzMX0.CjhxdsZFoLFAgBG7hVLW_gs9TGv6aOrXBqiv2_vPoyU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

// Keep app tokenStorage in sync when Supabase rotates refresh tokens
supabase.auth.onAuthStateChange((event, session) => {
  if (!session?.access_token || !session?.refresh_token) return
  if (event !== 'TOKEN_REFRESHED' && event !== 'SIGNED_IN') return
  // Only sync if we already have an app session (avoid writing guest browser sessions)
  if (!getStoredToken() && event === 'SIGNED_IN') return
  const remember = isRememberMeEnabled() || Boolean(localStorage.getItem('token'))
  setAuthTokens(session.access_token, session.refresh_token, remember)
})

export default supabase
