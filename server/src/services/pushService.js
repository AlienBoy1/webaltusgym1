import webpush from 'web-push'
import User from '../models/User.js'
import Notification from '../models/Notification.js'

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls'

webpush.setVapidDetails(
  'mailto:admin@altusgym.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

export async function sendPushNotification(userId, notification) {
  try {
    const user = await User.findById(userId)
    
    if (!user?.pushSubscription) {
      console.log('Usuario sin suscripción push:', userId)
      return false
    }
    
    if (!user.settings?.notifications?.push) {
      console.log('Usuario tiene push desactivado:', userId)
      return false
    }
    
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: notification.data || {},
      actions: notification.actions || []
    })
    
    await webpush.sendNotification(user.pushSubscription, payload)
    
    // Update notification as pushed
    if (notification._id) {
      await Notification.findByIdAndUpdate(notification._id, {
        pushed: true,
        pushedAt: new Date()
      })
    }
    
    return true
  } catch (error) {
    console.error('Error enviando push notification:', error.message)
    
    // If subscription is invalid, remove it
    if (error.statusCode === 410 || error.statusCode === 404) {
      await User.findByIdAndUpdate(userId, { pushSubscription: null })
    }
    
    return false
  }
}

export async function sendPushToMany(userIds, notification) {
  const results = {
    sent: 0,
    failed: 0
  }
  
  for (const userId of userIds) {
    const success = await sendPushNotification(userId, notification)
    if (success) {
      results.sent++
    } else {
      results.failed++
    }
  }
  
  return results
}

export async function sendPushToAll(notification) {
  const users = await User.find({ 
    pushSubscription: { $ne: null },
    'settings.notifications.push': true
  })
  
  return sendPushToMany(users.map(u => u._id), notification)
}

// Scheduled notification helpers
export async function sendWorkoutReminders() {
  const users = await User.find({
    'settings.notifications.workoutReminders': true,
    pushSubscription: { $ne: null }
  })
  
  for (const user of users) {
    await Notification.create({
      user: user._id,
      type: 'workout_reminder',
      title: '💪 ¡Hora de entrenar!',
      body: 'No olvides tu entrenamiento de hoy. ¡Tú puedes!',
      icon: '💪'
    })
    
    await sendPushNotification(user._id, {
      title: '💪 ¡Hora de entrenar!',
      body: 'No olvides tu entrenamiento de hoy. ¡Tú puedes!'
    })
  }
}

export async function sendMembershipExpiringAlerts() {
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
  
  const users = await User.find({
    'membership.endDate': { $lte: sevenDaysFromNow, $gte: new Date() },
    'membership.status': 'active',
    'settings.notifications.membershipAlerts': true
  })
  
  for (const user of users) {
    const daysLeft = Math.ceil((user.membership.endDate - new Date()) / (1000 * 60 * 60 * 24))
    
    user.membership.status = 'expiring'
    await user.save()
    
    await Notification.create({
      user: user._id,
      type: 'membership_expiring',
      title: '⚠️ Tu membresía está por vencer',
      body: `Te quedan ${daysLeft} días. ¡Renueva para seguir entrenando!`,
      icon: '⚠️',
      priority: 'high'
    })
    
    await sendPushNotification(user._id, {
      title: '⚠️ Tu membresía está por vencer',
      body: `Te quedan ${daysLeft} días. ¡Renueva para seguir entrenando!`
    })
  }
}

export default {
  sendPushNotification,
  sendPushToMany,
  sendPushToAll,
  sendWorkoutReminders,
  sendMembershipExpiringAlerts
}

