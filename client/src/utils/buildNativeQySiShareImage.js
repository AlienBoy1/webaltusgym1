/**
 * Premium native share art for QySi profile promotion (story + external).
 * Theme-aware via getShareThemePalette.
 */

import { getShareThemePalette } from './shareThemePalette'
import { QISI_HANDLE, QISI_MEANING, QISI_NAME } from './qisi'

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function wrapCentered(ctx, text, cx, y, maxWidth, lineHeight, maxLines = 4) {
  const words = String(text || '')
    .split(/\s+/)
    .filter(Boolean)
  let line = ''
  let cy = y
  let lines = 0
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, cy)
      line = words[i]
      cy += lineHeight
      lines += 1
      if (lines >= maxLines - 1) {
        let rest = words.slice(i).join(' ')
        while (ctx.measureText(`${rest}…`).width > maxWidth && rest.length > 1) {
          rest = rest.slice(0, -1)
        }
        ctx.fillText(`${rest}…`, cx, cy)
        return cy + lineHeight
      }
    } else {
      line = test
    }
  }
  if (line) {
    ctx.fillText(line, cx, cy)
    cy += lineHeight
  }
  return cy
}

async function loadAvatar(src) {
  if (!src || typeof Image === 'undefined') return null
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * @param {{ mode?: 'story'|'external', sharerName?: string, avatarSrc?: string }} opts
 * @returns {Promise<string|null>} data URL
 */
export async function buildNativeQySiShareImage(opts = {}) {
  const mode = opts.mode === 'external' ? 'external' : 'story'
  const palette = getShareThemePalette()
  const { primary, accent, primaryRgb, accentRgb, bg0, bg1, text, textSecondary, card } = palette

  const W = mode === 'story' ? 1080 : 1080
  const H = mode === 'story' ? 1920 : 1350

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, bg0)
  bg.addColorStop(0.55, bg1)
  bg.addColorStop(1, `rgba(${primaryRgb},0.22)`)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Orbs
  const orb1 = ctx.createRadialGradient(W * 0.2, H * 0.18, 20, W * 0.2, H * 0.18, W * 0.45)
  orb1.addColorStop(0, `rgba(${primaryRgb},0.4)`)
  orb1.addColorStop(1, 'transparent')
  ctx.fillStyle = orb1
  ctx.fillRect(0, 0, W, H)

  const orb2 = ctx.createRadialGradient(W * 0.85, H * 0.78, 10, W * 0.85, H * 0.78, W * 0.4)
  orb2.addColorStop(0, `rgba(${accentRgb},0.28)`)
  orb2.addColorStop(1, 'transparent')
  ctx.fillStyle = orb2
  ctx.fillRect(0, 0, W, H)

  // Grid
  ctx.save()
  ctx.globalAlpha = 0.08
  ctx.strokeStyle = text
  ctx.lineWidth = 1
  for (let x = 40; x < W; x += 48) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, H)
    ctx.stroke()
  }
  for (let y = 40; y < H; y += 48) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.restore()

  // Card
  const cardX = 72
  const cardY = mode === 'story' ? 280 : 120
  const cardW = W - cardX * 2
  const cardH = mode === 'story' ? 1180 : 980
  ctx.fillStyle = card
  roundRect(ctx, cardX, cardY, cardW, cardH, 48)
  ctx.fill()
  ctx.strokeStyle = `rgba(${primaryRgb},0.35)`
  ctx.lineWidth = 3
  roundRect(ctx, cardX, cardY, cardW, cardH, 48)
  ctx.stroke()

  // Avatar ring
  const avatarSrc = opts.avatarSrc || '/qysi-avatar.png?v=7'
  const img = await loadAvatar(avatarSrc)
  const ax = W / 2
  const ay = cardY + 210
  const ar = 118
  ctx.beginPath()
  ctx.arc(ax, ay, ar + 14, 0, Math.PI * 2)
  const ring = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar)
  ring.addColorStop(0, primary)
  ring.addColorStop(1, accent)
  ctx.fillStyle = ring
  ctx.fill()
  ctx.beginPath()
  ctx.arc(ax, ay, ar + 4, 0, Math.PI * 2)
  ctx.fillStyle = card
  ctx.fill()
  ctx.save()
  ctx.beginPath()
  ctx.arc(ax, ay, ar, 0, Math.PI * 2)
  ctx.clip()
  if (img) {
    ctx.drawImage(img, ax - ar, ay - ar, ar * 2, ar * 2)
  } else {
    ctx.fillStyle = `rgba(${primaryRgb},0.35)`
    ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2)
  }
  ctx.restore()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = primary
  ctx.font = '700 22px Outfit, system-ui, sans-serif'
  ctx.fillText('SISTEMA INTELIGENTE', ax, ay + ar + 56)

  ctx.fillStyle = text
  ctx.font = 'bold 92px Bebas Neue, Outfit, system-ui, sans-serif'
  ctx.fillText(QISI_NAME, ax, ay + ar + 150)

  ctx.fillStyle = primary
  ctx.font = '700 34px Outfit, system-ui, sans-serif'
  ctx.fillText(`@${QISI_HANDLE}`, ax, ay + ar + 200)

  ctx.fillStyle = textSecondary
  ctx.font = '500 30px Outfit, system-ui, sans-serif'
  wrapCentered(
    ctx,
    `${QISI_MEANING}. 5 variantes · tu nivel · en Entrenamientos.`,
    ax,
    ay + ar + 260,
    cardW - 100,
    40,
    3
  )

  // Feature chips
  const chips = ['Gimnasio & Casa', '5 variantes', 'Tu nivel']
  const chipY = cardY + cardH - 210
  let chipX = cardX + 56
  ctx.font = '600 24px Outfit, system-ui, sans-serif'
  for (const label of chips) {
    const tw = ctx.measureText(label).width
    const pw = tw + 36
    const ph = 52
    ctx.fillStyle = `rgba(${primaryRgb},0.12)`
    roundRect(ctx, chipX, chipY, pw, ph, 26)
    ctx.fill()
    ctx.strokeStyle = `rgba(${primaryRgb},0.35)`
    ctx.lineWidth = 2
    roundRect(ctx, chipX, chipY, pw, ph, 26)
    ctx.stroke()
    ctx.fillStyle = text
    ctx.textAlign = 'left'
    ctx.fillText(label, chipX + 18, chipY + 34)
    chipX += pw + 16
  }

  // Footer CTA
  ctx.textAlign = 'center'
  ctx.fillStyle = text
  ctx.font = '700 28px Outfit, system-ui, sans-serif'
  const sharer = opts.sharerName ? String(opts.sharerName).split(/\s+/)[0] : 'Tu gymrat'
  ctx.fillText(
    mode === 'story'
      ? `${sharer} te invita a conocer a ${QISI_NAME}`
      : `Entrena con ${QISI_NAME} en Qyntra Gym`,
    ax,
    cardY + cardH - 90
  )

  ctx.fillStyle = textSecondary
  ctx.font = '500 24px Outfit, system-ui, sans-serif'
  ctx.fillText('Qyntra Gym · Inteligencia de entrenamiento', ax, cardY + cardH - 48)

  // Brand footer outside card (story)
  if (mode === 'story') {
    ctx.fillStyle = text
    ctx.font = 'bold 42px Bebas Neue, Outfit, system-ui, sans-serif'
    ctx.fillText('QYNTRA GYM', ax, H - 120)
    ctx.fillStyle = primary
    ctx.font = '600 26px Outfit, system-ui, sans-serif'
    ctx.fillText('Burbuja en Entrenamientos · siempre contigo', ax, H - 70)
  }

  return canvas.toDataURL('image/png')
}

export function buildQySiShareText({ sharerName, profileUrl, inviteUrl } = {}) {
  const who = sharerName?.trim() || 'Alguien'
  const link = profileUrl || inviteUrl || ''
  return (
    `🤖 ${who} te recomienda a ${QISI_NAME} en Qyntra Gym\n\n` +
    `${QISI_MEANING}.\n` +
    `5 variantes · tu nivel · en Entrenamientos.\n\n` +
    `Conoce a @${QISI_HANDLE}:\n${link}`
  )
}
