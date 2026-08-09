import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import api from '../utils/api'
import { Avatar, isRenderableAvatar } from '../utils/avatarUtils'
import PresenceDot from './PresenceDot'
import {
  comparePresencePeople,
  formatActivePresenceLabel,
  getPresenceMeta,
  getUserLastSeen,
  getUserPresenceEntry,
  getUserStatus,
  hydrateLastSeenBulk,
  isPresenceOnline,
  presenceDisplayName,
  subscribePresenceMap
} from '../utils/presence'
import { displayQiSiHandle, isQiSiProfile, QISI_HANDLE, QISI_NAME } from '../utils/qisi'
import { QYSI_AVATAR_SRC } from './QySiAvatar'

function sortRailPeople(people) {
  const qysi = people.filter((p) => p.isQiSi || isQiSiProfile(p))
  const rest = people.filter((p) => !(p.isQiSi || isQiSiProfile(p)))
  const following = rest.filter((p) => p.source === 'following')
  const suggestions = rest.filter((p) => p.source !== 'following')
  const getUpdatedAt = (id) => getUserPresenceEntry(id)?.updatedAt || 0
  const sorter = (a, b) =>
    comparePresencePeople(a, b, getUserStatus, (id) => getUserLastSeen(id), getUpdatedAt)
  return [...qysi, ...following.sort(sorter), ...suggestions.sort(sorter)]
}

function BubbleItem({ person, now }) {
  const id = person._id || person.id
  const isQiSi = Boolean(person.isQiSi || isQiSiProfile(person))
  const status = isQiSi ? 'online' : getUserStatus(id)
  const lastSeen = getUserLastSeen(id) || person.lastSeenAt
  const label = isQiSi ? 'En línea' : formatActivePresenceLabel(status, lastSeen, now)
  const meta = getPresenceMeta(status)
  const online = isQiSi || isPresenceOnline(status)
  const display = isQiSi ? QISI_NAME : presenceDisplayName(person)
  const handle = isQiSi ? QISI_HANDLE : displayQiSiHandle(person.username)

  return (
    <Link
      to={`/user/${isQiSi && person.username ? person.username : id}`}
      className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center outline-none"
    >
      <div className="relative">
        <div
          className={`rounded-full p-[2px] ${
            isQiSi
              ? 'bg-gradient-to-br from-primary-400 to-primary-700'
              : online
                ? 'bg-gradient-to-br from-accent-green/90 to-primary-500/70'
                : 'bg-transparent'
          }`}
        >
          <div className="rounded-full bg-[color:var(--bg-elevated)] p-[2px]">
            <Avatar
              avatar={isQiSi ? QYSI_AVATAR_SRC : person.avatar}
              name={person.name || QISI_NAME}
              size="story"
            />
          </div>
        </div>
        {!isQiSi && (
          <PresenceDot
            userId={id}
            size="md"
            showOffline={false}
            borderClass="border-[color:var(--bg-elevated)]"
          />
        )}
        {isQiSi && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-[8px] font-bold text-white ring-2 ring-[color:var(--bg-elevated)]">
            Qy
          </span>
        )}
      </div>
      <div className="w-full min-w-0 px-0.5">
        <p className="truncate text-[11px] font-semibold leading-tight text-[color:var(--text-primary)]">
          {display}
        </p>
        <p
          className={`mt-0.5 truncate text-[10px] font-medium leading-tight ${
            online || isQiSi ? meta.textClass : 'text-[color:var(--text-muted)]'
          }`}
          title={isQiSi ? `@${handle}` : label}
        >
          {isQiSi ? `@${handle}` : label}
        </p>
      </div>
    </Link>
  )
}

/**
 * Horizontal Messenger-style presence bubbles for the Dashboard.
 */
export default function PresenceBubblesRail() {
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await api.get('/users/presence-rail?limit=24')
        const list = Array.isArray(data?.people) ? data.people : []
        if (cancelled) return
        hydrateLastSeenBulk(list)
        setPeople(list)
      } catch {
        if (!cancelled) setPeople([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Fill missing photos (only when avatar is empty)
  useEffect(() => {
    if (!people.length) return undefined
    let cancelled = false
    const missing = people.filter((p) => {
      const id = p._id || p.id
      return id && !isRenderableAvatar(p.avatar)
    })
    if (!missing.length) return undefined

    ;(async () => {
      const updates = {}
      await Promise.all(
        missing.map(async (person) => {
          const id = person._id || person.id
          try {
            const { data } = await api.get(`/users/${id}`)
            const avatar = data?.avatar || null
            if (!isRenderableAvatar(avatar)) return
            updates[id] = avatar
          } catch {
            /* ignore */
          }
        })
      )
      if (cancelled || !Object.keys(updates).length) return
      setPeople((prev) =>
        prev.map((p) => {
          const id = p._id || p.id
          return updates[id] ? { ...p, avatar: updates[id] } : p
        })
      )
    })()

    return () => {
      cancelled = true
    }
  }, [
    people
      .map((p) => `${p._id || p.id}:${isRenderableAvatar(p.avatar) ? '1' : '0'}`)
      .join('|')
  ])

  // Re-render on presence map changes + refresh last-seen labels
  useEffect(() => {
    const unsub = subscribePresenceMap(() => setTick((n) => n + 1))
    const clock = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => {
      unsub()
      window.clearInterval(clock)
    }
  }, [])

  const sorted = useMemo(() => sortRailPeople(people), [people, now, tick])

  if (!loading && sorted.length === 0) return null

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 }}
      className="-mx-1"
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="font-display text-base tracking-wide sm:text-lg">En la comunidad</h2>
        <span className="text-[11px] font-medium text-[color:var(--text-muted)]">
          En línea primero
        </span>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-hidden px-1 pb-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex w-[72px] shrink-0 flex-col items-center gap-2">
              <div className="h-14 w-14 animate-pulse rounded-full bg-[color:var(--bg-muted)]" />
              <div className="h-2.5 w-12 animate-pulse rounded bg-[color:var(--bg-muted)]" />
              <div className="h-2 w-10 animate-pulse rounded bg-[color:var(--bg-muted)]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-hide">
          {sorted.map((person) => (
            <BubbleItem key={person._id || person.id} person={person} now={now} />
          ))}
        </div>
      )}
    </motion.section>
  )
}
