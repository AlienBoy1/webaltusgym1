import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FiAlertTriangle, FiInfo, FiCheck } from 'react-icons/fi'

const DialogContext = createContext(null)

/**
 * In-app dialogs (Qyntra style). No backdrop-blur — that freezes Android WebViews black/blank.
 */
export function AppDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolverRef = useRef(null)
  const queueRef = useRef([])

  const close = useCallback((result) => {
    resolverRef.current?.(result)
    resolverRef.current = null
    const next = queueRef.current.shift()
    if (next) {
      resolverRef.current = next.resolve
      setDialog(next.config)
    } else {
      setDialog(null)
    }
  }, [])

  const open = useCallback((config) => {
    return new Promise((resolve) => {
      if (resolverRef.current) {
        queueRef.current.push({ config, resolve })
        return
      }
      resolverRef.current = resolve
      setDialog(config)
    })
  }, [])

  const api = useMemo(
    () => ({
      alert: (message, options = {}) =>
        open({
          type: 'alert',
          title: options.title || 'Qyntra Gym',
          message,
          confirmLabel: options.confirmLabel || 'Entendido',
          tone: options.tone || 'info',
          dismissible: options.dismissible !== false
        }).then(() => true),
      confirm: (message, options = {}) =>
        open({
          type: 'confirm',
          title: options.title || 'Confirmar',
          message,
          confirmLabel: options.confirmLabel || 'Confirmar',
          cancelLabel: options.cancelLabel || 'Cancelar',
          tone: options.tone || 'danger',
          dismissible: options.dismissible !== false
        }),
      prompt: (message, options = {}) =>
        open({
          type: 'prompt',
          title: options.title || 'Escribe un mensaje',
          message,
          defaultValue: options.defaultValue || '',
          placeholder: options.placeholder || '',
          confirmLabel: options.confirmLabel || 'Continuar',
          cancelLabel: options.cancelLabel || 'Cancelar',
          tone: options.tone || 'info',
          dismissible: options.dismissible !== false
        })
    }),
    [open]
  )

  return (
    <DialogContext.Provider value={api}>
      {children}
      <AnimatePresence>
        {dialog && (
          <motion.div
            key="qyntra-app-dialog"
            className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Solid scrim — NEVER backdrop-blur on Android WebView */}
            <button
              type="button"
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.55)' }}
              aria-label="Cerrar"
              onClick={() => {
                if (dialog.dismissible === false) return
                close(dialog.type === 'confirm' ? false : dialog.type === 'prompt' ? null : true)
              }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ type: 'spring', damping: 26, stiffness: 320 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border p-5 shadow-2xl sm:p-6"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)'
              }}
            >
              <div className="mb-4 flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background:
                      dialog.tone === 'danger'
                        ? 'rgba(239,68,68,0.14)'
                        : 'rgba(var(--color-primary-rgb),0.14)',
                    color: dialog.tone === 'danger' ? '#EF4444' : 'var(--color-primary)'
                  }}
                >
                  {dialog.tone === 'danger' ? (
                    <FiAlertTriangle size={20} />
                  ) : dialog.type === 'alert' ? (
                    <FiInfo size={20} />
                  ) : (
                    <FiCheck size={20} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-2xl tracking-wide">{dialog.title}</h2>
                  {dialog.message && (
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {dialog.message}
                    </p>
                  )}
                </div>
              </div>

              {dialog.type === 'prompt' && (
                <PromptField
                  defaultValue={dialog.defaultValue}
                  placeholder={dialog.placeholder}
                  onSubmit={(value) => close(value)}
                  id="app-dialog-prompt"
                />
              )}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {dialog.type !== 'alert' && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => close(dialog.type === 'prompt' ? null : false)}
                  >
                    {dialog.cancelLabel}
                  </button>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  style={
                    dialog.tone === 'danger'
                      ? { background: '#EF4444', color: '#fff' }
                      : undefined
                  }
                  onClick={() => {
                    if (dialog.type === 'prompt') {
                      const el = document.getElementById('app-dialog-prompt')
                      close(el?.value ?? '')
                      return
                    }
                    close(true)
                  }}
                >
                  {dialog.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  )
}

function PromptField({ defaultValue, placeholder, onSubmit, id }) {
  const [value, setValue] = useState(defaultValue || '')
  return (
    <input
      id={id}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit(value)
      }}
      placeholder={placeholder}
      className="input-field"
      autoFocus
    />
  )
}

export function useAppDialog() {
  const ctx = useContext(DialogContext)
  if (!ctx) {
    throw new Error('useAppDialog must be used within AppDialogProvider')
  }
  return ctx
}
