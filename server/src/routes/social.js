import express from 'express'
import Post from '../models/Post.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

// Get feed (posts from users you follow)
router.get('/feed', authenticate, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id)
    const followingIds = currentUser.social?.following || []
    
    // Get posts from users you follow, or all if no following
    const query = followingIds.length > 0 
      ? { user: { $in: followingIds } }
      : {}
    
    const posts = await Post.find(query)
      .populate('user', 'name avatar stats')
      .populate('sharedFrom', 'user content images')
      .populate('sharedFrom.user', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(50)
    
    res.json(posts)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener feed', error: error.message })
  }
})

// Get user posts (for profile view)
router.get('/user/:userId/posts', authenticate, async (req, res) => {
  try {
    const posts = await Post.find({ user: req.params.userId })
      .populate('user', 'name avatar stats')
      .populate('sharedFrom', 'user content images')
      .populate('sharedFrom.user', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(50)
    
    res.json(posts)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener publicaciones', error: error.message })
  }
})

// Create post
router.post('/', authenticate, async (req, res) => {
  try {
    const { content, images, mood, poll, postType, badgeData } = req.body
    
    // Determine post type
    let finalPostType = postType || 'text'
    if (badgeData) {
      finalPostType = 'badge'
    } else if (images && images.length > 0 && content) {
      finalPostType = 'mixed'
    } else if (images && images.length > 0) {
      finalPostType = 'image'
    } else if (poll) {
      finalPostType = 'poll'
    } else if (mood) {
      finalPostType = 'mood'
    }
    
    const post = new Post({
      user: req.user._id,
      content: content || '',
      images: images || [],
      mood: mood || null,
      poll: poll ? {
        question: poll.question,
        options: poll.options.map(opt => ({ text: opt, votes: [] })),
        endsAt: poll.endsAt ? new Date(poll.endsAt) : null
      } : null,
      badgeData: badgeData || null,
      postType: finalPostType
    })
    
    await post.save()
    await post.populate('user', 'name avatar stats')
    
    // Update user social interactions count
    const user = await User.findById(req.user._id)
    if (user) {
      user.stats = user.stats || {}
      user.stats.socialInteractions = (user.stats.socialInteractions || 0) + 1
      await user.save()
      
      // Check for badge unlocks
      const { checkBadgeUnlocks } = await import('../services/xpService.js')
      await checkBadgeUnlocks(req.user._id, true) // Skip XP badges to prevent loops
    }
    
    res.status(201).json(post)
  } catch (error) {
    res.status(500).json({ message: 'Error al crear publicación', error: error.message })
  }
})

// Vote on poll
router.post('/:id/poll/vote', authenticate, async (req, res) => {
  try {
    const { optionIndex } = req.body
    const post = await Post.findById(req.params.id)
    
    if (!post || !post.poll) {
      return res.status(404).json({ message: 'Encuesta no encontrada' })
    }
    
    // Remove user from all options first
    post.poll.options.forEach(option => {
      option.votes = option.votes.filter(v => v.toString() !== req.user._id.toString())
    })
    
    // Add vote to selected option
    if (post.poll.options[optionIndex]) {
      post.poll.options[optionIndex].votes.push(req.user._id)
    }
    
    await post.save()
    res.json(post.poll)
  } catch (error) {
    res.status(500).json({ message: 'Error al votar', error: error.message })
  }
})

// Like/Unlike post
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
    
    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada' })
    }
    
    const userIndex = post.likes.indexOf(req.user._id)
    const liked = userIndex === -1
    
    if (liked) {
      post.likes.push(req.user._id)
    } else {
      post.likes.splice(userIndex, 1)
    }
    
    await post.save()
    
    res.json({ liked, likesCount: post.likes.length })
  } catch (error) {
    res.status(500).json({ message: 'Error al dar like', error: error.message })
  }
})

// Comment on post
router.post('/:id/comment', authenticate, async (req, res) => {
  try {
    const { content } = req.body
    
    const post = await Post.findById(req.params.id)
    
    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada' })
    }
    
    post.comments.push({
      user: req.user._id,
      content,
      createdAt: new Date()
    })
    
    await post.save()
    await post.populate('comments.user', 'name avatar')
    
    // Update user social interactions count
    const user = await User.findById(req.user._id)
    if (user) {
      user.stats = user.stats || {}
      user.stats.socialInteractions = (user.stats.socialInteractions || 0) + 1
      await user.save()
      
      // Check for badge unlocks
      const { checkBadgeUnlocks } = await import('../services/xpService.js')
      await checkBadgeUnlocks(req.user._id, true) // Skip XP badges
    }
    
    res.json(post.comments)
  } catch (error) {
    res.status(500).json({ message: 'Error al comentar', error: error.message })
  }
})

// Share post
router.post('/:id/share', authenticate, async (req, res) => {
  try {
    const { content } = req.body
    const originalPost = await Post.findById(req.params.id)
      .populate('user', 'name avatar')
    
    if (!originalPost) {
      return res.status(404).json({ message: 'Publicación no encontrada' })
    }
    
    const sharedPost = new Post({
      user: req.user._id,
      content: content || `Compartido de ${originalPost.user?.name || 'usuario'}`,
      images: originalPost.images || [],
      sharedFrom: originalPost._id,
      postType: 'mixed'
    })
    
    await sharedPost.save()
    await sharedPost.populate('user', 'name avatar stats')
    await sharedPost.populate('sharedFrom', 'user content images')
    await sharedPost.populate('sharedFrom.user', 'name avatar')
    
    // Update user social interactions count
    const user = await User.findById(req.user._id)
    if (user) {
      user.stats = user.stats || {}
      user.stats.socialInteractions = (user.stats.socialInteractions || 0) + 1
      await user.save()
      
      // Check for badge unlocks
      const { checkBadgeUnlocks } = await import('../services/xpService.js')
      await checkBadgeUnlocks(req.user._id, true) // Skip XP badges
    }
    
    res.status(201).json(sharedPost)
  } catch (error) {
    res.status(500).json({ message: 'Error al compartir publicación', error: error.message })
  }
})

// Request to follow user
router.post('/:id/follow', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.id
    const currentUserId = req.user._id
    
    if (targetUserId === currentUserId.toString()) {
      return res.status(400).json({ message: 'No puedes seguirte a ti mismo' })
    }
    
    const targetUser = await User.findById(targetUserId)
    const currentUser = await User.findById(currentUserId)
    
    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }
    
    // Check if already following
    const isFollowing = targetUser.social?.followers?.some(f => f.toString() === currentUserId.toString())
    if (isFollowing) {
      return res.status(400).json({ message: 'Ya sigues a este usuario' })
    }
    
    // Check if request already pending
    const hasPendingRequest = targetUser.social?.followRequests?.some(
      req => req.user.toString() === currentUserId.toString()
    )
    if (hasPendingRequest) {
      return res.status(400).json({ message: 'Ya hay una solicitud pendiente' })
    }
    
    // Add to pending requests
    if (!targetUser.social) {
      targetUser.social = { followers: [], following: [], followRequests: [], pendingRequests: [] }
    }
    
    targetUser.social.followRequests.push({
      user: currentUserId,
      requestedAt: new Date()
    })
    
    if (!currentUser.social) {
      currentUser.social = { followers: [], following: [], followRequests: [], pendingRequests: [] }
    }
    
    currentUser.social.pendingRequests.push(targetUserId)
    
    await targetUser.save()
    await currentUser.save()
    
    // Create notification
    await Notification.create({
      user: targetUserId,
      type: 'follow_request',
      title: 'Nueva solicitud de seguimiento',
      body: `${currentUser.name} quiere seguirte`,
      icon: '👤',
      relatedUser: currentUserId,
      priority: 'normal'
    })
    
    res.json({ 
      message: 'Solicitud enviada',
      status: 'pending'
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al enviar solicitud', error: error.message })
  }
})

// Accept follow request
router.post('/:id/accept-follow', authenticate, async (req, res) => {
  try {
    const requesterId = req.params.id
    const currentUserId = req.user._id
    
    const currentUser = await User.findById(currentUserId)
    const requester = await User.findById(requesterId)
    
    if (!requester) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }
    
    // Remove from follow requests
    if (currentUser.social?.followRequests) {
      currentUser.social.followRequests = currentUser.social.followRequests.filter(
        req => req.user.toString() !== requesterId
      )
    }
    
    // Add to followers
    if (!currentUser.social) {
      currentUser.social = { followers: [], following: [], followRequests: [], pendingRequests: [] }
    }
    if (!currentUser.social.followers.includes(requesterId)) {
      currentUser.social.followers.push(requesterId)
    }
    
    // Add to requester's following
    if (!requester.social) {
      requester.social = { followers: [], following: [], followRequests: [], pendingRequests: [] }
    }
    if (!requester.social.following.includes(currentUserId)) {
      requester.social.following.push(currentUserId)
    }
    
    // Remove from requester's pending requests
    if (requester.social.pendingRequests) {
      requester.social.pendingRequests = requester.social.pendingRequests.filter(
        id => id.toString() !== currentUserId.toString()
      )
    }
    
    await currentUser.save()
    await requester.save()
    
    // Create notification
    await Notification.create({
      user: requesterId,
      type: 'follow_accepted',
      title: 'Solicitud aceptada',
      body: `${currentUser.name} aceptó tu solicitud de seguimiento`,
      icon: '✅',
      relatedUser: currentUserId,
      priority: 'normal'
    })
    
    res.json({ message: 'Solicitud aceptada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al aceptar solicitud', error: error.message })
  }
})

// Reject follow request
router.post('/:id/reject-follow', authenticate, async (req, res) => {
  try {
    const requesterId = req.params.id
    const currentUserId = req.user._id
    
    const currentUser = await User.findById(currentUserId)
    const requester = await User.findById(requesterId)
    
    if (!requester) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }
    
    // Remove from follow requests
    if (currentUser.social?.followRequests) {
      currentUser.social.followRequests = currentUser.social.followRequests.filter(
        req => req.user.toString() !== requesterId
      )
    }
    
    // Remove from requester's pending requests
    if (requester.social?.pendingRequests) {
      requester.social.pendingRequests = requester.social.pendingRequests.filter(
        id => id.toString() !== currentUserId.toString()
      )
    }
    
    await currentUser.save()
    await requester.save()
    
    res.json({ message: 'Solicitud rechazada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al rechazar solicitud', error: error.message })
  }
})

// Unfollow user
router.post('/:id/unfollow', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.id
    const currentUserId = req.user._id
    
    const targetUser = await User.findById(targetUserId)
    const currentUser = await User.findById(currentUserId)
    
    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }
    
    // Remove from target's followers
    if (targetUser.social?.followers) {
      targetUser.social.followers = targetUser.social.followers.filter(
        f => f.toString() !== currentUserId.toString()
      )
    }
    
    // Remove from current user's following
    if (currentUser.social?.following) {
      currentUser.social.following = currentUser.social.following.filter(
        f => f.toString() !== targetUserId
      )
    }
    
    await targetUser.save()
    await currentUser.save()
    
    res.json({ message: 'Dejaste de seguir a este usuario' })
  } catch (error) {
    res.status(500).json({ message: 'Error al dejar de seguir', error: error.message })
  }
})

// Get follow requests
router.get('/follow-requests', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('social.followRequests.user', 'name avatar email')
    
    const requests = user.social?.followRequests || []
    res.json(requests)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener solicitudes', error: error.message })
  }
})

// Get following list
router.get('/following', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('social.following', 'name avatar email stats')
    
    res.json(user.social?.following || [])
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener seguidos', error: error.message })
  }
})

// Get followers list
router.get('/followers', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('social.followers', 'name avatar email stats')
    
    res.json(user.social?.followers || [])
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener seguidores', error: error.message })
  }
})

// Get follow status
router.get('/:id/follow-status', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.id
    const currentUser = await User.findById(req.user._id)
    const targetUser = await User.findById(targetUserId)
    
    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }
    
    const isFollowing = targetUser.social?.followers?.some(
      f => f.toString() === req.user._id.toString()
    )
    
    const hasPendingRequest = targetUser.social?.followRequests?.some(
      req => req.user.toString() === req.user._id.toString()
    )
    
    res.json({
      isFollowing,
      hasPendingRequest,
      followersCount: targetUser.social?.followers?.length || 0,
      followingCount: targetUser.social?.following?.length || 0
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estado', error: error.message })
  }
})

// Delete post
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, user: req.user._id })
    
    if (!post) {
      return res.status(404).json({ message: 'Publicación no encontrada o no tienes permiso' })
    }
    
    await post.deleteOne()
    res.json({ message: 'Publicación eliminada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar', error: error.message })
  }
})

export default router
