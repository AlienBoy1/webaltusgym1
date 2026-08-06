/**
 * Share card mirroring the in-app profile hero (cover, avatar, stats, level).
 */

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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function drawCover(ctx, coverUrl, x, y, w, h) {
  if (coverUrl && (String(coverUrl).startsWith('data:') || String(coverUrl).startsWith('http'))) {
    try {
      const img = await loadImage(coverUrl)
      const scale = Math.max(w / img.width, h / img.height)
      const sw = w / scale
      const sh = h / scale
      const sx = (img.width - sw) / 2
      const sy = (img.height - sh) / 2
      ctx.save()
      roundRect(ctx, x, y, w, h, 0)
      ctx.clip()
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
      ctx.restore()
      return
    } catch {
      /* gradient fallback */
    }
  }
  const g = ctx.createLinearGradient(x, y, x + w, y + h)
  g.addColorStop(0, 'rgba(255,107,53,0.55)')
  g.addColorStop(0.55, 'rgba(124,58,237,0.28)')
  g.addColorStop(1, 'rgba(0,245,255,0.22)')
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
}

async function drawAvatar(ctx, avatar, name, cx, cy, size) {
  const x = cx - size / 2
  const y = cy - size / 2
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2 + 6, 0, Math.PI * 2)
  ctx.fillStyle = '#14141C'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
  ctx.closePath()
  ctx.clip()
  if (avatar && (String(avatar).startsWith('data:') || String(avatar).startsWith('http'))) {
    try {
      const img = await loadImage(avatar)
      ctx.drawImage(img, x, y, size, size)
      ctx.restore()
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
  ctx.fillText((name.charAt(0) || 'Q').toUpperCase(), cx, cy + 1)
  ctx.restore()
}

function planLabel(user) {
  const level = user?.stats?.level || 0
  if (level >= 10) return 'Elite'
  const plan = user?.membership?.plan
  if (!plan) return 'Básico'
  return String(plan).charAt(0).toUpperCase() + String(plan).slice(1)
}

/**
 * @param {object} user - auth / profile user
 * @returns {Promise<string|null>} data URL png
 */
export async function buildNativeProfileShareImage(user) {
  if (!user) return null

  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#0A0A0F')
  bg.addColorStop(0.5, '#12121A')
  bg.addColorStop(1, '#0E0E16')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Soft orbs
  ctx.fillStyle = 'rgba(255,107,53,0.08)'
  ctx.beginPath()
  ctx.arc(180, 220, 220, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,245,255,0.06)'
  ctx.beginPath()
  ctx.arc(900, 1100, 280, 0, Math.PI * 2)
  ctx.fill()

  const cardX = 64
  const cardY = 80
  const cardW = W - 128
  const cardH = H - 200

  // Card
  ctx.fillStyle = 'rgba(22,22,30,0.96)'
  roundRect(ctx, cardX, cardY, cardW, cardH, 36)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 2
  roundRect(ctx, cardX, cardY, cardW, cardH, 36)
  ctx.stroke()

  // Clip card for cover
  ctx.save()
  roundRect(ctx, cardX, cardY, cardW, cardH, 36)
  ctx.clip()

  const coverH = 340
  await drawCover(ctx, user?.profile?.coverUrl, cardX, cardY, cardW, coverH)

  // Cover blend into card
  const blend = ctx.createLinearGradient(0, cardY + coverH * 0.35, 0, cardY + coverH + 40)
  blend.addColorStop(0, 'rgba(22,22,30,0)')
  blend.addColorStop(0.55, 'rgba(22,22,30,0.55)')
  blend.addColorStop(1, 'rgba(22,22,30,1)')
  ctx.fillStyle = blend
  ctx.fillRect(cardX, cardY + coverH * 0.35, cardW, coverH * 0.65 + 40)
  ctx.restore()

  const name = String(user?.name || 'Usuario')
  const avatarCy = cardY + coverH - 8
  await drawAvatar(ctx, user?.avatar, name, W / 2, avatarCy, 168)

  // Brand eyebrow
  ctx.textAlign = 'center'
  ctx.fillStyle = '#FF6B35'
  ctx.font = '700 22px Outfit, system-ui, sans-serif'
  ctx.fillText('PERFIL · QYNTRA GYM', W / 2, avatarCy + 120)

  // Name
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 52px Outfit, system-ui, sans-serif'
  const displayName = name.length > 28 ? `${name.slice(0, 27)}…` : name
  ctx.fillText(displayName, W / 2, avatarCy + 184)

  // Plan pill
  const plan = planLabel(user)
  ctx.font = '600 24px Outfit, system-ui, sans-serif'
  const planW = ctx.measureText(plan).width + 48
  const planX = W / 2 - planW / 2
  const planY = avatarCy + 210
  ctx.fillStyle = 'rgba(168,85,247,0.22)'
  roundRect(ctx, planX, planY, planW, 44, 22)
  ctx.fill()
  ctx.strokeStyle = 'rgba(168,85,247,0.4)'
  ctx.lineWidth = 1.5
  roundRect(ctx, planX, planY, planW, 44, 22)
  ctx.stroke()
  ctx.fillStyle = '#C084FC'
  ctx.fillText(plan, W / 2, planY + 30)

  // Stats
  const level = user?.stats?.level || 1
  const workouts = user?.stats?.totalWorkouts || 0
  const streak = user?.stats?.longestStreak || 0
  const xpTotal = user?.stats?.xp || 0
  const xpInto = xpTotal % 100

  const statsY = planY + 90
  const stats = [
    { label: 'Entrenamientos', value: String(workouts) },
    { label: 'Días activo', value: String(streak) },
    { label: 'Nivel', value: String(level) }
  ]
  const slotW = (cardW - 72) / 3
  stats.forEach((s, i) => {
    const sx = cardX + 36 + i * slotW
    ctx.fillStyle = 'rgba(10,10,15,0.45)'
    roundRect(ctx, sx + 8, statsY, slotW - 16, 130, 20)
    ctx.fill()
    ctx.fillStyle = '#FF6B35'
    ctx.font = 'bold 44px Outfit, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(s.value, sx + slotW / 2, statsY + 62)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = '22px Outfit, system-ui, sans-serif'
    ctx.fillText(s.label, sx + slotW / 2, statsY + 100)
  })

  // XP bar
  const barY = statsY + 170
  const barX = cardX + 48
  const barW = cardW - 96
  ctx.textAlign = 'left'
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 26px Outfit, system-ui, sans-serif'
  ctx.fillText(`Nivel ${level}`, barX, barY)
  ctx.textAlign = 'right'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '22px Outfit, system-ui, sans-serif'
  ctx.fillText(`${xpTotal.toLocaleString('es-ES')} XP`, barX + barW, barY)

  const trackY = barY + 24
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, barX, trackY, barW, 18, 9)
  ctx.fill()
  const fillW = Math.max(12, (Math.min(100, xpInto) / 100) * barW)
  const barGrad = ctx.createLinearGradient(barX, trackY, barX + fillW, trackY)
  barGrad.addColorStop(0, '#FACC15')
  barGrad.addColorStop(1, '#FF6B35')
  ctx.fillStyle = barGrad
  roundRect(ctx, barX, trackY, fillW, 18, 9)
  ctx.fill()

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '20px Outfit, system-ui, sans-serif'
  ctx.fillText(`${xpInto} / 100 XP en este nivel`, barX, trackY + 48)

  // Footer CTA on image
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,107,53,0.9)'
  ctx.font = '600 24px Outfit, system-ui, sans-serif'
  ctx.fillText('Únete a mí en Qyntra Gym', W / 2, cardY + cardH - 48)

  // Outer brand mark
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '600 22px Outfit, system-ui, sans-serif'
  ctx.fillText('Qyntra Gym', W / 2, H - 48)

  return canvas.toDataURL('image/png')
}
