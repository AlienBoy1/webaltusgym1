/**
 * Backfill data-URL media from Postgres into the `media` Storage bucket.
 *
 * Usage (from /server):
 *   node scripts/migrate-media-to-storage.js
 *   node scripts/migrate-media-to-storage.js --limit=20
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and APPLY_NOW_media_storage.sql applied.
 */
import dotenv from 'dotenv'
import { supabaseAdmin } from '../src/lib/supabase.js'
import {
  migrateProfileMediaRow,
  persistMedia,
  persistMediaList,
  isInlineDataUrl
} from '../src/utils/mediaStorage.js'
import { decodeChatContent, encodeChatContent } from '../src/utils/chatMessage.js'

dotenv.config()

const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const LIMIT = Math.min(Math.max(Number(limitArg?.split('=')[1]) || 30, 1), 200)

async function migrateProfiles() {
  const { data: avatarIds, error: aErr } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .like('avatar', 'data:%')
    .limit(LIMIT)
  if (aErr) console.warn('profiles avatar scan:', aErr.message)

  const { data: coverIds, error: cErr } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .filter('profile->>coverUrl', 'like', 'data:%')
    .limit(LIMIT)
  if (cErr) console.warn('profiles cover scan:', cErr.message)

  const ids = [...new Set([...(avatarIds || []), ...(coverIds || [])].map((r) => r.id))]
  let n = 0
  for (const id of ids) {
    const { data: row, error } = await supabaseAdmin
      .from('profiles')
      .select('id, avatar, profile')
      .eq('id', id)
      .maybeSingle()
    if (error || !row) continue
    const before = row.avatar
    const next = await migrateProfileMediaRow(row)
    if (next.avatar !== before || next.profile?.coverUrl !== row.profile?.coverUrl) n += 1
    process.stdout.write('.')
  }
  return n
}

async function migratePosts() {
  const { data, error } = await supabaseAdmin
    .from('posts')
    .select('id, user_id, images')
    .not('images', 'eq', '{}')
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  if (error) {
    console.warn('posts scan:', error.message)
    return 0
  }
  let n = 0
  for (const post of data || []) {
    if (!Array.isArray(post.images) || !post.images.some(isInlineDataUrl)) continue
    const next = await persistMediaList(post.images, { folder: 'posts', userId: post.user_id, id: post.id })
    const changed = next.some((url, i) => url !== post.images[i])
    if (!changed) continue
    const { error: upErr } = await supabaseAdmin.from('posts').update({ images: next }).eq('id', post.id)
    if (!upErr) n += 1
    process.stdout.write('.')
  }
  return n
}

async function migrateStories() {
  const { data, error } = await supabaseAdmin
    .from('stories')
    .select('id, user_id, media_url')
    .like('media_url', 'data:%')
    .limit(LIMIT)
  if (error) {
    console.warn('stories scan:', error.message)
    return 0
  }
  let n = 0
  for (const row of data || []) {
    const url = await persistMedia(row.media_url, { folder: 'stories', userId: row.user_id, id: row.id })
    if (!url || url === row.media_url) continue
    const { error: upErr } = await supabaseAdmin.from('stories').update({ media_url: url }).eq('id', row.id)
    if (!upErr) n += 1
    process.stdout.write('.')
  }
  return n
}

async function migrateMessages() {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('id, from_user_id, content')
    .like('content', '%data:%')
    .order('created_at', { ascending: false })
    .limit(LIMIT)
  if (error) {
    console.warn('messages scan:', error.message)
    return 0
  }
  let n = 0
  for (const row of data || []) {
    const decoded = decodeChatContent(row.content)
    if (!isInlineDataUrl(decoded.attachment?.url)) continue
    const url = await persistMedia(decoded.attachment.url, {
      folder: 'chat',
      userId: row.from_user_id,
      id: row.id
    })
    if (!url || url === decoded.attachment.url) continue
    const stored = encodeChatContent({
      text: decoded.text,
      attachment: { ...decoded.attachment, url },
      reply: decoded.reply,
      reactions: decoded.reactions,
      deleted: decoded.deleted
    })
    const { error: upErr } = await supabaseAdmin.from('messages').update({ content: stored }).eq('id', row.id)
    if (!upErr) n += 1
    process.stdout.write('.')
  }
  return n
}

async function main() {
  console.log(`Migrando media a Storage (lote ${LIMIT})…`)
  const profiles = await migrateProfiles()
  console.log(`\nPerfiles: ${profiles}`)
  const posts = await migratePosts()
  console.log(`\nPosts: ${posts}`)
  const stories = await migrateStories()
  console.log(`\nHistorias: ${stories}`)
  const messages = await migrateMessages()
  console.log(`\nMensajes: ${messages}`)
  console.log('Listo. Vuelve a ejecutar si quedan data URLs.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
