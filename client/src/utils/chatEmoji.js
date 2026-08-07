/**
 * Detect emoji-only chat messages for big “sticker-like” rendering.
 * Allows 1–3 grapheme clusters of pictographic emoji (ZWJ sequences ok).
 */
export function isEmojiOnlyText(text) {
  const raw = String(text || '').trim()
  if (!raw) return false

  let graphemes
  try {
    graphemes = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(raw)].map(
      (s) => s.segment
    )
  } catch {
    graphemes = Array.from(raw)
  }

  graphemes = graphemes.filter((g) => g.trim().length > 0)
  if (graphemes.length === 0 || graphemes.length > 3) return false

  return graphemes.every((g) => {
    if (/[A-Za-z0-9]/.test(g)) return false
    try {
      return /\p{Extended_Pictographic}/u.test(g) || /\p{Emoji_Presentation}/u.test(g)
    } catch {
      // Fallback without unicode property escapes
      return /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(g)
    }
  })
}

export function emojiOnlySizeClass(text) {
  const raw = String(text || '').trim()
  let count = 1
  try {
    count = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(raw)].filter(
      (s) => s.segment.trim()
    ).length
  } catch {
    count = Array.from(raw).length
  }
  if (count <= 1) return 'text-[3.25rem] leading-none'
  if (count === 2) return 'text-[2.65rem] leading-none'
  return 'text-[2.15rem] leading-tight'
}

export function summarizeMessageReactions(reactions, myId) {
  const map = reactions && typeof reactions === 'object' ? reactions : {}
  const counts = {}
  Object.values(map).forEach((emoji) => {
    if (!emoji) return
    counts[emoji] = (counts[emoji] || 0) + 1
  })
  const reactionSummary = Object.entries(counts)
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count)
  return {
    myReaction: myId && map[myId] ? map[myId] : null,
    reactionSummary
  }
}
