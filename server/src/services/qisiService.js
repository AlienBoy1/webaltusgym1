import crypto from 'crypto'
import { supabaseAdmin } from '../lib/supabase.js'
import { flattenQiSiCatalog } from '../data/qisiCatalog.js'
import {
  QISI_EMAIL,
  QISI_HANDLE,
  QISI_LAUNCH_STORY_KEY,
  QISI_MEANING,
  QISI_NAME,
  QISI_SOURCE_KIND,
  QISI_TAGLINE,
  QISI_USERNAME
} from '../utils/qisi.js'
import { getBadgeDefinitions } from './xpService.js'

const PROFILE_SELECT =
  'id, name, username, email, phone, role, avatar, goal, membership, stats, badges, settings, profile, last_seen_at, last_login, created_at, updated_at'

const QISI_TOP_STATS = {
  level: 100,
  xp: 999999,
  totalWorkouts: 1000,
  currentStreak: 365,
  longestStreak: 365
}

function buildQiSiAllBadges() {
  const earnedAt = new Date().toISOString()
  return getBadgeDefinitions().map((b) => ({
    id: b.id,
    name: b.name,
    icon: b.icon,
    type: b.type,
    difficulty: b.difficulty,
    earnedAt,
    xpReward: b.xpReward || 0
  }))
}

function needsShowcaseHeal(profile) {
  if (!profile) return true
  const raw = profile._raw || profile
  const level = Number(raw.stats?.level || 0)
  const badgeCount = Array.isArray(raw.badges) ? raw.badges.length : 0
  const catalogSize = getBadgeDefinitions().length
  return level < 100 || badgeCount < catalogSize
}

let cachedQySi = null
let ensurePromise = null

function buildQiSiAvatarSvg() {
  // Prefer the public brand asset when serving client-relative avatars.
  // Kept as function name for call-site compatibility.
  return '/qysi-avatar.png?v=7'
}

function buildLaunchStorySvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920" role="img">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F1115"/>
      <stop offset="45%" stop-color="#1A1410"/>
      <stop offset="100%" stop-color="#2A160E"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF6B35"/>
      <stop offset="100%" stop-color="#C94A1F"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="28%" r="45%">
      <stop offset="0%" stop-color="#FF6B35" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#FF6B35" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect width="1080" height="1920" fill="url(#glow)"/>
  <circle cx="540" cy="520" r="150" fill="url(#accent)"/>
  <circle cx="540" cy="500" r="52" fill="none" stroke="#fff" stroke-width="16"/>
  <path d="M575 535 L640 605" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round"/>
  <text x="540" y="740" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="92" font-weight="800" fill="#FFFFFF">QySi</text>
  <text x="540" y="810" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="34" fill="#FFB088">@${QISI_HANDLE}</text>
  <text x="540" y="920" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="48" font-weight="700" fill="#FFFFFF">Nuevo sistema inteligente</text>
  <text x="540" y="985" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="36" fill="#D8DDE6">${QISI_MEANING}</text>
  <rect x="180" y="1100" width="720" height="220" rx="36" fill="rgba(255,255,255,0.06)" stroke="rgba(255,107,53,0.45)" stroke-width="3"/>
  <text x="540" y="1185" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="34" font-weight="600" fill="#FFFFFF">Encuéntrame en Entrenamientos</text>
  <text x="540" y="1245" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="30" fill="#AEB6C2">Burbuja inferior derecha · 5 variantes listas</text>
  <text x="540" y="1460" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="28" fill="#8B93A1">Gym · Casa · Calistenia · Running · Full Body</text>
  <text x="540" y="1750" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-size="26" fill="#6B7280">#${QISI_LAUNCH_STORY_KEY}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function mapQiSiProfile(row) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    name: row.name || QISI_NAME,
    username: row.username || QISI_USERNAME,
    displayHandle: QISI_HANDLE,
    avatar: row.avatar || buildQiSiAvatarSvg(),
    role: row.role || 'trainer',
    isQiSi: true,
    bio: row.profile?.bio || `${QISI_MEANING}. ${QISI_TAGLINE}.`,
    lastSeenAt: row.last_seen_at || new Date().toISOString()
  }
}

async function findQiSiProfile() {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('username', QISI_USERNAME)
    .maybeSingle()
  if (error) throw error
  return data || null
}

async function createQiSiAuthAndProfile() {
  const password =
    process.env.QISI_SYSTEM_PASSWORD ||
    crypto.randomBytes(32).toString('hex')

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: (process.env.QISI_EMAIL || QISI_EMAIL).toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name: QISI_NAME, system: 'qisi' },
    app_metadata: { role: 'user', systemKind: 'qisi' }
  })

  if (createError) {
    // Email may already exist — look up by email then patch username
    if (/already|registered|exists/i.test(String(createError.message || ''))) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const found = (list?.users || []).find(
        (u) => String(u.email || '').toLowerCase() === (process.env.QISI_EMAIL || QISI_EMAIL).toLowerCase()
      )
      if (found) {
        return upsertQiSiProfile(found.id)
      }
    }
    throw createError
  }

  return upsertQiSiProfile(created.user.id)
}

async function upsertQiSiProfile(userId) {
  const now = new Date().toISOString()
  const avatar = buildQiSiAvatarSvg()
  const payload = {
    id: userId,
    email: (process.env.QISI_EMAIL || QISI_EMAIL).toLowerCase(),
    name: QISI_NAME,
    username: QISI_USERNAME,
    role: 'user',
    avatar,
    goal: 'guiar entrenamientos inteligentes',
    membership: { status: 'active', plan: 'system' },
    stats: { ...QISI_TOP_STATS },
    badges: buildQiSiAllBadges(),
    settings: {
      systemKind: 'qisi',
      isSystemAccount: true,
      privacy: { profilePublic: true },
      notifications: { enabled: false }
    },
    profile: {
      isQiSi: true,
      bio: `${QISI_MEANING}. Soy ${QISI_NAME}, tu trainer @${QISI_HANDLE}.`,
      displayHandle: QISI_HANDLE,
      coverMode: 'animated'
    },
    onboarding_completed: true,
    must_reset_password: false,
    last_login: now,
    last_seen_at: now,
    updated_at: now
  }

  // Prefer upsert; some DBs require created_at on insert
  payload.created_at = now

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select(PROFILE_SELECT)
    .single()

  if (error) throw error
  return data
}

async function ensureCatalogRoutines(QySiUserId) {
  const catalog = flattenQiSiCatalog()
  const { data: existing } = await supabaseAdmin
    .from('workout_routines')
    .select('id, local_id, source_kind')
    .eq('user_id', QySiUserId)

  const byLocal = new Map((existing || []).map((r) => [r.local_id, r]))
  const now = new Date().toISOString()

  for (const item of catalog) {
    const row = {
      user_id: QySiUserId,
      local_id: item.localId,
      name: item.name,
      color: item.color,
      exercises: item.exercises,
      days: [],
      is_public: false,
      source_kind: QISI_SOURCE_KIND,
      original_creator_id: QySiUserId,
      updated_at: now
    }

    const prev = byLocal.get(item.localId)
    if (prev?.id) {
      await supabaseAdmin.from('workout_routines').update(row).eq('id', prev.id)
    } else {
      try {
        await supabaseAdmin.from('workout_routines').insert({
          ...row,
          created_at: now,
          adopt_count: 0,
          is_edited_fork: false
        })
      } catch (err) {
        // Fallback if source_kind column not applied yet
        if (/source_kind/i.test(String(err?.message || ''))) {
          const { source_kind, ...without } = row
          await supabaseAdmin.from('workout_routines').upsert(
            { ...without, created_at: now },
            { onConflict: 'user_id,local_id' }
          )
        } else {
          console.warn('QySi catalog seed item failed:', item.localId, err?.message || err)
        }
      }
    }
  }
}

async function ensureLaunchStory(QySiUserId) {
  const now = new Date()
  const marker = `#${QISI_LAUNCH_STORY_KEY}`

  const { data: active } = await supabaseAdmin
    .from('stories')
    .select('id, caption, expires_at')
    .eq('user_id', QySiUserId)
    .gt('expires_at', now.toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  const hasLaunch = (active || []).some((s) => String(s.caption || '').includes(marker))
  if (hasLaunch) return

  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const caption =
    `¡Hola! Soy ${QISI_NAME}, tu ${QISI_MEANING} (@${QISI_HANDLE}). ` +
    `Pásate por Entrenamientos y tócalo en la burbuja inferior derecha. ` +
    `5 variantes listas para ti. ${marker}`

  const { error } = await supabaseAdmin.from('stories').insert({
    user_id: QySiUserId,
    media_type: 'image',
    media_url: buildLaunchStorySvg(),
    caption: caption.slice(0, 280),
    created_at: now.toISOString(),
    expires_at: expires.toISOString()
  })

  if (error) {
    console.warn('QySi launch story failed:', error.message || error)
  }
}

export async function ensureQiSiSystem() {
  if (cachedQySi?.id && !needsShowcaseHeal(cachedQySi._raw || cachedQySi)) {
    supabaseAdmin
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', cachedQySi.id)
      .then(() => {})
      .catch(() => {})
    return cachedQySi
  }

  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    let profile = await findQiSiProfile()
    if (!profile) {
      profile = await createQiSiAuthAndProfile()
    } else {
      const patch = {
        name: QISI_NAME,
        username: QISI_USERNAME,
        role: 'user',
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        stats: { ...(profile.stats || {}), ...QISI_TOP_STATS },
        badges: buildQiSiAllBadges(),
        settings: {
          ...(profile.settings || {}),
          systemKind: 'qisi',
          isSystemAccount: true,
          privacy: {
            ...(profile.settings?.privacy || {}),
            profilePublic: true
          }
        },
        profile: {
          ...(profile.profile || {}),
          isQiSi: true,
          displayHandle: QISI_HANDLE,
          coverMode: 'animated',
          coverUrl: null,
          bio:
            profile.profile?.bio ||
            `${QISI_MEANING}. Soy ${QISI_NAME}, tu trainer @${QISI_HANDLE}.`
        }
      }
      if (
        !profile.avatar ||
        String(profile.avatar).startsWith('data:image/svg') ||
        String(profile.avatar).includes('QySi') ||
        (String(profile.avatar).includes('qysi-avatar') &&
          !String(profile.avatar).includes('v=7'))
      ) {
        patch.avatar = buildQiSiAvatarSvg()
      }
      const { data: healed } = await supabaseAdmin
        .from('profiles')
        .update(patch)
        .eq('id', profile.id)
        .select(PROFILE_SELECT)
        .single()
      profile = healed || { ...profile, ...patch }
    }

    try {
      await ensureCatalogRoutines(profile.id)
    } catch (err) {
      console.warn('QySi catalog ensure:', err?.message || err)
    }

    try {
      await ensureLaunchStory(profile.id)
    } catch (err) {
      console.warn('QySi story ensure:', err?.message || err)
    }

    const mapped = mapQiSiProfile(profile)
    mapped._raw = {
      stats: profile.stats,
      badges: profile.badges
    }
    cachedQySi = mapped
    return cachedQySi
  })()
    .catch((err) => {
      ensurePromise = null
      throw err
    })
    .then((result) => {
      ensurePromise = null
      return result
    })

  return ensurePromise
}

export async function getQiSiProfileMapped() {
  const profile = await ensureQiSiSystem()
  return profile
}

export async function listQiSiCatalogRoutines() {
  const QySi = await ensureQiSiSystem()
  const { data, error } = await supabaseAdmin
    .from('workout_routines')
    .select('*')
    .eq('user_id', QySi.id)
    .order('name', { ascending: true })

  if (error) throw error

  const catalog = flattenQiSiCatalog()
  const byLocal = new Map((data || []).map((r) => [r.local_id, r]))

  return catalog.map((item) => {
    const row = byLocal.get(item.localId)
    return {
      ...item,
      id: row?.id || item.localId,
      _id: row?.id || item.localId,
      serverId: row?.id || null,
      isPublic: false,
      isQiSi: true,
      sourceKind: QISI_SOURCE_KIND,
      originalCreatorId: QySi.id,
      originalCreator: QySi,
      user: QySi,
      canAdopt: true
    }
  })
}

export async function adoptQiSiRoutine(userId, catalogId) {
  const QySi = await ensureQiSiSystem()
  const item = flattenQiSiCatalog().find((r) => r.catalogId === catalogId)
  if (!item) {
    const err = new Error('Rutina QySi no encontrada')
    err.status = 404
    throw err
  }

  // Resolve master routine row
  let { data: source } = await supabaseAdmin
    .from('workout_routines')
    .select('*')
    .eq('user_id', QySi.id)
    .eq('local_id', item.localId)
    .maybeSingle()

  if (!source) {
    const now = new Date().toISOString()
    const insert = {
      user_id: QySi.id,
      local_id: item.localId,
      name: item.name,
      color: item.color,
      exercises: item.exercises,
      days: [],
      is_public: false,
      source_kind: QISI_SOURCE_KIND,
      original_creator_id: QySi.id,
      adopt_count: 0,
      is_edited_fork: false,
      created_at: now,
      updated_at: now
    }
    const { data: created, error } = await supabaseAdmin
      .from('workout_routines')
      .insert(insert)
      .select('*')
      .single()
    if (error) throw error
    source = created
  }

  const { data: alreadyRows } = await supabaseAdmin
    .from('workout_routines')
    .select('id, name, local_id')
    .eq('user_id', userId)
    .eq('source_routine_id', source.id)
    .limit(1)

  if (alreadyRows?.[0]) {
    const err = new Error(
      'Ya adoptaste esta rutina de QySi. Elimínala en Entrenamientos si quieres volver a adoptarla.'
    )
    err.status = 409
    err.code = 'ALREADY_ADOPTED'
    err.existingId = alreadyRows[0].id
    throw err
  }

  const localId = `wk-qisi-${catalogId}-${Date.now().toString(36)}`
  const now = new Date().toISOString()
  const stamped = (item.exercises || []).map((ex, i) => ({
    ...ex,
    id: ex.id || `ex-${i + 1}`,
    originExerciseId: ex.id || `ex-${i + 1}`,
    originSnapshot: {
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps
    }
  }))

  const insertRow = {
    user_id: userId,
    local_id: localId,
    name: item.name,
    color: item.color,
    exercises: stamped,
    days: [],
    is_public: false,
    source_routine_id: source.id,
    original_creator_id: QySi.id,
    source_kind: QISI_SOURCE_KIND,
    adopt_count: 0,
    is_edited_fork: false,
    created_at: now,
    updated_at: now
  }

  let data
  let error
  ;({ data, error } = await supabaseAdmin
    .from('workout_routines')
    .insert(insertRow)
    .select('*')
    .single())

  if (error && /source_kind/i.test(String(error.message || ''))) {
    const { source_kind, ...without } = insertRow
    ;({ data, error } = await supabaseAdmin
      .from('workout_routines')
      .insert(without)
      .select('*')
      .single())
  }
  if (error) throw error

  // Increment adopt count on master (best-effort)
  try {
    await supabaseAdmin
      .from('workout_routines')
      .update({
        adopt_count: Math.max(0, Number(source.adopt_count) || 0) + 1,
        updated_at: now
      })
      .eq('id', source.id)
  } catch {
    /* ignore */
  }

  return {
    ...data,
    id: data.id,
    _id: data.id,
    localId: data.local_id,
    isPublic: false,
    isQiSi: true,
    sourceKind: QISI_SOURCE_KIND,
    sourceRoutineId: source.id,
    originalCreatorId: QySi.id,
    originalCreator: QySi,
    exercises: data.exercises || stamped,
    name: data.name,
    color: data.color,
    days: []
  }
}

export function buildQiSiAvatarDataUrl() {
  return buildQiSiAvatarSvg()
}
