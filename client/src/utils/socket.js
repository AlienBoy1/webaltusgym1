import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

let socket = null
let initialized = false

export const initSocket = (userId) => {
  if (initialized && socket?.connected) return socket
  
  if (socket) {
    socket.disconnect()
  }
  
  socket = io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    transports: ['websocket', 'polling']
  })
  
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id)
    if (userId) {
      socket.emit('join', userId)
    }
    initialized = true
  })
  
  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
  })
  
  socket.on('connect_error', (error) => {
    console.log('Socket connection error:', error.message)
  })
  
  return socket
}

export const getSocket = () => socket

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    initialized = false
  }
}

// Request notification permission
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications')
    return false
  }
  
  if (Notification.permission === 'granted') {
    return true
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  
  return false
}

// Show notification
export const showNotification = (title, body, options = {}) => {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: options.tag || 'altus-notification',
      requireInteraction: false,
      ...options
    })
    
    notification.onclick = () => {
      window.focus()
      notification.close()
      if (options.onClick) options.onClick()
    }
    
    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000)
    
    return notification
  }
  return null
}

export default { initSocket, getSocket, disconnectSocket, requestNotificationPermission, showNotification }
