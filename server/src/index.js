import dotenv from 'dotenv'
import os from 'os'
import app from './app.js'
import { assertSupabaseConfigured } from './lib/supabase.js'

dotenv.config()

const getLocalIP = () => {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return 'localhost'
}

const LOCAL_IP = getLocalIP()
const PORT = process.env.PORT || 3001

try {
  assertSupabaseConfigured()
  app.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Supabase configurado')
    console.log(`🚀 API local en puerto ${PORT}`)
    console.log(`📱 Cliente: http://${LOCAL_IP}:5173`)
    console.log(`💻 Cliente: http://localhost:5173`)
    console.log(`🔌 API: http://${LOCAL_IP}:${PORT}/api`)
  })
} catch (error) {
  console.error('❌', error.message)
  console.error('Copia SUPABASE_SERVICE_ROLE_KEY en server/.env')
  process.exit(1)
}
