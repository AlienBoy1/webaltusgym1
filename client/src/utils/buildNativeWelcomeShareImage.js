/**
 * Native share image for Dashboard welcome card.
 * mode: 'external' → logo + invite CTA | 'story' → Seguir+ + mutual follow invite
 */

import { getShareThemePalette } from './shareThemePalette'

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

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 6) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const align = ctx.textAlign || 'left'
  const drawLine = (str, cy) => {
    if (align === 'center') ctx.fillText(str, x + maxWidth / 2, cy)
    else ctx.fillText(str, x, cy)
  }
  let line = ''
  let cy = y
  let lines = 0
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      drawLine(line, cy)
      line = words[i]
      cy += lineHeight
      lines += 1
      if (lines >= maxLines - 1) {
        let rest = words.slice(i).join(' ')
        while (ctx.measureText(`${rest}…`).width > maxWidth && rest.length > 1) {
          rest = rest.slice(0, -1)
        }
        drawLine(`${rest}…`, cy)
        return cy + lineHeight
      }
    } else {
      line = test
    }
  }
  if (line) {
    drawLine(line, cy)
    cy += lineHeight
  }
  return cy
}

function drawAppIcon(ctx, x, y, size, primary, primaryRgb) {
  const grad = ctx.createLinearGradient(x, y, x + size, y + size)
  grad.addColorStop(0, primary)
  grad.addColorStop(1, `rgba(${primaryRgb},0.72)`)
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
}

function drawWelcomeCard(ctx, {
  x,
  y,
  w,
  h,
  greeting,
  name,
  username,
  followers,
  following,
  motivation,
  motivation2,
  primaryRgb,
  accentRgb
}) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h)
  g.addColorStop(0, `rgba(${primaryRgb},0.95)`)
  g.addColorStop(0.5, `rgba(${primaryRgb},0.72)`)
  g.addColorStop(1, `rgba(${accentRgb},0.42)`)
  ctx.fillStyle = g
  roundRect(ctx, x, y, w, h, 40)
  ctx.fill()

  // soft orbs
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.beginPath()
  ctx.arc(x + w - 40, y + 36, 90, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath()
  ctx.arc(x + 48, y + h - 30, 70, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x + w * 0.72, y + h * 0.78, 48, 0, Math.PI * 2)
  ctx.stroke()

  let cy = y + 52
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.font = '600 26px Outfit, system-ui, sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(greeting || 'Hola', x + 40, cy)

  cy += 56
  ctx.fillStyle = '#0B1220'
  ctx.font = 'bold 56px Bebas Neue, Outfit, system-ui, sans-serif'
  const nameEnd = wrapText(ctx, String(name || 'Atleta').toUpperCase(), x + 40, cy, w - 80, 54, 2)

  cy = nameEnd + 8
  if (username) {
    ctx.fillStyle = 'rgba(255,255,255,0.88)'
    ctx.font = '600 28px Outfit, system-ui, sans-serif'
    ctx.fillText(`@${String(username).replace(/^@+/, '')}`, x + 40, cy)
    cy += 42
  }

  // social chips
  const chips = [
    { label: 'Seguidores', value: followers },
    { label: 'Seguidos', value: following }
  ]
  let chipX = x + 40
  chips.forEach((chip) => {
    const label = `${chip.value} ${chip.label}`
    ctx.font = '600 22px Outfit, system-ui, sans-serif'
    const tw = ctx.measureText(label).width
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    roundRect(ctx, chipX, cy - 24, tw + 28, 40, 20)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(label, chipX + 14, cy + 4)
    chipX += tw + 40
  })
  cy += 48

  // quote 1
  const box1H = 170
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  roundRect(ctx, x + 36, cy, w - 72, box1H, 24)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 1.5
  roundRect(ctx, x + 36, cy, w - 72, box1H, 24)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  ctx.font = '700 18px Outfit, system-ui, sans-serif'
  ctx.fillText('MOTIVACIÓN QYNTRA', x + 56, cy + 36)
  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  ctx.font = '500 30px Outfit, system-ui, sans-serif'
  wrapText(ctx, motivation, x + 56, cy + 78, w - 112, 38, 3)
  cy += box1H + 18

  // quote 2
  const box2H = 120
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, x + 36, cy, w - 72, box2H, 20)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  roundRect(ctx, x + 36, cy, w - 72, box2H, 20)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.font = 'italic 500 26px Outfit, system-ui, sans-serif'
  wrapText(ctx, motivation2, x + 56, cy + 48, w - 112, 34, 2)
}

/**
 * @param {object} payload
 * @param {'external'|'story'} [payload.mode]
 */
export async function buildNativeWelcomeShareImage(payload = {}) {
  const {
    mode = 'external',
    greeting = 'Hola',
    name = 'Atleta',
    username = '',
    followers = 0,
    following = 0,
    motivation = '',
    motivation2 = ''
  } = payload

  const P = getShareThemePalette()
  const W = 1080
  const H = 1920
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const stage = ctx.createLinearGradient(0, 0, W, H)
  stage.addColorStop(0, P.bg0)
  stage.addColorStop(0.55, P.bg1)
  stage.addColorStop(1, P.bg2)
  ctx.fillStyle = stage
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = P.brandOrb
  ctx.beginPath()
  ctx.arc(160, 220, 200, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = P.accentOrb
  ctx.beginPath()
  ctx.arc(920, 1680, 260, 0, Math.PI * 2)
  ctx.fill()

  const cardX = 56
  const cardY = mode === 'story' ? 160 : 120
  const cardW = W - 112
  const cardH = mode === 'story' ? 1120 : 1180

  drawWelcomeCard(ctx, {
    x: cardX,
    y: cardY,
    w: cardW,
    h: cardH,
    greeting,
    name,
    username,
    followers,
    following,
    motivation,
    motivation2,
    primaryRgb: P.primaryRgb,
    accentRgb: P.accentRgb
  })

  if (mode === 'story') {
    const by = cardY + cardH + 48
    // Seguir+ pill
    const btnW = 280
    const btnH = 72
    const bx = (W - btnW) / 2
    ctx.fillStyle = P.primary
    roundRect(ctx, bx, by, btnW, btnH, 36)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '700 32px Outfit, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Seguir+', bx + btnW / 2, by + 46)

    ctx.fillStyle = P.text
    ctx.font = '600 30px Outfit, system-ui, sans-serif'
    ctx.fillText('Sigámonos mutuamente', W / 2, by + 130)
    ctx.fillStyle = P.textSecondary
    ctx.font = '500 26px Outfit, system-ui, sans-serif'
    wrapText(
      ctx,
      'Haz crecer la comunidad Qyntra: motiva, entrena y progresa conmigo.',
      100,
      by + 180,
      W - 200,
      34,
      3
    )
    ctx.textAlign = 'left'
  } else {
    const by = cardY + cardH + 56
    drawAppIcon(ctx, W / 2 - 44, by, 88, P.primary, P.primaryRgb)
    ctx.fillStyle = P.primary
    ctx.font = '700 22px Outfit, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('QYNTRA GYM', W / 2, by + 124)
    ctx.fillStyle = P.text
    ctx.font = '700 36px Outfit, system-ui, sans-serif'
    ctx.fillText('Únete a la comunidad', W / 2, by + 178)
    ctx.fillStyle = P.textSecondary
    ctx.font = '500 26px Outfit, system-ui, sans-serif'
    wrapText(
      ctx,
      'Entrena · Progresa · Comparte. Descarga Qyntra Gym y empieza tu racha hoy.',
      110,
      by + 230,
      W - 220,
      34,
      3
    )
    ctx.textAlign = 'left'
  }

  return canvas.toDataURL('image/png')
}
