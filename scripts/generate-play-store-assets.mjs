/**
 * Genera assets para Google Play Store (Qyntra Gym)
 * Uso: node scripts/generate-play-store-assets.mjs
 */
import { mkdir, copyFile, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'play-store')
const APP_URL = process.env.PLAY_STORE_APP_URL || 'https://qyntagymweb.vercel.app'
const ICON_SRC = join(ROOT, 'client', 'public', 'pwa-512x512.png')

const BRAND = {
  orange: '#FF6B35',
  orangeDark: '#C94A1F',
  bg: '#0A0A0F',
  bgCard: '#14141C',
  text: '#FFFFFF',
  textMuted: '#A1A1AA'
}

async function ensureDirs() {
  for (const sub of ['icon', 'feature-graphic', 'phone', 'tablet-7', 'tablet-10', 'copy']) {
    await mkdir(join(OUT, sub), { recursive: true })
  }
}

async function exportIcon() {
  await copyFile(ICON_SRC, join(OUT, 'icon', 'app-icon-512.png'))
  // Play accepts 512; also export high-res copy
  await sharp(ICON_SRC).png().toFile(join(OUT, 'icon', 'app-icon-512-hq.png'))
}

async function createFeatureGraphic() {
  const w = 1024
  const h = 500
  const logoSize = 200
  const logo = await sharp(ICON_SRC).resize(logoSize, logoSize).png().toBuffer()

  const svg = `
<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${BRAND.bg}"/>
      <stop offset="100%" stop-color="#1a1020"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${BRAND.orange}"/>
      <stop offset="100%" stop-color="${BRAND.orangeDark}"/>
    </linearGradient>
    <radialGradient id="glow" cx="85%" cy="20%" r="45%">
      <stop offset="0%" stop-color="${BRAND.orange}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${BRAND.orange}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <rect x="0" y="${h - 6}" width="${w}" height="6" fill="url(#accent)"/>
  <text x="250" y="195" fill="${BRAND.text}" font-family="Segoe UI, Arial, sans-serif" font-size="56" font-weight="700" letter-spacing="2">QYNTRA GYM</text>
  <text x="250" y="255" fill="${BRAND.orange}" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="600">Supera tus límites</text>
  <text x="250" y="310" fill="${BRAND.textMuted}" font-family="Segoe UI, Arial, sans-serif" font-size="22">Rutinas · Progreso · Comunidad · Chat</text>
  <text x="250" y="380" fill="${BRAND.textMuted}" font-family="Segoe UI, Arial, sans-serif" font-size="18">Sistema de administración de gimnasios</text>
</svg>`

  const base = sharp(Buffer.from(svg)).png()
  const meta = await base.metadata()

  await sharp(await base.toBuffer())
    .composite([{ input: logo, left: 32, top: Math.floor((h - logoSize) / 2) }])
    .png()
    .toFile(join(OUT, 'feature-graphic', 'feature-graphic-1024x500.png'))
}

const PHONE_CAPTURES = [
  { file: '01-landing.png', path: '/', wait: 2500 },
  { file: '02-login.png', path: '/login', wait: 2000 },
  { file: '03-register.png', path: '/register', wait: 2000 },
  { file: '04-privacy.png', path: '/privacidad', wait: 1500 },
  { file: '05-delete-account.png', path: '/eliminar-cuenta', wait: 1500 }
]

const TABLET_CAPTURES = [
  { file: '01-landing-tablet.png', path: '/', wait: 2500, width: 1200, height: 1920 },
  { file: '02-login-tablet.png', path: '/login', wait: 2000, width: 1200, height: 1920 }
]

async function captureScreens(browser, { file, path, wait, width, height, outDir }) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: width < 900,
    hasTouch: width < 900
  })
  const url = `${APP_URL}${path}`
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(wait)
    // Ocultar posibles banners de instalación si aparecen
    await page.evaluate(() => {
      document.querySelectorAll('[class*="fixed"][class*="z-"]').forEach((el) => {
        if (el.textContent?.includes('Instala') || el.textContent?.includes('instal')) {
          el.style.display = 'none'
        }
      })
    }).catch(() => {})
    await page.screenshot({
      path: join(OUT, outDir, file),
      fullPage: false,
      type: 'png'
    })
    console.log(`  ✓ ${outDir}/${file}`)
  } catch (err) {
    console.warn(`  ✗ ${file}: ${err.message}`)
  } finally {
    await page.close()
  }
}

async function captureAllScreens() {
  const browser = await chromium.launch({ headless: true })
  console.log('Capturando pantallas de teléfono (1080×2340)...')
  for (const cap of PHONE_CAPTURES) {
    await captureScreens(browser, {
      ...cap,
      width: 1080,
      height: 2340,
      outDir: 'phone'
    })
  }
  console.log('Capturando tablet 7" (1200×1920)...')
  for (const cap of TABLET_CAPTURES) {
    await captureScreens(browser, { ...cap, outDir: 'tablet-7' })
  }
  console.log('Capturando tablet 10" (1600×2560)...')
  for (const cap of TABLET_CAPTURES) {
    await captureScreens(browser, {
      ...cap,
      file: cap.file.replace('-tablet', '-tablet10'),
      width: 1600,
      height: 2560,
      outDir: 'tablet-10'
    })
  }
  await browser.close()
}

async function writeListingCopy() {
  const copy = `# Qyntra Gym — Textos para Google Play Store

## Nombre de la app
QYNTRA GYM

## Descripción corta (máx. 80 caracteres)
Comunidad fitness, rutinas, progreso y chat para tu gimnasio

## Descripción completa
QYNTRA GYM conecta a tu gimnasio en una sola app: rutinas de entrenamiento, seguimiento de progreso, retos, clases, chat con la comunidad y herramientas para administradores.

ENTRENA MEJOR
• Rutinas personalizadas y exploración de rutinas de la comunidad
• Registro de entrenamientos, descansos y sesiones activas
• Retos y gamificación para mantener la motivación

TU PROGRESO
• Métricas corporales y evolución
• Estadísticas de asistencia y actividad
• Perfil público configurable

COMUNIDAD
• Feed social, historias y publicaciones
• Chat entre miembros
• Notificaciones de actividad importante

PARA TU GIMNASIO
• Gestión de membresías, clases y asistencia
• Panel de administración integrado
• Experiencia PWA instalable en móvil y escritorio

Qyntra Gym — Supera tus límites.

## Categoría
Salud y bienestar

## URLs obligatorias
- Política de privacidad: https://qyntagymweb.vercel.app/privacidad
- Eliminar cuenta: https://qyntagymweb.vercel.app/eliminar-cuenta
- Sitio web: https://qyntagymweb.vercel.app

## Assets generados
| Archivo | Uso en Play Console |
|---------|---------------------|
| icon/app-icon-512.png | App icon (512×512) |
| feature-graphic/feature-graphic-1024x500.png | Gráfico destacado |
| phone/*.png | Capturas teléfono (mín. 2) |
| tablet-7/*.png | Tablet 7" (opcional) |
| tablet-10/*.png | Tablet 10" (opcional) |

## No necesarios para Qyntra
- **Video**: omitir
- **Chromebook**: omitir (TWA web)
- **Android XR**: omitir

## Nota sobre capturas autenticadas
Las capturas incluyen landing, login, registro y páginas legales. Si Play pide más pantallas in-app, añade capturas de Dashboard, Entrenamientos y Chat desde tu móvil tras iniciar sesión.
`
  await writeFile(join(OUT, 'copy', 'LISTING-ES.md'), copy, 'utf8')
  await writeFile(join(OUT, 'README.md'), copy, 'utf8')
}

async function main() {
  console.log('Generando assets Play Store para Qyntra Gym...\n')
  await ensureDirs()
  await exportIcon()
  console.log('✓ Icono 512×512')
  await createFeatureGraphic()
  console.log('✓ Feature graphic 1024×500')
  await captureAllScreens()
  await writeListingCopy()
  console.log('\n✓ Textos en play-store/copy/LISTING-ES.md')
  console.log(`\nListo → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
