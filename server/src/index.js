import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import dotenv from 'dotenv'
import http from 'http'
import { Server } from 'socket.io'
import os from 'os'

// Import routes
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import workoutRoutes from './routes/workouts.js'
import socialRoutes from './routes/social.js'
import adminRoutes from './routes/admin.js'
import notificationRoutes from './routes/notifications.js'
import chatRoutes from './routes/chat.js'
import classRoutes from './routes/classes.js'
import challengeRoutes from './routes/challenges.js'

dotenv.config()

const app = express()
const server = http.createServer(app)
// Get local IP address
const getLocalIP = () => {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return 'localhost'
}

const LOCAL_IP = getLocalIP()
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  `http://${LOCAL_IP}:5173`,
  `http://${LOCAL_IP}:5174`,
  process.env.CLIENT_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
].filter(Boolean)

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? allowedOrigins 
      : allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

const PORT = process.env.PORT || 3001
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://alien:alien@cluster0.xr01zqx.mongodb.net/altusGym?retryWrites=true&w=majority&appName=Cluster0'

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '10mb' })) // Increase limit for image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Make io accessible to routes
app.set('io', io)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/workouts', workoutRoutes)
app.use('/api/social', socialRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/classes', classRoutes)
app.use('/api/challenges', challengeRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Socket.io connection handling
const onlineUsers = new Map()

io.on('connection', (socket) => {
  console.log('User connected:', socket.id)
  
  // User joins with their ID
  socket.on('join', (userId) => {
    onlineUsers.set(userId, socket.id)
    socket.userId = userId
    console.log('User joined:', userId)
    io.emit('userOnline', userId)
  })
  
  // Send message
  socket.on('sendMessage', async (data) => {
    const { to, message, from, fromName } = data
    const recipientSocket = onlineUsers.get(to)
    
    // Save message to DB
    try {
      const Message = (await import('./models/Message.js')).default
      const newMsg = new Message({
        from: from,
        to: to,
        content: message,
        read: false
      })
      await newMsg.save()
      
      // Send to recipient if online
      if (recipientSocket) {
        io.to(recipientSocket).emit('newMessage', {
          from,
          fromName,
          message,
          timestamp: new Date()
        })
      }
      
      // Confirm to sender
      socket.emit('messageSent', { success: true, messageId: newMsg._id })
    } catch (error) {
      console.error('Error saving message:', error)
      socket.emit('messageSent', { success: false })
    }
  })
  
  // Typing indicator
  socket.on('typing', (data) => {
    const recipientSocket = onlineUsers.get(data.to)
    if (recipientSocket) {
      io.to(recipientSocket).emit('userTyping', { from: data.from })
    }
  })
  
  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId)
      io.emit('userOffline', socket.userId)
    }
    console.log('User disconnected:', socket.id)
  })
})

// Connect to MongoDB and start server
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Conectado a MongoDB Atlas - altusGym')
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
      console.log(`📱 Accede desde tu celular en: http://${LOCAL_IP}:5173`)
      console.log(`💻 Accede localmente en: http://localhost:5173`)
      console.log(`🔌 API disponible en: http://${LOCAL_IP}:${PORT}/api`)
    })
  })
  .catch((error) => {
    console.error('❌ Error de conexión a MongoDB:', error.message)
    process.exit(1)
  })
