/**
 * Native share image for Dashboard welcome card.
 * Card height hugs content (like the in-app hero); CTA sits in a tight stack.
 * mode: 'external' → logo + invite | 'story' → Seguir+ + mutual follow
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

function countWrappedLines(ctx, text, maxWidth, maxLines = 6) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  if (!words.length) return 1
  let line = ''
  let lines = 0
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      lines += 1
      line = words[i]
      if (lines >= maxLines - 1) return maxLines
    } else {
      line = test
    }
  }
  if (line) lines += 1
  return Math.max(1, lines)
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

/**
 * Single layout model used for both measure and paint.
 */
function buildLayout(ctx, { w, name, username, motivation, motivation2 }) {
  const padX = 40
  const padTop = 36
  const padBottom = 34
  const innerW = w - padX * 2
  const nameLh = 48
  const q1Lh = 34
  const q2Lh = 30

  ctx.font = 'bold 48px Bebas Neue, Outfit, system-ui, sans-serif'
  const nameLines = countWrappedLines(ctx, String(name || 'Atleta').toUpperCase(), innerW, 2)

  ctx.font = '500 28px Outfit, system-ui, sans-serif'
  const m1Lines = countWrappedLines(ctx, motivation, innerW - 28, 3)

  ctx.font = 'italic 500 24px Outfit, system-ui, sans-serif'
  const m2Lines = countWrappedLines(ctx, motivation2, innerW - 28, 2)

  const greetingY = padTop + 22
  const nameY = greetingY + 44
  const nameBlockH = nameLines * nameLh
  const userY = nameY + nameBlockH + (username ? 6 : 0)
  const chipsY = username ? userY + 36 : nameY + nameBlockH + 18
  const box1Y = chipsY + 28
  const box1InnerTop = 18
  const box1LabelH = 18
  const box1Gap = 14
  const box1H = box1InnerTop + box1LabelH + box1Gap + m1Lines * q1Lh + 18
  const box2Y = box1Y + box1H + 12
  const box2H = 16 + m2Lines * q2Lh + 16
  const h = box2Y + box2H + padBottom

  return {
    w,
    h,
    padX,
    innerW,
    nameLh,
    q1Lh,
    q2Lh,
    greetingY,
    nameY,
    userY,
    chipsY,
    box1Y,
    box1H,
    box1InnerTop,
    box1LabelH,
    box1Gap,
    box2Y,
    box2H
  }
}

function drawWelcomeCard(ctx, {
  x,
  y,
  layout,
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
  const { w, h } = layout
  const g = ctx.createLinearGradient(x, y, x + w * 0.2, y + h)
  g.addColorStop(0, `rgba(${primaryRgb},0.96)`)
  g.addColorStop(0.55, `rgba(${primaryRgb},0.74)`)
  g.addColorStop(1, `rgba(${accentRgb},0.45)`)
  ctx.fillStyle = g
  roundRect(ctx, x, y, w, h, 36)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.arc(x + w - 28, y + 24, 64, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.1)'
  ctx.beginPath()
  ctx.arc(x + 36, y + h - 20, 48, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x + w * 0.8, y + h * 0.55, 32, 0, Math.PI * 2)
  ctx.stroke()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = 'rgba(255,255,255,0.84)'
  ctx.font = '600 24px Outfit, system-ui, sans-serif'
  ctx.fillText(greeting || 'Hola', x + layout.padX, y + layout.greetingY)

  ctx.fillStyle = '#0B1220'
  ctx.font = 'bold 48px Bebas Neue, Outfit, system-ui, sans-serif'
  wrapText(
    ctx,
    String(name || 'Atleta').toUpperCase(),
    x + layout.padX,
    y + layout.nameY,
    layout.innerW,
    layout.nameLh,
    2
  )

  if (username) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.font = '600 24px Outfit, system-ui, sans-serif'
    ctx.fillText(`@${String(username).replace(/^@+/, '')}`, x + layout.padX, y + layout.userY)
  }

  const chips = [
    { label: 'Seguidores', value: followers },
    { label: 'Seguidos', value: following }
  ]
  let chipX = x + layout.padX
  const chipBaseline = y + layout.chipsY
  chips.forEach((chip) => {
    const label = `${chip.value} ${chip.label}`
    ctx.font = '600 20px Outfit, system-ui, sans-serif'
    const tw = ctx.measureText(label).width
    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    roundRect(ctx, chipX, chipBaseline - 22, tw + 26, 36, 18)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(label, chipX + 13, chipBaseline + 2)
    chipX += tw + 34
  })

  const b1x = x + layout.padX - 4
  const b1y = y + layout.box1Y
  const b1w = layout.innerW + 8
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  roundRect(ctx, b1x, b1y, b1w, layout.box1H, 22)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1.5
  roundRect(ctx, b1x, b1y, b1w, layout.box1H, 22)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.62)'
  ctx.font = '700 15px Outfit, system-ui, sans-serif'
  ctx.fillText(
    'MOTIVACIÓN QYNTRA',
    x + layout.padX + 14,
    b1y + layout.box1InnerTop + layout.box1LabelH
  )
  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  ctx.font = '500 28px Outfit, system-ui, sans-serif'
  wrapText(
    ctx,
    motivation,
    x + layout.padX + 14,
    b1y + layout.box1InnerTop + layout.box1LabelH + layout.box1Gap + 24,
    layout.innerW - 28,
    layout.q1Lh,
    3
  )

  const b2x = b1x
  const b2y = y + layout.box2Y
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  roundRect(ctx, b2x, b2y, b1w, layout.box2H, 18)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  roundRect(ctx, b2x, b2y, b1w, layout.box2H, 18)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = 'italic 500 24px Outfit, system-ui, sans-serif'
  wrapText(
    ctx,
    motivation2,
    x + layout.padX + 14,
    b2y + 16 + 22,
    layout.innerW - 28,
    layout.q2Lh,
    2
  )
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

  const stage = ctx.createLinearGradient(0, 0, W * 0.35, H)
  stage.addColorStop(0, P.bg0)
  stage.addColorStop(0.5, P.bg1)
  stage.addColorStop(1, P.bg2)
  ctx.fillStyle = stage
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = P.brandOrb
  ctx.beginPath()
  ctx.arc(120, 260, 260, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = P.accentOrb
  ctx.beginPath()
  ctx.arc(960, 1560, 300, 0, Math.PI * 2)
  ctx.fill()

  const cardX = 64
  const cardW = W - 128
  const layout = buildLayout(ctx, {
    w: cardW,
    name,
    username,
    motivation,
    motivation2
  })

  const ctaGap = 24
  const ctaH = mode === 'story' ? 248 : 236
  const stackH = layout.h + ctaGap + ctaH
  const stackTop = Math.round((H - stackH) / 2)
  const cardY = Math.max(100, stackTop)

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.2)'
  ctx.shadowBlur = 36
  ctx.shadowOffsetY = 16
  ctx.fillStyle = 'rgba(0,0,0,0.001)'
  roundRect(ctx, cardX, cardY, cardW, layout.h, 36)
  ctx.fill()
  ctx.restore()

  drawWelcomeCard(ctx, {
    x: cardX,
    y: cardY,
    layout,
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

  const ctaY = cardY + layout.h + ctaGap
  const ctaX = cardX + 8
  const ctaW = cardW - 16

  ctx.fillStyle = P.mode === 'light' ? 'rgba(255,255,255,0.94)' : 'rgba(18,22,32,0.94)'
  roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 26)
  ctx.fill()
  ctx.strokeStyle = P.border
  ctx.lineWidth = 1.5
  roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 26)
  ctx.stroke()

  if (mode === 'story') {
    const btnW = 248
    const btnH = 60
    const bx = (W - btnW) / 2
    const by = ctaY + 32
    ctx.fillStyle = P.primary
    roundRect(ctx, bx, by, btnW, btnH, 30)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '700 28px Outfit, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Seguir+', bx + btnW / 2, by + btnH / 2 + 1)

    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = P.text
    ctx.font = '700 28px Outfit, system-ui, sans-serif'
    ctx.fillText('Sigámonos mutuamente', W / 2, by + btnH + 44)
    ctx.fillStyle = P.textSecondary
    ctx.font = '500 23px Outfit, system-ui, sans-serif'
    wrapText(
      ctx,
      'Haz crecer la comunidad Qyntra: motiva, entrena y progresa conmigo.',
      ctaX + 36,
      by + btnH + 84,
      ctaW - 72,
      30,
      2
    )
    ctx.textAlign = 'left'
  } else {
    const iconSize = 58
    const rowY = ctaY + 32
    drawAppIcon(ctx, W / 2 - iconSize / 2, rowY, iconSize, P.primary, P.primaryRgb)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = P.primary
    ctx.font = '700 17px Outfit, system-ui, sans-serif'
    ctx.fillText('QYNTRA GYM', W / 2, rowY + iconSize + 24)
    ctx.fillStyle = P.text
    ctx.font = '700 30px Outfit, system-ui, sans-serif'
    ctx.fillText('Únete a la comunidad', W / 2, rowY + iconSize + 62)
    ctx.fillStyle = P.textSecondary
    ctx.font = '500 22px Outfit, system-ui, sans-serif'
    wrapText(
      ctx,
      'Entrena · Progresa · Comparte. Descarga Qyntra Gym y empieza tu racha hoy.',
      ctaX + 32,
      rowY + iconSize + 100,
      ctaW - 64,
      28,
      2
    )
    ctx.textAlign = 'left'
  }

  return canvas.toDataURL('image/png')
}
