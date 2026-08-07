import { supabaseAdmin, isSupabaseConfigured } from '../lib/supabase.js'

const supabaseUrl = process.env.SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/**
 * Push a chat receipt to the sender's private Realtime channel via HTTP.
 * Topic must match client: supabase.channel(`receipts:${userId}`)
 */
export async function broadcastChatReceipt(toUserId, payload) {
  if (!toUserId || !isSupabaseConfigured() || !supabaseUrl || !serviceRoleKey) return

  const body = {
    to: String(toUserId),
    from: String(payload.from || ''),
    delivered: Boolean(payload.delivered || payload.read),
    read: Boolean(payload.read),
    messageIds: (payload.messageIds || []).map(String)
  }

  const topic = `receipts:${toUserId}`
  const base = supabaseUrl.replace(/\/$/, '')
  const headers = {
    'Content-Type': 'application/json',
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  }

  // 1) Preferred single-topic REST path
  try {
    const encodedTopic = encodeURIComponent(topic)
    const res = await fetch(`${base}/realtime/v1/api/broadcast/${encodedTopic}/events/receipt`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    if (res.ok || res.status === 202) return
    const errText = await res.text().catch(() => '')
    console.warn('broadcastChatReceipt path', res.status, errText.slice(0, 180))
  } catch (err) {
    console.warn('broadcastChatReceipt path failed:', err?.message || err)
  }

  // 2) Batch endpoint
  try {
    const res = await fetch(`${base}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [
          {
            topic,
            event: 'receipt',
            payload: body,
            private: false
          }
        ]
      })
    })
    if (res.ok || res.status === 202) return
    const errText = await res.text().catch(() => '')
    console.warn('broadcastChatReceipt batch', res.status, errText.slice(0, 180))
  } catch (err) {
    console.warn('broadcastChatReceipt batch failed:', err?.message || err)
  }

  // 3) Short-lived socket channel (dev / last resort)
  try {
    await broadcastViaSocketFallback(topic, body)
  } catch (err) {
    console.warn('broadcastChatReceipt socket failed:', err?.message || err)
  }
}

async function broadcastViaSocketFallback(channelName, body) {
  const channel = supabaseAdmin.channel(channelName, {
    config: { broadcast: { ack: false } }
  })
  await new Promise((resolve) => {
    const t = setTimeout(resolve, 1200)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(t)
        resolve(status)
      }
    })
  })
  await channel.send({
    type: 'broadcast',
    event: 'receipt',
    payload: body
  })
  await supabaseAdmin.removeChannel(channel)
}
