import { getPresenceMeta, PRESENCE_STATUS, usePresenceStatus } from '../utils/presence'

const SIZE_CLASS = {
  sm: 'w-2.5 h-2.5 border-2',
  md: 'w-3 h-3 border-2'
}

/**
 * Absolute status dot for avatars. Parent must be `relative`.
 */
export default function PresenceDot({
  userId,
  status: statusProp,
  size = 'sm',
  showOffline = false,
  className = '',
  borderClass = 'border-dark-200'
}) {
  const liveStatus = usePresenceStatus(userId)
  const status = statusProp || liveStatus || PRESENCE_STATUS.OFFLINE

  if (status === PRESENCE_STATUS.OFFLINE && !showOffline) return null

  const meta = getPresenceMeta(status)
  const sizeClass = SIZE_CLASS[size] || SIZE_CLASS.sm

  return (
    <span
      className={`absolute bottom-0 right-0 rounded-full ${sizeClass} ${meta.ringClass} ${borderClass} ${className}`}
      title={meta.label}
      aria-label={meta.label}
    />
  )
}
