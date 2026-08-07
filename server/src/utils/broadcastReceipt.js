import { supabaseAdmin } from '../lib/supabase.js'

/**
 * Push a chat receipt to the sender's private Realtime channel.
 * Client must subscribe to `receipts:{userId}` and listen for broadcast `receipt`.
 */
export async function broadcastChatReceipt(toUserId, payload) {
  if (!toUserId) return
  const channelName = `receipts:${toUserId}`
  try {
    const channel = supabaseAdmin.channel(channelName, {
      config: { broadcast: { ack: false } }
    })
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 2500)
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
      payload: {
        to: String(toUserId),
        from: String(payload.from || ''),
        delivered: Boolean(payload.delivered || payload.read),
        read: Boolean(payload.read),
        messageIds: (payload.messageIds || []).map(String)
      }
    })
    await supabaseAdmin.removeChannel(channel)
  } catch (err) {
    console.warn('broadcastChatReceipt failed:', err?.message || err)
  }
}
