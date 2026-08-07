import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { notifyUser } from '../services/notificationService.js'

const router = express.Router()

const NOTE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_NOTE_CHARS = 60
const MAX_REPLY_CHARS = 280
const INTRO_SEEN_KEY = 'notesIntroSeen'

async function purgeExpiredNotes() {
  try {
    const now = new Date().toISOString()
    await supabaseAdmin.from('profile_notes').delete().lte('expires_at', now)
  } catch (err) {
    console.error('purgeExpiredNotes:', err?.message || err)
  }
}

function mapNote(row, extras = {}) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    body: row.body,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    repliesCount: extras.repliesCount ?? 0,
    replies: extras.replies || undefined
  }
}

async function getActiveNote(userId) {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('profile_notes')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', now)
    .maybeSingle()
  if (error) throw error
  return data || null
}

/** GET /api/notes/me — own active note + private replies */
router.get('/me', authenticate, async (req, res) => {
  try {
    await purgeExpiredNotes()
    const note = await getActiveNote(req.user.id)
    if (!note) return res.json({ note: null, replies: [] })

    const { data: replies } = await supabaseAdmin
      .from('profile_note_replies')
      .select('id, body, created_at, from_user_id')
      .eq('note_id', note.id)
      .order('created_at', { ascending: false })

    const fromIds = [...new Set((replies || []).map((r) => r.from_user_id))]
    let profiles = {}
    if (fromIds.length) {
      const { data: rows } = await supabaseAdmin
        .from('profiles')
        .select('id, name, username, avatar')
        .in('id', fromIds)
      profiles = Object.fromEntries((rows || []).map((p) => [p.id, p]))
    }

    const mappedReplies = (replies || []).map((r) => {
      const p = profiles[r.from_user_id]
      return {
        _id: r.id,
        id: r.id,
        body: r.body,
        createdAt: r.created_at,
        from: p
          ? {
              _id: p.id,
              id: p.id,
              name: p.name,
              username: p.username,
              avatar: p.avatar
            }
          : { _id: r.from_user_id, id: r.from_user_id }
      }
    })

    res.json({
      note: mapNote(note, { repliesCount: mappedReplies.length }),
      replies: mappedReplies
    })
  } catch (err) {
    console.error('GET /notes/me:', err)
    res.status(500).json({ message: 'Error al cargar tu nota' })
  }
})

/** GET /api/notes/user/:userId — public active note for a profile */
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    await purgeExpiredNotes()
    const note = await getActiveNote(req.params.userId)
    if (!note) return res.json({ note: null })

    const isOwner = note.user_id === req.user.id
    let repliesCount = 0
    if (isOwner) {
      const { count } = await supabaseAdmin
        .from('profile_note_replies')
        .select('id', { count: 'exact', head: true })
        .eq('note_id', note.id)
      repliesCount = count || 0
    }

    res.json({ note: mapNote(note, { repliesCount }) })
  } catch (err) {
    console.error('GET /notes/user:', err)
    res.status(500).json({ message: 'Error al cargar la nota' })
  }
})

/** POST /api/notes — create or replace own note */
router.post('/', authenticate, async (req, res) => {
  try {
    await purgeExpiredNotes()
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
    if (!body) return res.status(400).json({ message: 'Escribe algo en tu nota' })
    if (body.length > MAX_NOTE_CHARS) {
      return res.status(400).json({ message: `Máximo ${MAX_NOTE_CHARS} caracteres` })
    }

    const expiresAt = new Date(Date.now() + NOTE_TTL_MS).toISOString()

    // One note per user: wipe previous (and its replies via cascade)
    await supabaseAdmin.from('profile_notes').delete().eq('user_id', req.user.id)

    const { data, error } = await supabaseAdmin
      .from('profile_notes')
      .insert({
        user_id: req.user.id,
        body,
        expires_at: expiresAt
      })
      .select('*')
      .single()

    if (error) throw error
    res.status(201).json({ note: mapNote(data, { repliesCount: 0 }) })
  } catch (err) {
    console.error('POST /notes:', err)
    res.status(500).json({ message: 'No se pudo publicar la nota' })
  }
})

/** DELETE /api/notes/me */
router.delete('/me', authenticate, async (req, res) => {
  try {
    await supabaseAdmin.from('profile_notes').delete().eq('user_id', req.user.id)
    res.json({ ok: true })
  } catch (err) {
    console.error('DELETE /notes/me:', err)
    res.status(500).json({ message: 'No se pudo eliminar la nota' })
  }
})

/** Mark notes intro as seen (profile settings) — before :noteId routes */
router.post('/intro/seen', authenticate, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('settings')
      .eq('id', req.user.id)
      .single()

    const settings = { ...(profile?.settings || {}), [INTRO_SEEN_KEY]: true }
    await supabaseAdmin.from('profiles').update({ settings }).eq('id', req.user.id)
    res.json({ ok: true })
  } catch (err) {
    console.error('POST /notes/intro/seen:', err)
    res.status(500).json({ message: 'Error al guardar' })
  }
})

/** POST /api/notes/:noteId/replies — private reply (only note owner sees it) */
router.post('/:noteId/replies', authenticate, async (req, res) => {
  try {
    await purgeExpiredNotes()
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : ''
    if (!body) return res.status(400).json({ message: 'Escribe una respuesta' })
    if (body.length > MAX_REPLY_CHARS) {
      return res.status(400).json({ message: `Máximo ${MAX_REPLY_CHARS} caracteres` })
    }

    const { data: note, error: noteErr } = await supabaseAdmin
      .from('profile_notes')
      .select('*')
      .eq('id', req.params.noteId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (noteErr) throw noteErr
    if (!note) return res.status(404).json({ message: 'Esta nota ya no está disponible' })
    if (note.user_id === req.user.id) {
      return res.status(400).json({ message: 'No puedes responder a tu propia nota' })
    }

    const { data: reply, error } = await supabaseAdmin
      .from('profile_note_replies')
      .insert({
        note_id: note.id,
        from_user_id: req.user.id,
        body
      })
      .select('*')
      .single()

    if (error) throw error

    const { data: sender } = await supabaseAdmin
      .from('profiles')
      .select('name, username')
      .eq('id', req.user.id)
      .maybeSingle()

    const who = sender?.username ? `@${sender.username}` : sender?.name || 'Alguien'
    await notifyUser({
      userId: note.user_id,
      type: 'note_reply',
      title: 'Respuesta a tu nota',
      body: `${who}: ${body.slice(0, 80)}${body.length > 80 ? '…' : ''}`,
      icon: '💬',
      relatedUserId: req.user.id,
      relatedData: { kind: 'note_reply', noteId: note.id, replyId: reply.id },
      pushTag: `note-reply-${note.id}`,
      pushData: { type: 'note_reply', noteId: note.id }
    })

    res.status(201).json({
      reply: {
        _id: reply.id,
        id: reply.id,
        body: reply.body,
        createdAt: reply.created_at
      }
    })
  } catch (err) {
    console.error('POST /notes/:id/replies:', err)
    res.status(500).json({ message: 'No se pudo enviar la respuesta' })
  }
})

export default router
