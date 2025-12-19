import express from 'express'
import Message from '../models/Message.js'
import User from '../models/User.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

// Get conversations
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const userId = req.user._id
    
    // Get all messages where user is sender or receiver
    const messages = await Message.find({
      $or: [{ from: userId }, { to: userId }]
    }).sort({ createdAt: -1 })
    
    // Group by conversation partner
    const conversationMap = new Map()
    
    for (const msg of messages) {
      const partnerId = msg.from.toString() === userId.toString() ? msg.to : msg.from
      const partnerIdStr = partnerId.toString()
      
      if (!conversationMap.has(partnerIdStr)) {
        conversationMap.set(partnerIdStr, {
          oderId: partnerIdStr,
          lastMessage: msg.content,
          lastMessageTime: msg.createdAt,
          unread: msg.to.toString() === userId.toString() && !msg.read ? 1 : 0
        })
      } else if (msg.to.toString() === userId.toString() && !msg.read) {
        conversationMap.get(partnerIdStr).unread++
      }
    }
    
    // Get user details for each conversation
    const conversations = []
    for (const [oderId, conv] of conversationMap) {
      const user = await User.findById(oderId).select('name avatar')
      if (user) {
        conversations.push({
          id: oderId,
          oderId,
          name: user.name,
          avatar: user.avatar || user.name?.charAt(0) || '👤',
          lastMessage: conv.lastMessage,
          time: conv.lastMessageTime,
          unread: conv.unread
        })
      }
    }
    
    res.json(conversations)
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// Get messages with a specific user
router.get('/messages/:userId', authenticate, async (req, res) => {
  try {
    const myId = req.user._id
    const oderId = req.params.userId
    
    const messages = await Message.find({
      $or: [
        { from: myId, to: oderId },
        { from: oderId, to: myId }
      ]
    }).sort({ createdAt: 1 })
    
    // Mark messages as read
    await Message.updateMany(
      { from: oderId, to: myId, read: false },
      { read: true }
    )
    
    const formatted = messages.map(m => ({
      id: m._id,
      sender: m.from.toString() === myId.toString() ? 'me' : 'other',
      text: m.content,
      time: new Date(m.createdAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    }))
    
    res.json(formatted)
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// Send message (REST fallback)
router.post('/send', authenticate, async (req, res) => {
  try {
    const { to, content } = req.body
    
    const message = new Message({
      from: req.user._id,
      to,
      content
    })
    
    await message.save()
    
    res.status(201).json({
      id: message._id,
      sender: 'me',
      text: content,
      time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

export default router
