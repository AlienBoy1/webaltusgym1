const RANK = { sent: 0, delivered: 1, read: 2 }

export function receiptStatusFromFlags({ status, delivered, read } = {}) {
  if (read === true || status === 'read') return 'read'
  if (delivered === true || status === 'delivered') return 'delivered'
  return status === 'sent' ? 'sent' : status || 'sent'
}

/** Never lower envío → entregado → leído. */
export function mergeReceipt(prev = {}, incoming = {}) {
  const prevStatus = receiptStatusFromFlags(prev)
  const nextStatus = receiptStatusFromFlags(incoming)
  const best = RANK[nextStatus] >= RANK[prevStatus] ? nextStatus : prevStatus
  return {
    status: best,
    delivered: best === 'delivered' || best === 'read',
    read: best === 'read'
  }
}
