/**
 * Builds a 9:16 share image that mirrors ANY Social post type
 * (text, mood, poll, images, badge, workout, routine, challenge, reshare).
 * Uses the live app theme (light/dark + brand colors).
 */

import { getShareThemePalette } from './shareThemePalette'

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

/** @type {ReturnType<typeof getShareThemePalette>} */
let P = getShareThemePalette('dark')

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
  ctx.fillStyle = P.avatarFallback
  ctx.fillRect(x, y, size, size)
  ctx.fillStyle = P.primary
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

function featureAccent(kind) {
  if (kind === 'routine') return P.accent
  if (kind === 'challenge') return '#FACC15'
  return P.primary
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

  const light = P.mode === 'light'
  const ig = ctx.createLinearGradient(x, y, x + w, y + innerH)
  if (kind === 'routine') {
    ig.addColorStop(0, `rgba(${P.accentRgb},${light ? 0.16 : 0.18})`)
    ig.addColorStop(1, `rgba(${P.primaryRgb},${light ? 0.1 : 0.12})`)
  } else if (kind === 'challenge') {
    ig.addColorStop(0, light ? 'rgba(250,204,21,0.22)' : 'rgba(250,204,21,0.16)')
    ig.addColorStop(1, `rgba(${P.primaryRgb},${light ? 0.12 : 0.14})`)
  } else {
    ig.addColorStop(0, `rgba(${P.primaryRgb},${light ? 0.18 : 0.22})`)
    ig.addColorStop(0.55, light ? 'rgba(168,85,247,0.1)' : 'rgba(124,58,237,0.12)')
    ig.addColorStop(1, `rgba(${P.accentRgb},${light ? 0.12 : 0.14})`)
  }
  ctx.fillStyle = ig
  roundRect(ctx, x, y, w, innerH, 28)
  ctx.fill()

  const accent = featureAccent(kind)
  ctx.strokeStyle =
    kind === 'routine'
      ? `rgba(${P.accentRgb},0.35)`
      : kind === 'challenge'
        ? 'rgba(250,204,21,0.35)'
        : `rgba(${P.primaryRgb},0.35)`
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
  ctx.fillStyle = P.featureTitle
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
      ctx.fillStyle = P.featureInset
      roundRect(ctx, bx, iy, boxW, boxH, 18)
      ctx.fill()
      ctx.fillStyle = P.featureInsetText
      ctx.font = 'bold 30px Outfit, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(m.value, bx + boxW / 2, iy + 42)
      ctx.fillStyle = P.featureInsetMuted
      ctx.font = '16px Outfit, system-ui, sans-serif'
      ctx.fillText(m.label, bx + boxW / 2, iy + 72)
      ctx.textAlign = 'left'
    })
    iy += boxH + 28
  } else if (kind === 'challenge') {
    ctx.fillStyle = P.featureMeta
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
    ctx.fillStyle = P.featureMeta
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
    ctx.strokeStyle = P.featureRule
    ctx.beginPath()
    ctx.moveTo(x + 28, iy)
    ctx.lineTo(x + w - 28, iy)
    ctx.stroke()
    iy += 28
    exercises.forEach((ex) => {
      ctx.fillStyle = P.textSoft
      ctx.font = '22px Outfit, system-ui, sans-serif'
      ctx.fillText(String(ex.name || 'Ejercicio').slice(0, 28), x + 28, iy)
      ctx.fillStyle = P.textFaint
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

/**
 * Draw image letterboxed (object-fit: contain) inside a rounded rect.
 * Never stretches; empty bands use a soft brand-tinted fill.
 */
function drawImageContained(ctx, img, dx, dy, dw, dh, radius = 16) {
  const nw = img.naturalWidth || img.width || 1
  const nh = img.naturalHeight || img.height || 1
  ctx.save()
  roundRect(ctx, dx, dy, dw, dh, radius)
  ctx.clip()
  // Elegant letterbox bands
  const g = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh)
  g.addColorStop(0, P.surface || 'rgba(20,20,28,0.95)')
  g.addColorStop(1, `rgba(${P.primaryRgb || '255,107,53'},0.08)`)
  ctx.fillStyle = g
  ctx.fillRect(dx, dy, dw, dh)

  const scale = Math.min(dw / nw, dh / nh)
  const iw = nw * scale
  const ih = nh * scale
  const ix = dx + (dw - iw) / 2
  const iy = dy + (dh - ih) / 2
  ctx.drawImage(img, ix, iy, iw, ih)
  ctx.restore()
}

async function drawImages(ctx, images, x, y, maxW, maxBottom) {
  const list = images.slice(0, 4)
  if (!list.length) return y
  const gap = 12
  const availH = Math.max(140, maxBottom - y - 8)

  if (list.length === 1) {
    try {
      const img = await loadImage(list[0])
      const nw = img.naturalWidth || img.width || 1
      const nh = img.naturalHeight || img.height || 1
      const aspect = nw / Math.max(1, nh)
      // Frame height follows natural ratio, clamped to available space
      let boxH = maxW / aspect
      boxH = Math.min(availH, Math.max(180, Math.min(boxH, 520)))
      drawImageContained(ctx, img, x, y, maxW, boxH, 22)
      return y + boxH + 16
    } catch {
      return y
    }
  }

  const cols = 2
  const rows = Math.ceil(list.length / cols)
  const cellW = (maxW - gap) / cols
  const cellH = Math.min(260, (availH - gap * (rows - 1)) / rows)

  for (let i = 0; i < list.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = x + col * (cellW + gap)
    const cy = y + row * (cellH + gap)
    try {
      const img = await loadImage(list[i])
      drawImageContained(ctx, img, cx, cy, cellW, cellH, 16)
    } catch {
      ctx.fillStyle = P.surface
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
    ctx.fillStyle = P.surface
    roundRect(ctx, x, cy, maxW, 72, 20)
    ctx.fill()
    ctx.font = '36px system-ui, sans-serif'
    ctx.fillText(m.emoji, x + 22, cy + 48)
    ctx.fillStyle = P.text
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
    ctx.fillStyle = P.badgeBg
    roundRect(ctx, x, cy, maxW, 120, 22)
    ctx.fill()
    ctx.strokeStyle = P.badgeBorder
    ctx.lineWidth = 2
    roundRect(ctx, x, cy, maxW, 120, 22)
    ctx.stroke()
    ctx.font = '48px system-ui, sans-serif'
    ctx.fillText(badgeIcon, x + 28, cy + 72)
    ctx.fillStyle = P.badgeText
    ctx.font = 'bold 30px Outfit, system-ui, sans-serif'
    ctx.fillText(String(badgeName).slice(0, 28), x + 100, cy + 55)
    ctx.fillStyle = P.textSoft
    ctx.font = '20px Outfit, system-ui, sans-serif'
    ctx.fillText('Insignia desbloqueada', x + 100, cy + 88)
    cy += 140
  }

  if (c.caption && cy < maxBottom - 40) {
    ctx.fillStyle = P.text
    ctx.font = '28px Outfit, system-ui, sans-serif'
    cy = wrapText(ctx, c.caption, x, cy + 8, maxW, 38, 5) + 12
  }

  if (c.images.length && cy < maxBottom - 80) {
    cy = await drawImages(ctx, c.images, x, cy, maxW, maxBottom)
  }

  if (c.poll?.question && cy < maxBottom - 80) {
    ctx.fillStyle = P.surface
    const opts = (c.poll.options || []).slice(0, 5)
    const ph = 70 + opts.length * 58 + 16
    roundRect(ctx, x, cy, maxW, ph, 22)
    ctx.fill()
    ctx.fillStyle = P.text
    ctx.font = 'bold 26px Outfit, system-ui, sans-serif'
    let py = wrapText(ctx, c.poll.question, x + 24, cy + 40, maxW - 48, 32, 2) + 12
    opts.forEach((opt) => {
      const label = typeof opt === 'string' ? opt : opt?.text || 'Opción'
      const votes = Array.isArray(opt?.votes) ? opt.votes.length : 0
      ctx.fillStyle = P.inset
      roundRect(ctx, x + 20, py, maxW - 40, 46, 14)
      ctx.fill()
      ctx.fillStyle = P.textSoft
      ctx.font = '22px Outfit, system-ui, sans-serif'
      ctx.fillText(String(label).slice(0, 36), x + 36, py + 30)
      ctx.fillStyle = P.textFaint
      ctx.textAlign = 'right'
      ctx.fillText(String(votes), x + maxW - 36, py + 30)
      ctx.textAlign = 'left'
      py += 58
    })
    cy = cy + ph + 16
  }

  if (cy <= y + 8) {
    ctx.fillStyle = P.surface
    roundRect(ctx, x, cy, maxW, 120, 20)
    ctx.fill()
    ctx.fillStyle = P.textSoft
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
  ctx.fillStyle = P.text
  ctx.font = 'bold 32px Outfit, system-ui, sans-serif'
  ctx.fillText(name.slice(0, 26), x + 90, y + 32)
  const badge = planOrElite(typeof user === 'object' ? user : null)
  if (badge) {
    ctx.font = '600 18px Outfit, system-ui, sans-serif'
    const bw = ctx.measureText(badge).width + 28
    ctx.fillStyle = P.eliteBg
    roundRect(ctx, x + 90, y + 44, bw, 32, 16)
    ctx.fill()
    ctx.fillStyle = P.eliteText
    ctx.fillText(badge, x + 104, y + 66)
  } else if (subtitle) {
    ctx.fillStyle = P.textFaint
    ctx.font = '18px Outfit, system-ui, sans-serif'
    ctx.fillText(subtitle, x + 90, y + 62)
  }
  return y + 100
}

function drawStageBackground(ctx, w, h) {
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, P.bg0)
  bg.addColorStop(0.5, P.bg1)
  bg.addColorStop(1, P.bg2)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = P.brandOrb
  ctx.beginPath()
  ctx.arc(w * 0.82, h * 0.18, 260, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = P.accentOrb
  ctx.beginPath()
  ctx.arc(w * 0.14, h * 0.78, 300, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(${P.primaryRgb},${P.mode === 'light' ? 0.06 : 0.1})`
  ctx.beginPath()
  ctx.arc(w * 0.5, h * 0.45, 420, 0, Math.PI * 2)
  ctx.fill()
}

function drawPhoneChrome(ctx, phone) {
  const { x, y, w, h, bezel, radius } = phone
  const light = P.mode === 'light'

  // Drop shadow
  ctx.save()
  ctx.shadowColor = light ? 'rgba(16,16,24,0.22)' : 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 55
  ctx.shadowOffsetY = 28
  const bezelGrad = ctx.createLinearGradient(x, y, x + w, y + h)
  if (light) {
    bezelGrad.addColorStop(0, '#F4F4F5')
    bezelGrad.addColorStop(0.36, '#D4D4D8')
    bezelGrad.addColorStop(0.68, '#E4E4E7')
    bezelGrad.addColorStop(1, '#A1A1AA')
  } else {
    bezelGrad.addColorStop(0, '#2A2A32')
    bezelGrad.addColorStop(0.38, '#121218')
    bezelGrad.addColorStop(0.72, '#1C1C24')
    bezelGrad.addColorStop(1, '#0C0C10')
  }
  ctx.fillStyle = bezelGrad
  roundRect(ctx, x, y, w, h, radius)
  ctx.fill()
  ctx.restore()

  // Brand rim
  ctx.strokeStyle = `rgba(${P.primaryRgb},0.28)`
  ctx.lineWidth = 3
  roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, radius - 1)
  ctx.stroke()

  // Side buttons
  const btnGrad = light
    ? ['#E4E4E7', '#A1A1AA', '#71717A']
    : ['#4A4A54', '#1A1A22', '#2E2E36']
  const drawBtn = (bx, by, bw, bh) => {
    const g = ctx.createLinearGradient(bx, by, bx, by + bh)
    g.addColorStop(0, btnGrad[0])
    g.addColorStop(0.55, btnGrad[1])
    g.addColorStop(1, btnGrad[2])
    ctx.fillStyle = g
    roundRect(ctx, bx, by, bw, bh, 2)
    ctx.fill()
  }
  drawBtn(x - 6, y + h * 0.18, 6, 36) // silent
  drawBtn(x - 6, y + h * 0.28, 6, 70) // vol up
  drawBtn(x - 6, y + h * 0.36, 6, 70) // vol down
  drawBtn(x + w, y + h * 0.3, 6, 100) // power

  // Screen
  const sx = x + bezel
  const sy = y + bezel
  const sw = w - bezel * 2
  const sh = h - bezel * 2
  const sr = Math.max(28, radius - 14)

  ctx.fillStyle = P.bg0
  roundRect(ctx, sx, sy, sw, sh, sr)
  ctx.fill()
  ctx.strokeStyle = light ? 'rgba(15,15,20,0.08)' : 'rgba(255,255,255,0.05)'
  ctx.lineWidth = 1
  roundRect(ctx, sx, sy, sw, sh, sr)
  ctx.stroke()

  return { sx, sy, sw, sh, sr }
}

function drawDynamicIsland(ctx, sx, sy, sw) {
  const iw = 150
  const ih = 36
  const ix = sx + (sw - iw) / 2
  const iy = sy + 18
  ctx.fillStyle = '#050508'
  roundRect(ctx, ix, iy, iw, ih, 18)
  ctx.fill()
  // speaker
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  roundRect(ctx, ix + 36, iy + 14, 42, 8, 4)
  ctx.fill()
  // lens
  ctx.beginPath()
  ctx.arc(ix + iw - 28, iy + ih / 2, 6, 0, Math.PI * 2)
  ctx.fillStyle = '#1a2744'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(ix + iw - 28, iy + ih / 2, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#3b82f6'
  ctx.fill()
}

function drawStatusBar(ctx, sx, sy, sw) {
  const y = sy + 78
  ctx.fillStyle = P.text
  ctx.font = '600 22px Outfit, system-ui, sans-serif'
  ctx.textAlign = 'left'
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  ctx.fillText(time, sx + 28, y)

  ctx.textAlign = 'center'
  ctx.fillStyle = P.primary
  ctx.font = '700 16px Outfit, system-ui, sans-serif'
  ctx.fillText('QYNTRA', sx + sw / 2, y)

  // signal + battery stubs
  ctx.textAlign = 'left'
  const rx = sx + sw - 28
  ctx.fillStyle = P.text
  for (let i = 0; i < 4; i++) {
    const bh = 6 + i * 3
    ctx.fillRect(rx - 78 + i * 7, y - bh + 2, 5, bh)
  }
  ctx.strokeStyle = P.text
  ctx.lineWidth = 1.5
  roundRect(ctx, rx - 42, y - 12, 30, 14, 3)
  ctx.stroke()
  ctx.fillStyle = P.primary
  ctx.fillRect(rx - 39, y - 9, 20, 8)
  ctx.fillStyle = P.text
  ctx.fillRect(rx - 12, y - 8, 3, 6)
}

function drawHomeIndicator(ctx, sx, sy, sw, sh) {
  const hw = 140
  const hh = 6
  ctx.fillStyle = P.mode === 'light' ? 'rgba(15,15,20,0.28)' : 'rgba(255,255,255,0.35)'
  roundRect(ctx, sx + (sw - hw) / 2, sy + sh - 28, hw, hh, 3)
  ctx.fill()
}

function getLikesCount(post) {
  if (Array.isArray(post?.likes)) return post.likes.length
  return Number(post?.likesCount) || 0
}

function getCommentsCount(post) {
  if (Array.isArray(post?.comments)) return post.comments.length
  return Number(post?.commentsCount) || 0
}

function getStackedReactions(post) {
  const summary = Array.isArray(post?.reactionSummary) ? post.reactionSummary : []
  const stacked = summary
    .filter((r) => r?.emoji && r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
  if (stacked.length) return stacked
  const likes = getLikesCount(post)
  if (likes > 0) return [{ emoji: '❤️', count: likes }]
  return []
}

function drawQyntraAppIcon(ctx, x, y, size) {
  const r = size * 0.28
  const grad = ctx.createLinearGradient(x, y, x + size, y + size)
  grad.addColorStop(0, P.primary)
  grad.addColorStop(1, `rgba(${P.primaryRgb},0.72)`)
  ctx.fillStyle = grad
  roundRect(ctx, x, y, size, size, size * 0.22)
  ctx.fill()

  const cx = x + size * 0.46
  const cy = y + size * 0.46
  const radius = size * 0.22
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = Math.max(4, size * 0.1)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + size * 0.54, y + size * 0.58)
  ctx.lineTo(x + size * 0.78, y + size * 0.82)
  ctx.stroke()
  ctx.globalAlpha = 0.55
  ctx.lineWidth = Math.max(2, size * 0.04)
  ctx.beginPath()
  ctx.moveTo(x + size * 0.34, y + size * 0.3)
  ctx.lineTo(x + size * 0.42, y + size * 0.22)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawIconHeart(ctx, x, y, size, filled) {
  const s = size
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = filled ? '#EF4444' : P.textSecondary
  ctx.fillStyle = filled ? '#EF4444' : 'transparent'
  ctx.lineWidth = Math.max(2.2, s * 0.09)
  ctx.lineJoin = 'round'
  ctx.beginPath()
  // Feather-like heart outline
  const w = s
  const h = s
  ctx.moveTo(w * 0.5, h * 0.88)
  ctx.bezierCurveTo(w * 0.12, h * 0.62, w * 0.02, h * 0.36, w * 0.28, h * 0.2)
  ctx.bezierCurveTo(w * 0.4, h * 0.12, w * 0.5, h * 0.22, w * 0.5, h * 0.32)
  ctx.bezierCurveTo(w * 0.5, h * 0.22, w * 0.6, h * 0.12, w * 0.72, h * 0.2)
  ctx.bezierCurveTo(w * 0.98, h * 0.36, w * 0.88, h * 0.62, w * 0.5, h * 0.88)
  ctx.closePath()
  if (filled) ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function drawIconComment(ctx, x, y, size) {
  const s = size
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = P.textSecondary
  ctx.lineWidth = Math.max(2.2, s * 0.09)
  ctx.lineJoin = 'round'
  roundRect(ctx, s * 0.1, s * 0.12, s * 0.8, s * 0.58, s * 0.18)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(s * 0.32, s * 0.7)
  ctx.lineTo(s * 0.28, s * 0.9)
  ctx.lineTo(s * 0.5, s * 0.72)
  ctx.stroke()
  ctx.restore()
}

function drawIconShare(ctx, x, y, size) {
  const s = size
  ctx.save()
  ctx.translate(x, y)
  ctx.strokeStyle = P.textSecondary
  ctx.lineWidth = Math.max(2.2, s * 0.09)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // nodes
  const r = s * 0.11
  ctx.beginPath()
  ctx.arc(s * 0.72, s * 0.28, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(s * 0.28, s * 0.5, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(s * 0.72, s * 0.72, r, 0, Math.PI * 2)
  ctx.stroke()
  // links
  ctx.beginPath()
  ctx.moveTo(s * 0.36, s * 0.46)
  ctx.lineTo(s * 0.64, s * 0.32)
  ctx.moveTo(s * 0.36, s * 0.54)
  ctx.lineTo(s * 0.64, s * 0.68)
  ctx.stroke()
  ctx.restore()
}

function drawPostActions(ctx, post, x, y, w) {
  // Top rule
  ctx.strokeStyle = P.border
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w, y)
  ctx.stroke()

  const rowY = y + 22
  const icon = 30
  const likes = getLikesCount(post)
  const comments = getCommentsCount(post)
  const stacked = getStackedReactions(post)
  const liked = likes > 0 || Boolean(post?.myReaction)

  drawIconHeart(ctx, x, rowY, icon, liked)
  ctx.fillStyle = liked ? P.primary : P.textSecondary
  ctx.font = '600 24px Outfit, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(likes), x + icon + 10, rowY + icon / 2)

  // Stacked reaction chips (real app reaction emojis)
  let chipX = x + icon + 10 + ctx.measureText(String(likes)).width + 16
  stacked.forEach((r) => {
    ctx.beginPath()
    ctx.arc(chipX + 15, rowY + icon / 2, 16, 0, Math.PI * 2)
    ctx.fillStyle = P.card
    ctx.fill()
    ctx.strokeStyle = P.border
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.font = '18px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(r.emoji, chipX + 15, rowY + icon / 2 + 1)
    chipX += 24
  })

  const commentX = Math.max(chipX + 18, x + 210)
  drawIconComment(ctx, commentX, rowY, icon)
  ctx.fillStyle = P.textSecondary
  ctx.font = '600 24px Outfit, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(comments), commentX + icon + 10, rowY + icon / 2)

  drawIconShare(ctx, x + w - icon, rowY, icon)
  ctx.textBaseline = 'alphabetic'
}

function drawInviteBanner(ctx, x, y, w, h) {
  ctx.fillStyle = P.cardFill
  roundRect(ctx, x, y, w, h, 24)
  ctx.fill()
  ctx.strokeStyle = `rgba(${P.primaryRgb},0.28)`
  ctx.lineWidth = 2
  roundRect(ctx, x, y, w, h, 24)
  ctx.stroke()

  const icon = 64
  const iconX = x + 22
  const iconY = y + (h - icon) / 2
  drawQyntraAppIcon(ctx, iconX, iconY, icon)

  const tx = iconX + icon + 18
  ctx.fillStyle = P.primary
  ctx.font = '700 18px Outfit, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('QYNTRA GYM', tx, y + h * 0.38)

  ctx.fillStyle = P.text
  ctx.font = '600 24px Outfit, system-ui, sans-serif'
  ctx.fillText('Únete a la comunidad', tx, y + h * 0.62)

  ctx.fillStyle = P.textFaint
  ctx.font = '18px Outfit, system-ui, sans-serif'
  ctx.fillText('Entrena · Progresa · Comparte', tx, y + h * 0.82)
}

async function drawFeedPost(ctx, post, x, y, maxW, maxBottom) {
  const pad = 28
  const actionsH = 72
  const cardX = x
  const cardY = y
  const cardW = maxW

  const shared = post.sharedFrom || post.shared_from || null
  const bodyEstimate =
    estimatePayloadHeight(post) +
    (shared ? 90 + estimatePayloadHeight(shared) : 0) +
    100 +
    actionsH
  const cardH = Math.min(Math.max(bodyEstimate + pad * 2, 320), maxBottom - cardY)

  // Feed card surface
  ctx.fillStyle = P.cardFill
  roundRect(ctx, cardX, cardY, cardW, cardH, 28)
  ctx.fill()
  ctx.strokeStyle = P.border
  ctx.lineWidth = 2
  roundRect(ctx, cardX, cardY, cardW, cardH, 28)
  ctx.stroke()

  const contentX = cardX + pad
  const contentW = cardW - pad * 2
  const contentBottom = cardY + cardH - pad - actionsH
  let cy = cardY + pad

  const headerUser = typeof post.user === 'object' ? post.user : { name: 'Usuario' }
  cy = await drawHeader(ctx, headerUser, contentX, cy)

  if (shared) {
    const shareCaption = cleanCaption(post.content)
    if (shareCaption) {
      ctx.fillStyle = P.text
      ctx.font = '26px Outfit, system-ui, sans-serif'
      cy = wrapText(ctx, shareCaption, contentX, cy + 6, contentW, 34, 3) + 12
    }
    const embedPad = 16
    const embedH = Math.min(contentBottom - cy - 8, estimatePayloadHeight(shared) + 80)
    ctx.fillStyle = P.embedBg
    roundRect(ctx, contentX, cy, contentW, embedH, 18)
    ctx.fill()
    ctx.strokeStyle = P.embedBorder
    ctx.lineWidth = 1.5
    roundRect(ctx, contentX, cy, contentW, embedH, 18)
    ctx.stroke()
    let ey = cy + embedPad
    const origUser = typeof shared.user === 'object' ? shared.user : { name: 'Usuario' }
    ey = await drawHeader(ctx, origUser, contentX + embedPad, ey, 'Publicación original')
    await drawPayloadBody(
      ctx,
      shared,
      contentX + embedPad,
      ey,
      contentW - embedPad * 2,
      cy + embedH - embedPad
    )
  } else {
    await drawPayloadBody(ctx, post, contentX, cy, contentW, contentBottom)
  }

  drawPostActions(ctx, post, contentX, cardY + cardH - pad - actionsH + 8, contentW)

  return cardY + cardH
}

/**
 * Story / WhatsApp native post share image (9:16).
 * Phone-frame stage (like login) with a single community-feed post centered inside.
 * @param {object} post
 * @param {{ theme?: 'light'|'dark' }} [options]
 */
export async function buildNativePostShareImage(post, options = {}) {
  if (!post) return null
  P = getShareThemePalette(options.theme)

  const w = 1080
  const h = 1920
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  drawStageBackground(ctx, w, h)

  // Centered phone (login-like proportions)
  const phoneW = 860
  const phoneH = 1640
  const phoneX = (w - phoneW) / 2
  const phoneY = (h - phoneH) / 2 - 10
  const phone = { x: phoneX, y: phoneY, w: phoneW, h: phoneH, bezel: 18, radius: 72 }

  const screen = drawPhoneChrome(ctx, phone)
  const { sx, sy, sw, sh } = screen

  // Clip screen contents
  ctx.save()
  roundRect(ctx, sx, sy, sw, sh, Math.max(28, phone.radius - 14))
  ctx.clip()

  // Soft screen atmosphere
  ctx.fillStyle = P.bg0
  ctx.fillRect(sx, sy, sw, sh)
  ctx.fillStyle = P.brandOrb
  ctx.beginPath()
  ctx.arc(sx + sw * 0.85, sy + 120, 140, 0, Math.PI * 2)
  ctx.fill()

  drawDynamicIsland(ctx, sx, sy, sw)
  drawStatusBar(ctx, sx, sy, sw)

  // Community header
  const headerTop = sy + 110
  ctx.fillStyle = P.primary
  ctx.font = '700 18px Outfit, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('COMUNIDAD', sx + 32, headerTop)

  ctx.fillStyle = P.text
  ctx.font = 'bold 36px Outfit, system-ui, sans-serif'
  ctx.fillText('Feed', sx + 32, headerTop + 40)

  // Chips
  const chipY = headerTop + 58
  const chips = ['Gym OS', 'Training+']
  let chipX = sx + 32
  chips.forEach((label, i) => {
    ctx.font = '600 16px Outfit, system-ui, sans-serif'
    const cw = ctx.measureText(label).width + 28
    ctx.fillStyle = i === 0 ? `rgba(${P.primaryRgb},0.16)` : `rgba(${P.accentRgb},0.14)`
    roundRect(ctx, chipX, chipY, cw, 32, 16)
    ctx.fill()
    ctx.fillStyle = i === 0 ? P.primary : P.accent
    ctx.fillText(label, chipX + 14, chipY + 22)
    chipX += cw + 10
  })

  // Feed area: post + invite CTA at bottom
  const feedTop = chipY + 52
  const feedBottom = sy + sh - 56
  const feedPadX = 28
  const feedW = sw - feedPadX * 2
  const inviteH = 118
  const inviteGap = 20
  const postAreaBottom = feedBottom - inviteH - inviteGap

  const shared = post.sharedFrom || post.shared_from || null
  const estimated =
    estimatePayloadHeight(post) +
    (shared ? 90 + estimatePayloadHeight(shared) : 0) +
    220
  const avail = postAreaBottom - feedTop
  const postH = Math.min(Math.max(estimated, 340), avail)
  const postY = feedTop + Math.max(0, (avail - postH) / 2)

  await drawFeedPost(ctx, post, sx + feedPadX, postY, feedW, postY + postH)
  drawInviteBanner(ctx, sx + feedPadX, feedBottom - inviteH, feedW, inviteH)

  drawHomeIndicator(ctx, sx, sy, sw, sh)
  ctx.restore()

  // Caption under phone
  ctx.fillStyle = P.textFaint
  ctx.font = '600 24px Outfit, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Qyntra Gym · Comunidad', w / 2, phoneY + phoneH + 52)
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/png')
}

export async function buildWhatsAppCard(post, options) {
  return buildNativePostShareImage(post, options)
}
