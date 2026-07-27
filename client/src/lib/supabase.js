import { createClient } from '@supabase/supabase-js'

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

export default supabase
