import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl) {
  console.warn('⚠️ SUPABASE_URL no configurada')
}

if (!serviceRoleKey) {
  console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY no configurada — operaciones admin fallarán bajo RLS')
}

/**
 * Admin client — must always use the service role key and never hold a user session.
 * Used only on the server to bypass RLS.
 */
export const supabaseAdmin = createClient(supabaseUrl || '', serviceRoleKey || '', {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: serviceRoleKey
    ? { headers: { Authorization: `Bearer ${serviceRoleKey}` } }
    : undefined
})

/**
 * Ephemeral auth client for signInWithPassword / user-scoped auth flows.
 * Never reuse supabaseAdmin for password sign-in — it contaminates the
 * shared admin client with a user JWT (breaks RLS-denied admin reads on Vercel).
 */
export function createAuthClient() {
  return createClient(supabaseUrl || '', anonKey || serviceRoleKey || '', {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/** Client scoped to a user JWT (respects RLS). */
export function supabaseAsUser(accessToken) {
  return createClient(supabaseUrl || '', anonKey || '', {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && serviceRoleKey)
}

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase no configurado. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en server/.env'
    )
  }
}

export default supabaseAdmin
