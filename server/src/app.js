import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import workoutRoutes from './routes/workouts.js'
import socialRoutes from './routes/social.js'
import adminRoutes from './routes/admin.js'
import notificationRoutes from './routes/notifications.js'
import chatRoutes from './routes/chat.js'
import classRoutes from './routes/classes.js'
import challengeRoutes from './routes/challenges.js'
import storyRoutes from './routes/stories.js'
import noteRoutes from './routes/notes.js'
import qisiRoutes from './routes/qisi.js'
import bodyRoutes from './routes/body.js'
import { isSupabaseConfigured } from './lib/supabase.js'
import { ensureQiSiSystem } from './services/qisiService.js'

dotenv.config()

const app = express()

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.CLIENT_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null
].filter(Boolean)

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin browser calls / non-browser (no Origin) OK
      if (!origin) return cb(null, true)
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        process.env.NODE_ENV !== 'production'
      ) {
        return cb(null, true)
      }
      return cb(null, true) // SPA + API same project; allow
    },
    credentials: true
  })
)
app.use(express.json({ limit: '8mb' }))
app.use(express.urlencoded({ extended: true, limit: '8mb' }))

app.use((req, res, next) => {
  if (!isSupabaseConfigured() && !req.path.endsWith('/health')) {
    return res.status(503).json({
      message:
        'Supabase no configurado. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Vercel.'
    })
  }
  next()
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/workouts', workoutRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/classes', classRoutes)
app.use('/api/challenges', challengeRoutes)
app.use('/api/stories', storyRoutes)
app.use('/api/notes', noteRoutes)
app.use('/api/qisi', qisiRoutes)
app.use('/api/body', bodyRoutes)

// Warm QiSi system user + launch story (non-blocking)
if (isSupabaseConfigured()) {
  setTimeout(() => {
    ensureQiSiSystem().catch((err) => {
      console.warn('QiSi warm-up:', err?.message || err)
    })
  }, 1500)
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    db: 'supabase',
    host: 'vercel',
    supabase: isSupabaseConfigured(),
    timestamp: new Date().toISOString()
  })
})

export default app
