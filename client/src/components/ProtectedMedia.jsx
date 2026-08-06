import { forwardRef, useCallback } from 'react'

/**
 * Renders img/video that resists casual download / save / drag.
 * Note: determined users can still capture via OS tools; this blocks in-app UX paths.
 */
const ProtectedMedia = forwardRef(function ProtectedMedia(
  {
    as = 'img',
    className = '',
    protect = true,
    onContextMenu,
    onDragStart,
    children,
    ...props
  },
  ref
) {
  const block = useCallback(
    (e) => {
      if (!protect) return
      e.preventDefault()
      e.stopPropagation()
    },
    [protect]
  )

  const shared = {
    ref,
    className: `${protect ? 'protected-media' : ''} ${className}`.trim(),
    draggable: protect ? false : props.draggable,
    onContextMenu: (e) => {
      block(e)
      onContextMenu?.(e)
    },
    onDragStart: (e) => {
      block(e)
      onDragStart?.(e)
    },
    ...props
  }

  if (as === 'video') {
    return (
      <video
        {...shared}
        controlsList={protect ? 'nodownload noplaybackrate noremoteplayback' : props.controlsList}
        disablePictureInPicture={protect || props.disablePictureInPicture}
        onClick={(e) => {
          // avoid browser media menu shortcuts where possible
          props.onClick?.(e)
        }}
      >
        {children}
      </video>
    )
  }

  return <img alt="" {...shared} />
})

export default ProtectedMedia

/** Attach once (e.g. MainLayout) to harden media protection globally. */
export function installMediaProtection() {
  if (typeof document === 'undefined') return () => {}
  if (document.documentElement.dataset.qyntraMediaProtect === '1') {
    return () => {}
  }
  document.documentElement.dataset.qyntraMediaProtect = '1'

  const isProtected = (el) => {
    if (!el) return false
    return Boolean(
      el.closest?.(
        '.protected-media, [data-protected-media="1"], .story-viewer video, .story-viewer img'
      )
    )
  }

  const onContextMenu = (e) => {
    const t = e.target
    if (!t) return
    if (t.tagName === 'IMG' || t.tagName === 'VIDEO' || isProtected(t)) {
      if (
        isProtected(t) ||
        t.classList?.contains('protected-media') ||
        t.closest?.('[data-protected-media]') ||
        t.closest?.('.story-viewer')
      ) {
        e.preventDefault()
      }
    }
  }

  const onDragStart = (e) => {
    const t = e.target
    if (t?.tagName === 'IMG' || t?.tagName === 'VIDEO') {
      if (isProtected(t) || t.classList?.contains('protected-media')) {
        e.preventDefault()
      }
    }
  }

  // Block common save shortcuts when focus is on protected media
  const onKeyDown = (e) => {
    const t = e.target
    const key = String(e.key || '').toLowerCase()
    const saveCombo = (e.ctrlKey || e.metaKey) && key === 's'
    if (!saveCombo) return
    if (isProtected(t) || isProtected(document.activeElement)) {
      e.preventDefault()
    }
  }

  document.addEventListener('contextmenu', onContextMenu, true)
  document.addEventListener('dragstart', onDragStart, true)
  document.addEventListener('keydown', onKeyDown, true)

  return () => {
    document.removeEventListener('contextmenu', onContextMenu, true)
    document.removeEventListener('dragstart', onDragStart, true)
    document.removeEventListener('keydown', onKeyDown, true)
    delete document.documentElement.dataset.qyntraMediaProtect
  }
}
