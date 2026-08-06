/**
 * Builds a 9:16 share image that mirrors ANY Social post type
 * (text, mood, poll, images, badge, workout, routine, challenge, reshare).
 * Used for in-app stories and external shares (WhatsApp).
 */

const MOODS = {
  happy: { label: 'Feliz', emoji: '😊' },
  excited: { label: 'Emocionado', emoji: '🤩' },
  proud: { label: 'Orgulloso', emoji: '😤' },
  motivated: { label: 'Motivado', emoji: '💪' },
  tired: { label: 'Cansado', emoji: '😴' },
  focused: { label: 'Concentrado', emoji: '🧘' },
  grateful: { label: 'Agradecido', emoji: '🙏' },
  determined: { label: 'Determinado', emoji: '🔥' }
}

function authorName(userOrPost) {
  if (!userOrPost) return 'Usuario'
  if (typeof userOrPost === 'object' && userOrPost.name) return userOrPost.name
  if (typeof userOrPost?.user === 'object') return userOrPost.user?.name || 'Usuario'
  return 'Usuario'
}

function authorAvatar(userOrPost) {
  if (!userOrPost) return null
  if (typeof userOrPost === 'object' && userOrPost.avatar) return userOrPost.avatar
  if (typeof userOrPost?.user === 'object') return userOrPost.user?.avatar || null
  return null
}

function cleanCaption(content) {
  if (!content) return ''
  return String(content)
    .replace(/\[workout\][\s\S]*?\[\/workout\]/g, '')
    .trim()
}

function planOrElite(user) {
  if (!user || typeof user !== 'object') return null
  const level = user.stats?.level || 0
  if (level >= 10) return 'Elite'
  const plan = user.membership?.plan
  if (plan) return String(plan).charAt(0).toUpperCase() + String(plan).slice(1)
  return null
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 8) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  if (!words.length) return y
  let line = ''
  let yy = y
  let lines = 0
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      line = word
      yy += lineHeight
      lines += 1
      if (lines >= maxLines) {
        ctx.fillText(`${String(line).slice(0, 40)}…`, x, yy)
        return yy + lineHeight
      }
    } else {
      line = test
    }
  }
  if (line) {
    ctx.fillText(line, x, yy)
    yy += lineHeight
  }
  return yy
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function drawAvatar(ctx, user, x, y, size) {
  const avatar = authorAvatar(user)
  const name = authorName(user)
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  if (avatar && (String(avatar).startsWith('data:') || String(avatar).startsWith('http'))) {
    try {
      const img = await loadImage(avatar)
      ctx.drawImage(img, x, y, size, size)
      ctx.restore()
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      return
    } catch {
      /* fallback */
    }
  }
  ctx.fillStyle = '#2A2A35'
  ctx.fillRect(x, y, size, size)
  ctx.fillStyle = '#FF6B35'
  ctx.font = `bold ${Math.round(size * 0.42)}px Outfit, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText((name.charAt(0) || 'Q').toUpperCase(), x + size / 2, y + size / 2 + 1)
  ctx.restore()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

function classifyPayload(p) {
  const wd = p?.workoutData || p?.workout_data || null
  const badge = p?.badgeData || p?.badge_data || null
  const isRoutine =
    Boolean(wd) &&
    (p?.postType === 'routine' || wd.isRoutine || wd.shareKind === 'routine')
  const isChallenge =
    Boolean(wd) && (p?.postType === 'challenge' || wd.shareKind === 'challenge')
  const isWorkout =
    Boolean(wd) && !isRoutine && !isChallenge && (p?.postType === 'workout' || Boolean(wd.name))
  return {
    wd,
    badge,
    isRoutine,
    isChallenge,
    isWorkout,
    images: Array.isArray(p?.images) ? p.images.filter(Boolean) : [],
    poll: p?.poll || null,
    mood: p?.mood || null,
    caption: cleanCaption(p?.content)
  }
}

function estimateBlockHeight(kind, data) {
  if (kind === 'header') return 100
  if (kind === 'mood') return 90
  if (kind === 'caption') {
    const len = String(data || '').length
    return Math.min(220, Math.max(48, Math.ceil(len / 36) * 40 + 16))
  }
  if (kind === 'badge') return 140
  if (kind === 'poll') {
    const opts = data?.options?.length || 2
    return 70 + opts * 58 + 24
  }
  if (kind === 'images') {
    const n = Math.min(4, data?.length || 1)
    if (n === 1) return 380
    if (n === 2) return 280
    return 520
  }
  if (kind === 'workout' || kind === 'routine' || kind === 'challenge') {
    const ex = Math.min(5, data?.exercises?.length || 0)
    const stats = kind === 'workout' ? 130 : 60
    return 56 + 90 + stats + (ex ? ex * 42 + 40 : 12) + 56
  }
  if (kind === 'embed') return 80 + estimatePayloadHeight(data)
  return 40
}

function estimatePayloadHeight(p) {
  const c = classifyPayload(p)
  let h = 0
  if (c.mood) h += estimateBlockHeight('mood')
  if (c.isWorkout) h += estimateBlockHeight('workout', c.wd)
  else if (c.isRoutine) h += estimateBlockHeight('routine', c.wd)
  else if (c.isChallenge) h += estimateBlockHeight('challenge', c.wd)
  if (c.badge && (c.badge.badgeName || c.badge.name)) h += estimateBlockHeight('badge')
  if (c.caption) h += estimateBlockHeight('caption', c.caption)
  if (c.images.length) h += estimateBlockHeight('images', c.images)
  if (c.poll?.question) h += estimateBlockHeight('poll', c.poll)
  if (!h) h = 80
  return h
}

async function drawFeatureCard(ctx, { x, y, w, kind, wd }) {
  const exercises = (wd.exercises || []).slice(0, 5)
  const statsRow = kind === 'workout'
  const innerH =
    70 +
    70 +
    (statsRow ? 120 : 50) +
    (exercises.length ? exercises.length * 42 + 36 : 0) +
    50

  const ig = ctx.createLinearGradient(x, y, x + w, y + innerH)
  if (kind === 'routine') {
    ig.addColorStop(0, 'rgba(0,245,255,0.18)')
    ig.addColorStop(1, 'rgba(255,107,53,0.12)')
  } else if (kind === 'challenge') {
    ig.addColorStop(0, 'rgba(250,204,21,0.16)')
    ig.addColorStop(1, 'rgba(255,107,53,0.14)')
  } else {
    ig.addColorStop(0, 'rgba(255,107,53,0.22)')
    ig.addColorStop(0.55, 'rgba(124,58,237,0.12)')
    ig.addColorStop(1, 'rgba(0,245,255,0.14)')
  }
  ctx.fillStyle = ig
  roundRect(ctx, x, y, w, innerH, 28)
  ctx.fill()
  const accent = kind === 'routine' ? '#22D3EE' : kind === 'challenge' ? '#FACC15' : '#FF6B35'
  ctx.strokeStyle =
    kind === 'routine'
      ? 'rgba(0,245,255,0.35)'
      : kind === 'challenge'
        ? 'rgba(250,204,21,0.35)'
        : 'rgba(255,107,53,0.35)'
  ctx.lineWidth = 2
  roundRect(ctx, x, y, w, innerH, 28)
  ctx.stroke()

  ctx.fillStyle = accent
  ctx.font = '700 20px Outfit, system-ui, sans-serif'
  const eyebrow =
    kind === 'routine'
      ? 'RUTINA · COMUNIDAD'
      : kind === 'challenge'
        ? 'RETO COMPLETADO'
        : 'ENTRENAMIENTO REALIZADO'
  ctx.fillText(eyebrow, x + 28, y + 42)

  const title = String(wd.name || wd.challengeTitle || 'Entrenamiento').toUpperCase()
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 48px Bebas Neue, Outfit, system-ui, sans-serif'
  const titleEnd = wrapText(ctx, title, x + 28, y + 100, w - 56, 52, 2)
  let iy = Math.max(titleEnd + 16, y + 130)

  if (kind === 'workout') {
    const boxW = (w - 56 - 24) / 3
    const boxH = 96
    ;[
      {
        value: `${wd.completedExercises ?? '—'}/${wd.totalExercises ?? wd.exercises?.length ?? '—'}`,
        label: 'Ejercicios'
      },
      { value: String(wd.totalSets ?? '—'), label: 'Series' },
      {
        value: `${Math.floor((wd.durationSeconds || 0) / 60)}m`,
        label: 'Tiempo'
      }
    ].forEach((m, i) => {
      const bx = x + 28 + i * (boxW + 12)
      ctx.fillStyle = 'rgba(10,10,15,0.55)'
      roundRect(ctx, bx, iy, boxW, boxH, 18)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 30px Outfit, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(m.value, bx + boxW / 2, iy + 42)
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '16px Outfit, system-ui, sans-serif'
      ctx.fillText(m.label, bx + boxW / 2, iy + 72)
      ctx.textAlign = 'left'
    })
    iy += boxH + 28
  } else if (kind === 'challenge') {
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = '24px Outfit, system-ui, sans-serif'
    ;[
      wd.challengeGoal != null
        ? `Meta: ${wd.challengeGoal}${wd.challengeUnit ? ` ${wd.challengeUnit}` : ''}`
        : null,
      wd.xpAwarded != null ? `+${wd.xpAwarded} XP` : null,
      wd.accumulatedMs != null
        ? `Tiempo: ${Math.floor((wd.accumulatedMs || 0) / 60000)} min`
        : null,
      wd.creatorName ? `Creador: ${wd.creatorName}` : null
    ]
      .filter(Boolean)
      .forEach((line, idx) => {
        ctx.fillText(line, x + 28, iy + idx * 36)
      })
    iy += 100
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = '24px Outfit, system-ui, sans-serif'
    ctx.fillText(
      `${wd.totalExercises || wd.exercises?.length || 0} ejercicios${
        wd.totalSets ? ` · ${wd.totalSets} series` : ''
      }`,
      x + 28,
      iy
    )
    iy += 40
  }

  if (exercises.length) {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'
    ctx.beginPath()
    ctx.moveTo(x + 28, iy)
    ctx.lineTo(x + w - 28, iy)
    ctx.stroke()
    iy += 28
    exercises.forEach((ex) => {
      ctx.fillStyle = 'rgba(255,255,255,0.78)'
      ctx.font = '22px Outfit, system-ui, sans-serif'
      ctx.fillText(String(ex.name || 'Ejercicio').slice(0, 28), x + 28, iy)
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.textAlign = 'right'
      const sets = ex.setsCompleted ?? ex.sets
      ctx.fillText(sets != null ? `${sets}×${ex.reps ?? '—'}` : '', x + w - 28, iy)
      ctx.textAlign = 'left'
      iy += 40
    })
  }

  ctx.fillStyle = accent
  ctx.font = '600 20px Outfit, system-ui, sans-serif'
  ctx.fillText(
    kind === 'routine' ? 'Tocar para ver e iniciar esta rutina' : 'Tocar para ver detalle',
    x + 28,
    y + innerH - 28
  )

  return y + innerH
}

async function drawImages(ctx, images, x, y, maxW, maxBottom) {
  const list = images.slice(0, 4)
  if (!list.length) return y
  const gap = 12
  const availH = Math.max(120, maxBottom - y - 8)

  if (list.length === 1) {
    try {
      const img = await loadImage(list[0])
      const ih = Math.min(360, availH)
      ctx.save()
      roundRect(ctx, x, y, maxW, ih, 22)
      ctx.clip()
      ctx.drawImage(img, x, y, maxW, ih)
      ctx.restore()
      return y + ih + 16
    } catch {
      return y
    }
  }

  const cols = 2
  const rows = Math.ceil(list.length / cols)
  const cellW = (maxW - gap) / cols
  const cellH = Math.min(240, (availH - gap * (rows - 1)) / rows)

  for (let i = 0; i < list.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = x + col * (cellW + gap)
    const cy = y + row * (cellH + gap)
    try {
      const img = await loadImage(list[i])
      ctx.save()
      roundRect(ctx, cx, cy, cellW, cellH, 16)
      ctx.clip()
      ctx.drawImage(img, cx, cy, cellW, cellH)
      ctx.restore()
    } catch {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      roundRect(ctx, cx, cy, cellW, cellH, 16)
      ctx.fill()
    }
  }
  return y + rows * cellH + (rows - 1) * gap + 16
}

async function drawPayloadBody(ctx, p, x, y, maxW, maxBottom) {
  const c = classifyPayload(p)
  let cy = y

  if (c.mood && MOODS[c.mood]) {
    const m = MOODS[c.mood]
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    roundRect(ctx, x, cy, maxW, 72, 20)
    ctx.fill()
    ctx.font = '36px system-ui, sans-serif'
    ctx.fillText(m.emoji, x + 22, cy + 48)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 26px Outfit, system-ui, sans-serif'
    ctx.fillText(`Estado: ${m.label}`, x + 80, cy + 46)
    cy += 90
  }

  if (c.isWorkout && cy < maxBottom - 80) {
    cy = (await drawFeatureCard(ctx, { x, y: cy, w: maxW, kind: 'workout', wd: c.wd })) + 24
  } else if (c.isRoutine && cy < maxBottom - 80) {
    cy = (await drawFeatureCard(ctx, { x, y: cy, w: maxW, kind: 'routine', wd: c.wd })) + 24
  } else if (c.isChallenge && cy < maxBottom - 80) {
    cy = (await drawFeatureCard(ctx, { x, y: cy, w: maxW, kind: 'challenge', wd: c.wd })) + 24
  }

  const badgeName = c.badge?.badgeName || c.badge?.name
  const badgeIcon = c.badge?.badgeIcon || c.badge?.icon || '🏅'
  if (badgeName && cy < maxBottom - 80) {
    ctx.fillStyle = 'rgba(234,179,8,0.16)'
    roundRect(ctx, x, cy, maxW, 120, 22)
    ctx.fill()
    ctx.strokeStyle = 'rgba(250,204,21,0.35)'
    ctx.lineWidth = 2
    roundRect(ctx, x, cy, maxW, 120, 22)
    ctx.stroke()
    ctx.font = '48px system-ui, sans-serif'
    ctx.fillText(badgeIcon, x + 28, cy + 72)
    ctx.fillStyle = '#FACC15'
    ctx.font = 'bold 30px Outfit, system-ui, sans-serif'
    ctx.fillText(String(badgeName).slice(0, 28), x + 100, cy + 55)
    ctx.fillStyle = 'rgba(255,255,255,0.65)'
    ctx.font = '20px Outfit, system-ui, sans-serif'
    ctx.fillText('Insignia desbloqueada', x + 100, cy + 88)
    cy += 140
  }

  if (c.caption && cy < maxBottom - 40) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.font = '28px Outfit, system-ui, sans-serif'
    cy = wrapText(ctx, c.caption, x, cy + 8, maxW, 38, 5) + 12
  }

  if (c.images.length && cy < maxBottom - 80) {
    cy = await drawImages(ctx, c.images, x, cy, maxW, maxBottom)
  }

  if (c.poll?.question && cy < maxBottom - 80) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    const opts = (c.poll.options || []).slice(0, 5)
    const ph = 70 + opts.length * 58 + 16
    roundRect(ctx, x, cy, maxW, ph, 22)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 26px Outfit, system-ui, sans-serif'
    let py = wrapText(ctx, c.poll.question, x + 24, cy + 40, maxW - 48, 32, 2) + 12
    opts.forEach((opt) => {
      const label = typeof opt === 'string' ? opt : opt?.text || 'Opción'
      const votes = Array.isArray(opt?.votes) ? opt.votes.length : 0
      ctx.fillStyle = 'rgba(10,10,15,0.45)'
      roundRect(ctx, x + 20, py, maxW - 40, 46, 14)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.88)'
      ctx.font = '22px Outfit, system-ui, sans-serif'
      ctx.fillText(String(label).slice(0, 36), x + 36, py + 30)
      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.textAlign = 'right'
      ctx.fillText(String(votes), x + maxW - 36, py + 30)
      ctx.textAlign = 'left'
      py += 58
    })
    cy = cy + ph + 16
  }

  // Guarantee something visible for empty/unknown posts
  if (cy <= y + 8) {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    roundRect(ctx, x, cy, maxW, 120, 20)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = '26px Outfit, system-ui, sans-serif'
    wrapText(
      ctx,
      cleanCaption(p?.content) || 'Publicación de Qyntra Gym',
      x + 28,
      cy + 52,
      maxW - 56,
      34,
      3
    )
    cy += 136
  }

  return cy
}

async function drawHeader(ctx, user, x, y, subtitle = null) {
  await drawAvatar(ctx, user, x, y, 72)
  const name = authorName(user)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 32px Outfit, system-ui, sans-serif'
  ctx.fillText(name.slice(0, 26), x + 90, y + 32)
  const badge = planOrElite(typeof user === 'object' ? user : null)
  if (badge) {
    ctx.font = '600 18px Outfit, system-ui, sans-serif'
    const bw = ctx.measureText(badge).width + 28
    ctx.fillStyle = 'rgba(168,85,247,0.22)'
    roundRect(ctx, x + 90, y + 44, bw, 32, 16)
    ctx.fill()
    ctx.fillStyle = '#C4B5FD'
    ctx.fillText(badge, x + 104, y + 66)
  } else if (subtitle) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = '18px Outfit, system-ui, sans-serif'
    ctx.fillText(subtitle, x + 90, y + 62)
  }
  return y + 100
}

/**
 * Story / WhatsApp native post share image (9:16) for ANY post type.
 */
export async function buildNativePostShareImage(post) {
  if (!post) return null

  const w = 1080
  const h = 1920
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#0A0A0F')
  bg.addColorStop(0.55, '#12121A')
  bg.addColorStop(1, '#1A120C')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = 'rgba(255,107,53,0.14)'
  ctx.beginPath()
  ctx.arc(w * 0.85, h * 0.12, 220, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,245,255,0.08)'
  ctx.beginPath()
  ctx.arc(w * 0.12, h * 0.78, 260, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = 'bold 42px Bebas Neue, Outfit, system-ui, sans-serif'
  ctx.fillText('QYNTRA GYM', 64, 110)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '22px Outfit, system-ui, sans-serif'
  ctx.fillText('Publicación de la comunidad', 64, 148)

  const cardX = 56
  const cardY = 200
  const cardW = w - 112
  const cardPad = 40
  const maxCardBottom = h - 140

  const shared = post.sharedFrom || post.shared_from || null
  const bodyEstimate =
    estimatePayloadHeight(post) +
    (shared ? 90 + estimatePayloadHeight(shared) : 0) +
    120
  const cardH = Math.min(Math.max(bodyEstimate + cardPad * 2, 420), maxCardBottom - cardY)

  ctx.fillStyle = 'rgba(20,20,28,0.96)'
  roundRect(ctx, cardX, cardY, cardW, cardH, 36)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 2
  roundRect(ctx, cardX, cardY, cardW, cardH, 36)
  ctx.stroke()

  const contentX = cardX + cardPad
  const contentW = cardW - cardPad * 2
  const contentBottom = cardY + cardH - cardPad
  let y = cardY + cardPad

  const headerUser = typeof post.user === 'object' ? post.user : { name: 'Usuario' }
  y = await drawHeader(ctx, headerUser, contentX, y)

  // Sharer caption when resharing (content of the reshare itself)
  if (shared) {
    const shareCaption = cleanCaption(post.content)
    if (shareCaption) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.font = '28px Outfit, system-ui, sans-serif'
      y = wrapText(ctx, shareCaption, contentX, y + 8, contentW, 38, 4) + 16
    }

    // Embedded original
    const embedPad = 20
    const embedH = Math.min(
      contentBottom - y - 8,
      estimatePayloadHeight(shared) + 90
    )
    ctx.fillStyle = 'rgba(255,255,255,0.04)'
    roundRect(ctx, contentX, y, contentW, embedH, 22)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 1.5
    roundRect(ctx, contentX, y, contentW, embedH, 22)
    ctx.stroke()

    let ey = y + embedPad
    const origUser = typeof shared.user === 'object' ? shared.user : { name: 'Usuario' }
    ey = await drawHeader(ctx, origUser, contentX + embedPad, ey, 'Publicación original')
    ey = await drawPayloadBody(
      ctx,
      shared,
      contentX + embedPad,
      ey,
      contentW - embedPad * 2,
      y + embedH - embedPad
    )
    y = y + embedH + 16
  } else {
    y = await drawPayloadBody(ctx, post, contentX, y, contentW, contentBottom)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '22px Outfit, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Comparte tu progreso en Qyntra Gym', w / 2, h - 80)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

export async function buildWhatsAppCard(post) {
  return buildNativePostShareImage(post)
}
