import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl) {
  console.warn('⚠️ SUPABASE_URL no configurada')
}

/** Admin client — bypasses RLS. Use only on the server. */
export const supabaseAdmin = createClient(
  supabaseUrl || '',
  serviceRoleKey || anonKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

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
