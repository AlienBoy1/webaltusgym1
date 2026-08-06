/**
 * Canvas share palettes that mirror the live app theme (light/dark + brand colors).
 */

export function getCurrentShareThemeMode() {
  if (typeof document === 'undefined') return 'dark'
  const root = document.documentElement
  if (root.classList.contains('light') || root.dataset.theme === 'light') return 'light'
  return 'dark'
}

function cssVar(name, fallback) {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function withAlpha(rgbCsv, alpha) {
  return `rgba(${rgbCsv}, ${alpha})`
}

/**
 * @param {'light'|'dark'|string} [mode]
 */
export function getShareThemePalette(mode) {
  const resolved = mode === 'light' || mode === 'dark' ? mode : getCurrentShareThemeMode()
  const primary = cssVar('--color-primary', '#FF6B35')
  const accent = cssVar('--color-accent', '#00F5FF')
  const primaryRgb = cssVar('--color-primary-rgb', '255, 107, 53')
  const accentRgb = cssVar('--color-accent-rgb', '0, 245, 255')
  const isLight = resolved === 'light'

  if (isLight) {
    return {
      mode: 'light',
      primary,
      accent,
      primaryRgb,
      accentRgb,
      bg0: '#F4F5F7',
      bg1: '#EEF0F4',
      bg2: '#E4E7EE',
      card: '#FFFFFF',
      cardFill: 'rgba(255,255,255,0.98)',
      surface: '#F0F1F5',
      inset: 'rgba(15,15,20,0.06)',
      insetStrong: 'rgba(15,15,20,0.1)',
      text: '#111118',
      textSecondary: '#52525B',
      textMuted: '#71717A',
      textSoft: 'rgba(17,17,24,0.78)',
      textFaint: 'rgba(17,17,24,0.48)',
      border: 'rgba(15,15,20,0.1)',
      borderStrong: 'rgba(15,15,20,0.16)',
      brandOrb: withAlpha(primaryRgb, 0.12),
      accentOrb: withAlpha(accentRgb, 0.1),
      avatarFallback: '#E4E4E7',
      eliteBg: 'rgba(168,85,247,0.14)',
      eliteText: '#7C3AED',
      badgeBg: 'rgba(234,179,8,0.18)',
      badgeBorder: 'rgba(202,138,4,0.35)',
      badgeText: '#CA8A04',
      cardBlend: '#FFFFFF',
      featureTitle: '#111118',
      featureMeta: 'rgba(17,17,24,0.72)',
      featureRule: 'rgba(15,15,20,0.12)',
      featureInset: 'rgba(15,15,20,0.06)',
      featureInsetText: '#111118',
      featureInsetMuted: 'rgba(17,17,24,0.5)',
      embedBg: 'rgba(15,15,20,0.04)',
      embedBorder: 'rgba(15,15,20,0.1)',
      coverFallback0: withAlpha(primaryRgb, 0.38),
      coverFallback1: withAlpha(accentRgb, 0.16),
      coverFallback2: withAlpha(primaryRgb, 0.18)
    }
  }

  return {
    mode: 'dark',
    primary,
    accent,
    primaryRgb,
    accentRgb,
    bg0: '#0A0A0F',
    bg1: '#12121A',
    bg2: '#1A120C',
    card: '#14141C',
    cardFill: 'rgba(20,20,28,0.96)',
    surface: 'rgba(255,255,255,0.06)',
    inset: 'rgba(10,10,15,0.45)',
    insetStrong: 'rgba(10,10,15,0.55)',
    text: '#FFFFFF',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
    textSoft: 'rgba(255,255,255,0.78)',
    textFaint: 'rgba(255,255,255,0.45)',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.12)',
    brandOrb: withAlpha(primaryRgb, 0.14),
    accentOrb: withAlpha(accentRgb, 0.08),
    avatarFallback: '#2A2A35',
    eliteBg: 'rgba(168,85,247,0.22)',
    eliteText: '#C4B5FD',
    badgeBg: 'rgba(234,179,8,0.16)',
    badgeBorder: 'rgba(250,204,21,0.35)',
    badgeText: '#FACC15',
    cardBlend: '#16161E',
    featureTitle: '#FFFFFF',
    featureMeta: 'rgba(255,255,255,0.75)',
    featureRule: 'rgba(255,255,255,0.12)',
    featureInset: 'rgba(10,10,15,0.55)',
    featureInsetText: '#FFFFFF',
    featureInsetMuted: 'rgba(255,255,255,0.55)',
    embedBg: 'rgba(255,255,255,0.04)',
    embedBorder: 'rgba(255,255,255,0.1)',
    coverFallback0: withAlpha(primaryRgb, 0.55),
    coverFallback1: withAlpha(accentRgb, 0.28),
    coverFallback2: withAlpha(primaryRgb, 0.22)
  }
}
