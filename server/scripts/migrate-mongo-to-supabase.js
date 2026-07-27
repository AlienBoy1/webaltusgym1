/**
 * Migrate MongoDB (altusGym) → Supabase Auth + Postgres
 *
 * Usage:
 *   cd server
 *   # Ensure .env has SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MONGODB_URI
 *   node scripts/migrate-mongo-to-supabase.js
 *
 * Dry run (no writes to Supabase Auth/DB except migration_id_map optional):
 *   DRY_RUN=1 node scripts/migrate-mongo-to-supabase.js
 */
import dns from 'dns'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { MongoClient, ObjectId } from 'mongodb'
import { randomUUID } from 'crypto'

// Windows/router DNS often breaks Node SRV lookups (querySrv ECONNREFUSED).
dns.setServers(['8.8.8.8', '1.1.1.1'])
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first')
}

dotenv.config()

const DRY_RUN = process.env.DRY_RUN === '1'
const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://alien:alien@cluster0.xr01zqx.mongodb.net/altusGym?retryWrites=true&w=majority&appName=Cluster0'
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const report = {
  users: { ok: 0, fail: 0, resetPassword: [] },
  follows: 0,
  workouts: 0,
  posts: 0,
  messages: 0,
  notifications: 0,
  classes: 0,
  challenges: 0,
  attendance: 0,
  membershipPlans: 0,
  registrationRequests: 0,
  accessCodes: 0,
  errors: []
}

function oid(val) {
  if (!val) return null
  if (typeof val === 'string') return val
  if (val.$oid) return val.$oid
  if (val.toString) return val.toString()
  return String(val)
}

async function mapId(mongoId, entityType) {
  const key = oid(mongoId)
  if (!key) return null

  const { data: existing } = await supabase
    .from('migration_id_map')
    .select('uuid_id')
    .eq('mongo_id', key)
    .maybeSingle()

  if (existing?.uuid_id) return existing.uuid_id

  const uuid = randomUUID()
  if (!DRY_RUN) {
    await supabase.from('migration_id_map').upsert({
      mongo_id: key,
      uuid_id: uuid,
      entity_type: entityType
    })
  }
  return uuid
}

async function uploadDataUrl(bucket, path, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return dataUrl
  }
  if (DRY_RUN) return `https://placeholder.local/${bucket}/${path}`

  const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
  if (!match) return dataUrl
  const contentType = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true
  })
  if (error) {
    report.errors.push(`storage ${path}: ${error.message}`)
    return dataUrl
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

async function migrateUsers(db) {
  const users = await db.collection('users').find({}).toArray()
  console.log(`Users: ${users.length}`)

  for (const u of users) {
    try {
      const email = (u.email || '').toLowerCase()
      if (!email) continue

      let userId
      const { data: listed } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const existingAuth = listed?.users?.find((x) => x.email?.toLowerCase() === email)

      if (existingAuth) {
        userId = existingAuth.id
        await supabase.from('migration_id_map').upsert({
          mongo_id: oid(u._id),
          uuid_id: userId,
          entity_type: 'user'
        })
      } else {
        userId = await mapId(u._id, 'user')
        const tempPassword = `Migra${oid(u._id).slice(-8)}!aA1`
        if (!DRY_RUN) {
          const { data: created, error } = await supabase.auth.admin.createUser({
            id: userId,
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { name: u.name },
            app_metadata: { role: u.role || 'user' }
          })
          if (error) {
            // fallback without custom id
            const { data: created2, error: err2 } = await supabase.auth.admin.createUser({
              email,
              password: tempPassword,
              email_confirm: true,
              user_metadata: { name: u.name },
              app_metadata: { role: u.role || 'user' }
            })
            if (err2) throw err2
            userId = created2.user.id
            await supabase.from('migration_id_map').upsert({
              mongo_id: oid(u._id),
              uuid_id: userId,
              entity_type: 'user'
            })
          } else {
            userId = created.user.id
          }
          report.users.resetPassword.push(email)
        }
      }

      let avatar = u.avatar
      if (avatar?.startsWith('data:')) {
        avatar = await uploadDataUrl('avatars', `${userId}/avatar.bin`, avatar)
      }

      if (!DRY_RUN) {
        await supabase.from('profiles').upsert({
          id: userId,
          name: u.name || 'Usuario',
          email,
          phone: u.phone || null,
          role: u.role || 'user',
          avatar: avatar || null,
          goal: u.goal || 'health',
          membership: u.membership || {},
          stats: u.stats || {},
          badges: u.badges || [],
          settings: u.settings || {},
          profile: u.profile || {},
          push_subscription: u.pushSubscription || null,
          onboarding_completed: !!u.onboardingCompleted,
          must_reset_password: true,
          last_login: u.lastLogin ? new Date(u.lastLogin).toISOString() : null,
          created_at: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }

      // store social for second pass
      u.__uuid = userId
      report.users.ok++
    } catch (err) {
      report.users.fail++
      report.errors.push(`user ${u.email}: ${err.message}`)
      console.error('User fail', u.email, err.message)
    }
  }

  // follows second pass
  for (const u of users) {
    if (!u.__uuid) continue
    const following = u.social?.following || []
    for (const f of following) {
      const followingId = await mapId(f, 'user')
      if (!followingId || DRY_RUN) continue
      const { error } = await supabase.from('follows').upsert({
        follower_id: u.__uuid,
        following_id: followingId
      })
      if (!error) report.follows++
    }
  }

  return users
}

async function migrateCollection(db, name, handler) {
  const docs = await db.collection(name).find({}).toArray()
  console.log(`${name}: ${docs.length}`)
  for (const doc of docs) {
    try {
      await handler(doc)
    } catch (err) {
      report.errors.push(`${name} ${oid(doc._id)}: ${err.message}`)
    }
  }
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE MIGRATION ===')
  const mongo = new MongoClient(MONGODB_URI)
  await mongo.connect()
  const db = mongo.db()

  await migrateUsers(db)

  await migrateCollection(db, 'workouts', async (w) => {
    const id = await mapId(w._id, 'workout')
    const userId = await mapId(w.user, 'user')
    if (!userId || DRY_RUN) return
    await supabase.from('workouts').upsert({
      id,
      user_id: userId,
      name: w.name,
      exercises: w.exercises || [],
      duration: w.duration,
      calories_burned: w.caloriesBurned,
      notes: w.notes,
      completed_at: w.completedAt ? new Date(w.completedAt).toISOString() : null,
      created_at: w.createdAt ? new Date(w.createdAt).toISOString() : new Date().toISOString()
    })
    report.workouts++
  })

  await migrateCollection(db, 'posts', async (p) => {
    const id = await mapId(p._id, 'post')
    const userId = await mapId(p.user, 'user')
    if (!userId || DRY_RUN) return
    let images = p.images || []
    images = await Promise.all(
      images.map((img, i) =>
        typeof img === 'string' && img.startsWith('data:')
          ? uploadDataUrl('posts', `${userId}/${id}-${i}.bin`, img)
          : img
      )
    )
    await supabase.from('posts').upsert({
      id,
      user_id: userId,
      content: p.content,
      images,
      mood: p.mood,
      poll: p.poll || null,
      post_type: p.postType || 'text',
      badge_data: p.badgeData || null,
      created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString()
    })
    for (const like of p.likes || []) {
      const lid = await mapId(like, 'user')
      if (lid) await supabase.from('post_likes').upsert({ post_id: id, user_id: lid })
    }
    for (const c of p.comments || []) {
      const cid = await mapId(c.user, 'user')
      if (cid) {
        await supabase.from('post_comments').insert({
          post_id: id,
          user_id: cid,
          content: c.content,
          created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString()
        })
      }
    }
    report.posts++
  })

  await migrateCollection(db, 'messages', async (m) => {
    const id = await mapId(m._id, 'message')
    const from = await mapId(m.from, 'user')
    const to = await mapId(m.to, 'user')
    if (!from || !to || DRY_RUN) return
    await supabase.from('messages').upsert({
      id,
      from_user_id: from,
      to_user_id: to,
      content: m.content,
      read: !!m.read,
      created_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString()
    })
    report.messages++
  })

  await migrateCollection(db, 'notifications', async (n) => {
    const id = await mapId(n._id, 'notification')
    const userId = await mapId(n.user, 'user')
    if (!userId || DRY_RUN) return
    await supabase.from('notifications').upsert({
      id,
      user_id: userId,
      type: n.type,
      title: n.title,
      body: n.body,
      icon: n.icon,
      priority: n.priority || 'normal',
      related_user_id: n.relatedUser ? await mapId(n.relatedUser, 'user') : null,
      related_data: n.relatedData || {},
      read: !!n.read,
      pushed: !!n.pushed,
      created_at: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString()
    })
    report.notifications++
  })

  await migrateCollection(db, 'classes', async (c) => {
    const id = await mapId(c._id, 'class')
    const instructor = c.instructor ? await mapId(c.instructor, 'user') : null
    if (DRY_RUN) return
    await supabase.from('classes').upsert({
      id,
      name: c.name,
      description: c.description,
      instructor_id: instructor,
      type: c.type,
      capacity: c.capacity || 20,
      duration: c.duration,
      image: c.image,
      equipment: c.equipment || [],
      schedule: c.schedule || {},
      created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString()
    })
    for (const e of c.enrolled || []) {
      const uid = await mapId(e.user || e, 'user')
      if (uid) {
        await supabase.from('class_enrollments').upsert({
          class_id: id,
          user_id: uid,
          enrolled_at: e.enrolledAt
            ? new Date(e.enrolledAt).toISOString()
            : new Date().toISOString(),
          completed_at: e.completedAt ? new Date(e.completedAt).toISOString() : null
        })
      }
    }
    for (const w of c.waitlist || []) {
      const uid = await mapId(w, 'user')
      if (uid) await supabase.from('class_waitlist').upsert({ class_id: id, user_id: uid })
    }
    report.classes++
  })

  await migrateCollection(db, 'challenges', async (c) => {
    const id = await mapId(c._id, 'challenge')
    if (DRY_RUN) return
    await supabase.from('challenges').upsert({
      id,
      title: c.title || c.name,
      description: c.description,
      type: c.type,
      goal: c.goal,
      unit: c.unit,
      image: c.image,
      start_date: c.startDate ? new Date(c.startDate).toISOString() : null,
      end_date: c.endDate ? new Date(c.endDate).toISOString() : null,
      reward: c.reward || {},
      created_by: c.createdBy ? await mapId(c.createdBy, 'user') : null,
      created_at: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString()
    })
    for (const p of c.participants || []) {
      const uid = await mapId(p.user || p, 'user')
      if (uid) {
        await supabase.from('challenge_participants').upsert({
          challenge_id: id,
          user_id: uid,
          progress: p.progress || 0,
          completed: !!p.completed
        })
      }
    }
    report.challenges++
  })

  await migrateCollection(db, 'attendances', async (a) => {
    const id = await mapId(a._id, 'attendance')
    const userId = await mapId(a.user, 'user')
    if (!userId || DRY_RUN) return
    await supabase.from('attendance').upsert({
      id,
      user_id: userId,
      check_in: a.checkIn ? new Date(a.checkIn).toISOString() : new Date().toISOString(),
      check_out: a.checkOut ? new Date(a.checkOut).toISOString() : null,
      duration: a.duration
    })
    report.attendance++
  })

  // also try collection name "attendance"
  try {
    await migrateCollection(db, 'attendance', async (a) => {
      const id = await mapId(a._id, 'attendance')
      const userId = await mapId(a.user, 'user')
      if (!userId || DRY_RUN) return
      await supabase.from('attendance').upsert({
        id,
        user_id: userId,
        check_in: a.checkIn ? new Date(a.checkIn).toISOString() : new Date().toISOString(),
        check_out: a.checkOut ? new Date(a.checkOut).toISOString() : null,
        duration: a.duration
      })
      report.attendance++
    })
  } catch {
    /* optional */
  }

  await migrateCollection(db, 'memberships', async (m) => {
    const id = await mapId(m._id, 'membership_plan')
    if (DRY_RUN) return
    await supabase.from('membership_plans').upsert({
      id,
      plan: m.plan || m.name,
      name: m.name || m.plan,
      price: m.price || 0,
      duration: m.duration || 30,
      benefits: m.benefits || [],
      features: m.features || {},
      active: m.active !== false
    })
    report.membershipPlans++
  })

  await migrateCollection(db, 'registrationrequests', async (r) => {
    const id = await mapId(r._id, 'registration_request')
    if (DRY_RUN) return
    await supabase.from('registration_requests').upsert({
      id,
      email: (r.email || '').toLowerCase(),
      status: r.status || 'pending',
      access_code_attempts: r.accessCodeAttempts || 0,
      max_attempts: r.maxAttempts || 3,
      user_data: r.userData || {},
      created_at: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      completed_at: r.completedAt ? new Date(r.completedAt).toISOString() : null
    })
    report.registrationRequests++
  })

  await migrateCollection(db, 'accesscodes', async (c) => {
    const id = await mapId(c._id, 'access_code')
    if (DRY_RUN) return
    await supabase.from('access_codes').upsert({
      id,
      code: c.code,
      email: (c.email || '').toLowerCase(),
      registration_request_id: c.registrationRequest
        ? await mapId(c.registrationRequest, 'registration_request')
        : null,
      created_by: c.createdBy ? await mapId(c.createdBy, 'user') : null,
      used: !!c.used,
      used_at: c.usedAt ? new Date(c.usedAt).toISOString() : null,
      used_by: c.usedBy ? await mapId(c.usedBy, 'user') : null,
      expires_at: c.expiresAt
        ? new Date(c.expiresAt).toISOString()
        : new Date(Date.now() + 7 * 864e5).toISOString()
    })
    report.accessCodes++
  })

  await mongo.close()
  console.log('\n=== MIGRATION REPORT ===')
  console.log(JSON.stringify(report, null, 2))
  console.log(
    '\nUsuarios migrados deben restablecer contraseña (must_reset_password=true) o usar forgot-password.'
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
