import { FiCheck, FiLock, FiMessageCircle, FiPlay, FiShare2, FiSkipForward, FiTarget, FiUsers, FiHardDrive, FiBell, FiEye, FiUser, FiCompass } from 'react-icons/fi'
import QySiAvatar from './QySiAvatar'

/**
 * Premium fallback surfaces when a real UI target is missing.
 * Root element always carries the data-tour the step expects.
 */
export default function TutorialDemoSurface({ demoId }) {
  if (!demoId) return null

  const shell =
    'w-[min(340px,calc(100vw-2rem))] rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] shadow-[0_24px_64px_rgba(0,0,0,0.45)]'

  if (demoId === 'workout-start') {
    return (
      <div data-tour="tour-workout-start" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ejemplo · Rutina
        </p>
        <h3 className="mt-1 font-display text-lg text-[color:var(--text-primary)]">Full Body A</h3>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">6 ejercicios · ~45 min</p>
        <div className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-3">
          <FiPlay size={16} /> Iniciar
        </div>
      </div>
    )
  }

  if (demoId === 'nav-swipe') {
    const tabs = ['Inicio', 'Social', 'Entrenos', 'Progreso', 'Perfil']
    return (
      <div data-tour="tour-nav-swipe-demo" className={`${shell} overflow-hidden p-0`}>
        <div className="relative px-4 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
            Ejemplo · Deslizar
          </p>
          <p className="mt-1 font-display text-base text-[color:var(--text-primary)]">
            Desliza la pantalla
          </p>
          <div className="relative mt-4 h-28 overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]">
            <div
              className="absolute inset-y-0 left-0 flex w-[300%] items-center"
              style={{ animation: 'qyntra-nav-swipe-demo 2.8s ease-in-out infinite' }}
            >
              {['Inicio', 'Social', 'Entrenos'].map((label) => (
                <div
                  key={label}
                  className="flex h-full w-1/3 flex-col items-center justify-center gap-1 px-4"
                >
                  <span className="rounded-full bg-[rgba(var(--color-primary-rgb),0.16)] px-3 py-1 text-[11px] font-semibold text-[color:var(--color-primary)]">
                    {label}
                  </span>
                  <span className="text-center text-xs text-[color:var(--text-muted)]">
                    Contenido de {label}
                  </span>
                </div>
              ))}
            </div>
            <div
              className="pointer-events-none absolute bottom-3 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-[color:var(--bg-elevated)] shadow-md"
              style={{ animation: 'qyntra-nav-finger-demo 2.8s ease-in-out infinite' }}
              aria-hidden
            >
              <span className="block h-3.5 w-3.5 rounded-full bg-[color:var(--color-primary)]" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
            <span>← Anterior</span>
            <span>Siguiente →</span>
          </div>
        </div>
        <div className="flex justify-around border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/60 px-1 py-2">
          {tabs.map((label, i) => (
            <div
              key={label}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 ${
                i === 1 ? 'text-[color:var(--color-primary)]' : 'text-[color:var(--text-muted)]'
              }`}
            >
              <span className="text-[9px] font-semibold leading-tight">{label}</span>
              {i === 1 && (
                <span className="h-1 w-1 rounded-full bg-[color:var(--color-primary)]" />
              )}
            </div>
          ))}
        </div>
        <style>{`
          @keyframes qyntra-nav-swipe-demo {
            0%, 12% { transform: translateX(0); }
            38%, 52% { transform: translateX(-33.333%); }
            78%, 100% { transform: translateX(-66.666%); }
          }
          @keyframes qyntra-nav-finger-demo {
            0%, 12% { transform: translate(-20%, 0); opacity: 0.85; }
            38%, 52% { transform: translate(-50%, 0); opacity: 1; }
            78%, 100% { transform: translate(-80%, 0); opacity: 0.85; }
          }
        `}</style>
      </div>
    )
  }

  if (demoId === 'workout-gymrat') {
    return (
      <div data-tour="tour-workout-gymrat-creator" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ejemplo · Adoptada
        </p>
        <h3 className="mt-1 font-display text-lg text-[color:var(--text-primary)]">Push Day</h3>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[rgba(var(--color-primary-rgb),0.35)] bg-[rgba(var(--color-primary-rgb),0.12)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-primary)]">
          <FiUser size={12} /> GymRat de @coach_alex
        </span>
        <div className="mt-3 flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
          <FiCompass size={12} /> Explora rutinas públicas y adopta las tuyas
        </div>
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-[color:var(--bg-muted)] px-2 py-1 text-[11px] font-medium text-[color:var(--text-secondary)]">
          <FiUsers size={11} /> 12 GymRats
        </div>
      </div>
    )
  }

  if (demoId === 'workout-collaborator') {
    return (
      <div data-tour="tour-workout-gymrat-creator" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ejemplo · Colaborador
        </p>
        <h3 className="mt-1 font-display text-lg text-[color:var(--text-primary)]">Push Day · editada</h3>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[rgba(var(--color-primary-rgb),0.35)] bg-[rgba(var(--color-primary-rgb),0.12)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-primary)]">
          <FiUsers size={12} /> Colaborador · GymRat de @coach_alex
        </span>
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">
            En la rutina original
          </p>
          <div className="flex gap-3">
            {['Tú', '@mia', '@leo'].map((label) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--bg-muted)] text-[11px] font-bold text-[color:var(--text-primary)]">
                  {label === 'Tú' ? 'YO' : label.slice(1, 3).toUpperCase()}
                </div>
                <span className="text-[10px] text-[color:var(--text-muted)]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (demoId === 'workout-delete-adopted') {
    return (
      <div data-tour="tour-workouts-list" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ejemplo · Eliminar
        </p>
        <div className="mt-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] p-3">
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">Eliminar adopción editada</p>
          <p className="mt-2 text-xs leading-relaxed text-[color:var(--text-secondary)]">
            Se quita tu GymRat, dejas de ser colaborador y se borra tu variante editada.
          </p>
          <div className="mt-3 flex gap-2">
            <div className="flex-1 rounded-xl border border-[color:var(--border-subtle)] py-2 text-center text-xs">
              Cancelar
            </div>
            <div className="flex-1 rounded-xl bg-red-500/90 py-2 text-center text-xs font-semibold text-white">
              Eliminar todo
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (demoId === 'workout-complete') {
    return (
      <div data-tour="tour-workout-complete-exercise" className={`${shell} p-5`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[color:var(--text-muted)]">
          Ejercicio 2 de 6
        </p>
        <h3 className="mt-2 font-display text-2xl text-[color:var(--text-primary)]">Press banca</h3>
        <div className="mt-3 flex gap-2">
          <span className="rounded-full bg-[color:var(--bg-muted)] px-3 py-1 text-xs">4 series</span>
          <span className="rounded-full bg-[color:var(--bg-muted)] px-3 py-1 text-xs">10 reps</span>
        </div>
        <div className="btn-primary mt-6 flex w-full items-center justify-center gap-2 py-3.5">
          <FiCheck size={18} /> Completar
        </div>
      </div>
    )
  }

  if (demoId === 'workout-rest') {
    return (
      <div data-tour="tour-workout-rest-timer" className={`${shell} px-5 py-8 text-center`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-accent-cyan">Descanso</p>
        <div className="mx-auto mt-5 flex h-28 w-28 items-center justify-center rounded-full border-4 border-[color:var(--color-primary)] font-display text-3xl tabular-nums text-[color:var(--text-primary)]">
          0:45
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-muted)]">Siguiente</p>
        <p className="font-display text-lg text-[color:var(--text-primary)]">Remo con barra</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] px-4 py-2 text-sm">
          <FiSkipForward size={14} /> Saltar descanso
        </div>
      </div>
    )
  }

  if (demoId === 'community-post' || demoId === 'community-actions' || demoId === 'invite-share') {
    const rootTour =
      demoId === 'community-actions'
        ? 'tour-social-post-actions'
        : demoId === 'invite-share'
          ? 'tour-social-share'
          : 'tour-social-demo-post'

    return (
      <div data-tour={rootTour} className={`${shell} w-[min(360px,calc(100vw-2rem))] overflow-hidden`}>
        <div className="flex items-center gap-3 px-4 pt-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.2)] text-sm font-bold text-[color:var(--color-primary)]">
            Q
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">Miembro Qyntra</p>
            <p className="text-[11px] text-[color:var(--text-muted)]">hace 2 h · Ejemplo</p>
          </div>
        </div>
        <p className="px-4 pt-3 text-sm leading-relaxed text-[color:var(--text-secondary)]">
          ¡Nuevo PR en sentadilla! 💪 Consistencia antes que perfeccionismo. ¿Te unes al próximo reto?
        </p>
        <div
          className="mx-4 mt-3 h-28 rounded-xl"
          style={{
            background:
              'linear-gradient(135deg, rgba(var(--color-primary-rgb),0.35), rgba(var(--color-accent-rgb),0.18))'
          }}
        />
        <div className="mt-3 flex items-center gap-5 border-t border-[color:var(--border-subtle)] px-4 py-3">
          <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-primary)]">❤️ 24</span>
          <span className="inline-flex items-center gap-1.5 text-sm text-[color:var(--text-secondary)]">
            <FiMessageCircle size={16} /> 6
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-accent-cyan">
            <FiShare2 size={16} />
            {demoId === 'invite-share' ? ' Compartir' : ''}
          </span>
        </div>
      </div>
    )
  }

  if (demoId === 'challenge-join') {
    return (
      <div data-tour="tour-challenge-join" className={`${shell} p-4`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-yellow">Reto disponible</p>
            <h3 className="mt-1 font-display text-lg text-[color:var(--text-primary)]">10K en 30 días</h3>
          </div>
          <span className="text-sm font-semibold text-accent-yellow">+200 XP</span>
        </div>
        <p className="mt-2 text-xs text-[color:var(--text-muted)]">Corre o camina 10 km antes de fin de mes.</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-[color:var(--text-muted)]">
          <span className="inline-flex items-center gap-1">
            <FiUsers size={12} /> 48
          </span>
          <span className="inline-flex items-center gap-1">
            <FiTarget size={12} /> Distancia
          </span>
        </div>
        <div className="btn-primary mt-4 w-full py-2.5 text-center">Unirse al Reto</div>
      </div>
    )
  }

  if (demoId === 'challenge-invite') {
    return (
      <div data-tour="tour-challenge-invite" className={`${shell} overflow-hidden`}>
        <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
          <p className="text-center font-display text-base text-[color:var(--text-primary)]">Compartir reto</p>
        </div>
        <div className="space-y-1 p-3">
          <div className="flex items-center gap-3 rounded-xl bg-[color:var(--bg-muted)]/60 p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(var(--color-primary-rgb),0.14)] text-[color:var(--color-primary)]">
              <FiUsers size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[color:var(--text-primary)]">Comunidad</p>
              <p className="text-[11px] text-[color:var(--text-muted)]">Publicar invitación en el feed</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-accent-yellow/30 bg-accent-yellow/10 p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-yellow/15 text-accent-yellow">
              <FiShare2 size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[color:var(--text-primary)]">Invitar al reto</p>
              <p className="text-[11px] text-[color:var(--text-muted)]">Imagen para WA, IG o Facebook</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (demoId === 'challenge-start') {
    return (
      <div data-tour="tour-challenge-start" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Detalle del reto
        </p>
        <h3 className="mt-1 font-display text-lg">10K en 30 días</h3>
        <p className="mt-2 text-xs text-[color:var(--text-muted)]">Estado: Unido · listo para arrancar.</p>
        <div className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-2.5">
          <FiPlay size={16} /> Iniciar Reto
        </div>
      </div>
    )
  }

  if (demoId === 'challenge-progress') {
    return (
      <div data-tour="tour-challenge-progress" className={`${shell} p-4`}>
        <p className="text-xs font-medium text-[color:var(--text-secondary)]">Actualizar progreso</p>
        <div className="mt-2 flex gap-2">
          <div className="flex-1 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-3 py-2.5 text-sm tabular-nums">
            6.5
          </div>
          <div className="btn-primary px-4 py-2.5">Actualizar</div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--bg-muted)]">
          <div className="h-full w-[65%] rounded-full bg-[color:var(--color-primary)]" />
        </div>
        <p className="mt-1.5 text-[11px] text-[color:var(--text-muted)]">6.5 / 10 km</p>
      </div>
    )
  }

  if (demoId === 'challenge-complete') {
    return (
      <div data-tour="tour-challenge-complete" className={`${shell} p-4`}>
        <p className="text-sm font-medium text-accent-green">¡Objetivo alcanzado!</p>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">10 / 10 km · listo para cobrar XP</p>
        <div className="btn-primary mt-4 w-full py-2.5 text-center">Completar y Obtener XP</div>
      </div>
    )
  }

  if (demoId === 'profile-notes') {
    return (
      <div data-tour="tour-profile-notes" className={`${shell} flex flex-col items-center px-5 py-6`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ejemplo · Nota
        </p>
        <div className="relative mt-4 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-4 py-3 text-center text-sm text-[color:var(--text-primary)]">
          Entrenando piernas hoy 💪
          <span className="absolute -bottom-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]" />
        </div>
        <div className="mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.2)] text-xl font-bold text-[color:var(--color-primary)]">
          Q
        </div>
        <p className="mt-3 text-center text-xs text-[color:var(--text-muted)]">Visible 24 h · respuestas privadas</p>
      </div>
    )
  }

  if (demoId === 'chat-thread') {
    return (
      <div data-tour="tour-chat-thread-demo" className={`${shell} space-y-2 p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ejemplo · Chat
        </p>
        <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-md border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-3 py-2 text-sm">
          ¿Entrenamos juntos mañana?
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">10:21</p>
        </div>
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[color:var(--color-primary)] px-3 py-2 text-sm text-white">
          <div className="mb-1.5 rounded-lg border-l-2 border-white/80 bg-black/15 px-2 py-1 text-[11px]">
            <p className="font-semibold">Athlete</p>
            <p className="truncate text-white/75">¿Entrenamos juntos mañana?</p>
          </div>
          ¡Dale! A las 7 en el gym.
          <p className="mt-1 text-right text-[10px] text-white/75">10:22 · leído</p>
        </div>
      </div>
    )
  }

  if (demoId === 'chat-typing') {
    return (
      <div data-tour="tour-chat-typing-demo" className={`${shell} overflow-hidden p-0`}>
        <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
            Lista de chats
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.18)] text-sm font-bold text-[color:var(--color-primary)]">
            A
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">Athlete</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-[color:var(--color-primary)]">
              <span className="inline-flex gap-[3px]">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1 w-1 animate-pulse rounded-full bg-[color:var(--color-primary)]" />
                ))}
              </span>
              escribiendo…
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (demoId === 'chat-emoji') {
    return (
      <div data-tour="tour-chat-emoji-demo" className={`${shell} space-y-3 p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Solo emojis
        </p>
        <div className="ml-auto text-right">
          <p className="select-none text-[3rem] leading-none">🔥</p>
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">10:24</p>
        </div>
        <div className="mr-auto">
          <p className="select-none text-[2.4rem] leading-none">💪🏆</p>
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">10:25</p>
        </div>
        <p className="text-[11px] text-[color:var(--text-muted)]">Sin cajón · hasta 3 emojis</p>
      </div>
    )
  }

  if (demoId === 'chat-reactions') {
    return (
      <div data-tour="tour-chat-reactions-demo" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Reacciones
        </p>
        <div className="relative mt-3 ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[color:var(--color-primary)] px-3 py-2 text-sm text-white">
          Nuevo PR hoy
          <p className="mt-1 text-right text-[10px] text-white/75">10:30</p>
          <div className="absolute -bottom-3 right-2 inline-flex items-center gap-0.5 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)] px-1.5 py-0.5 text-xs shadow-sm">
            🔥 <span className="text-[10px] text-[color:var(--text-secondary)]">2</span>
          </div>
        </div>
        <div className="mt-6 flex justify-between gap-1 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-2 py-2">
          {['❤️', '💪', '🧴', '🔥', '⚡', '🏆'].map((e) => (
            <span key={e} className="flex h-9 w-9 items-center justify-center rounded-full text-lg">
              {e}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">Mantén pulsado el mensaje · mismas que en Comunidad</p>
      </div>
    )
  }

  if (demoId === 'chat-compose') {
    return (
      <div data-tour="tour-chat-compose-demo" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Escribir mensaje
        </p>
        <div className="mt-3 flex items-end gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[1.65rem] border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-2 py-1.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--text-secondary)]">☺</span>
            <span className="min-w-0 flex-1 text-sm text-[color:var(--text-muted)]">Mensaje</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[color:var(--text-secondary)]">+</span>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white">
            🎤
          </span>
        </div>
        <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">Micrófono cuando está vacío · Enviar cuando hay texto o adjunto</p>
      </div>
    )
  }

  if (demoId === 'chat-voice') {
    return (
      <div data-tour="tour-chat-voice-demo" className={`${shell} overflow-hidden p-0`}>
        <div className="bg-[#121218] px-4 py-3 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
            Grabación de audio
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="tabular-nums text-sm font-medium">0:08</span>
            <div className="flex h-7 flex-1 items-center gap-[2px]">
              {Array.from({ length: 22 }).map((_, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-full bg-white/55"
                  style={{ height: `${30 + ((i * 17) % 70)}%` }}
                />
              ))}
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-[color:var(--color-primary)]">
              1
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3a1518] text-red-400">🗑</span>
            <span className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-[#2a2a32] text-sm font-semibold">
              ⏸ Pausar
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff2d6a]">
              <FiShare2 size={14} className="rotate-45 text-white" />
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (demoId === 'chat-view-once') {
    return (
      <div data-tour="tour-chat-view-once-demo" className={`${shell} space-y-3 p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ver solo una vez
        </p>
        <div className="ml-auto flex max-w-[90%] items-center gap-3 rounded-2xl rounded-br-md bg-[color:var(--color-primary)] px-3 py-2.5 text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/18 text-sm font-bold">1</span>
          <span className="text-[15px] font-semibold">Foto</span>
        </div>
        <div className="ml-auto flex max-w-[90%] items-center gap-3 rounded-2xl rounded-br-md bg-[color:var(--color-primary)]/85 px-3 py-2.5 text-white/85">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-sm font-bold opacity-70">1</span>
          <span className="text-[15px] font-medium capitalize">Abierto</span>
        </div>
        <p className="text-[11px] text-[color:var(--text-muted)]">
          Sin miniatura en el chat · una apertura · luego queda bloqueado
        </p>
      </div>
    )
  }

  if (demoId === 'chat-reply') {
    return (
      <div data-tour="tour-chat-reply-demo" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Responder
        </p>
        <div className="relative mt-3">
          <div className="absolute inset-y-0 left-1 flex items-center opacity-80">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white">
              ↩
            </span>
          </div>
          <div className="ml-3 translate-x-6 rounded-2xl rounded-bl-md border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-3 py-2 text-sm">
            Nos vemos en pierna 🔥
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-3 py-2">
          <p className="text-xs font-semibold text-[color:var(--color-primary)]">Respondiendo a Athlete</p>
          <p className="truncate text-sm text-[color:var(--text-secondary)]">Nos vemos en pierna 🔥</p>
        </div>
        <p className="mt-2 text-[11px] text-[color:var(--text-muted)]">Desliza o mantén pulsado · también en fotos y audios</p>
      </div>
    )
  }

  if (demoId === 'chat-share') {
    return (
      <div data-tour="tour-chat-share-demo" className={`${shell} overflow-hidden p-0`}>
        <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
            Contenido compartido
          </p>
        </div>
        <div className="m-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] p-3">
          <p className="text-xs font-semibold text-[color:var(--text-primary)]">Publicación · Miembro Qyntra</p>
          <p className="mt-1 text-xs text-[color:var(--text-muted)]">Nuevo PR en sentadilla 💪</p>
          <div
            className="mt-2 h-16 rounded-lg"
            style={{
              background:
                'linear-gradient(135deg, rgba(var(--color-primary-rgb),0.3), rgba(var(--color-accent-rgb),0.15))'
            }}
          />
        </div>
      </div>
    )
  }

  if (demoId === 'chat-styles') {
    return (
      <div data-tour="tour-chat-styles-demo" className={`${shell} overflow-hidden p-0`}>
        <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
            Estilo del chat
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          <div className="rounded-xl border-2 border-[color:var(--color-primary)] p-2">
            <div className="flex h-14 items-center justify-center rounded-lg bg-[color:var(--bg-muted)] text-[10px] font-medium text-[color:var(--text-secondary)]">
              Sin estilo
            </div>
            <p className="mt-1.5 text-xs font-semibold text-[color:var(--text-primary)]">Adaptativo</p>
          </div>
          <div className="rounded-xl border border-[color:var(--border-subtle)] p-2">
            <div
              className="h-14 rounded-lg"
              style={{
                background: 'linear-gradient(180deg,#1c0802,#ea580c 55%,#fbbf24)'
              }}
            />
            <p className="mt-1.5 text-xs font-semibold text-[color:var(--text-primary)]">Forja</p>
          </div>
        </div>
        <p className="px-3 pb-3 text-[11px] text-[color:var(--text-muted)]">
          Con un estilo activo, el chat se adapta al fondo y se lee mejor
        </p>
      </div>
    )
  }

  if (demoId === 'chat-shared') {
    return (
      <div data-tour="tour-chat-shared-demo" className={`${shell} overflow-hidden p-0`}>
        <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
            Archivos y publicaciones
          </p>
          <div className="mt-2 flex gap-1.5">
            {['Publicaciones', 'Archivos', 'Enlaces'].map((label, i) => (
              <span
                key={label}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                  i === 0
                    ? 'bg-[color:var(--color-primary)] text-white'
                    : 'bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)]'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 p-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="aspect-square rounded-xl bg-[color:var(--bg-muted)] p-2"
            >
              <span className="text-base">📝</span>
              <p className="mt-1 line-clamp-2 text-[9px] text-[color:var(--text-muted)]">Post compartido</p>
            </div>
          ))}
        </div>
        <p className="px-3 pb-3 text-[11px] text-[color:var(--text-muted)]">Sin audios ni “ver una vez”</p>
      </div>
    )
  }

  if (demoId === 'chat-options') {
    return (
      <div data-tour="tour-chat-options-demo" className={`${shell} p-2`}>
        <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Opciones del chat
        </p>
        {[
          'Archivos y publicaciones',
          'Ver entrenamientos',
          'Estilo del chat',
          'Vaciar chat',
          'Crear acceso directo'
        ].map((label) => (
          <div
            key={label}
            className="rounded-xl px-3 py-2.5 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)]"
          >
            {label}
          </div>
        ))}
      </div>
    )
  }

  if (demoId === 'class-enroll') {
    return (
      <div data-tour="tour-class-enroll" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Clase grupal
        </p>
        <h3 className="mt-1 font-display text-lg">HIIT Burning</h3>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">Hoy · 18:00 · Coach Ana · 8/12 cupos</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--bg-muted)]">
          <div className="h-full w-2/3 rounded-full bg-[color:var(--color-primary)]" />
        </div>
        <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[color:var(--color-primary)] py-2.5 text-sm font-semibold text-white">
          <FiCheck size={16} /> Inscribirse
        </div>
      </div>
    )
  }

  if (demoId === 'settings-workout-nav') {
    return (
      <div data-tour="tour-settings-workout-section" className={`${shell} p-3`}>
        <div className="flex items-center gap-3 rounded-xl bg-[rgba(var(--color-primary-rgb),0.12)] px-3 py-3 text-[color:var(--color-primary)]">
          <FiTarget size={18} />
          <span className="flex-1 text-sm font-semibold">Entrenamiento</span>
          <span className="text-xs opacity-70">›</span>
        </div>
      </div>
    )
  }

  if (demoId === 'settings-rest-timer') {
    return (
      <div data-tour="tour-settings-rest-timer" className={`${shell} px-4 py-5`}>
        <p className="text-sm font-medium text-[color:var(--text-primary)]">Timer de Descanso</p>
        <div className="mt-3 h-2 rounded-full bg-[color:var(--bg-muted)]">
          <div className="h-full w-1/3 rounded-full bg-[color:var(--color-primary)]" />
        </div>
        <p className="mt-3 text-center font-display text-3xl tabular-nums text-[color:var(--color-primary)]">
          60s
        </p>
        <p className="mt-1 text-center text-[11px] text-[color:var(--text-muted)]">
          Se usa al completar un ejercicio
        </p>
      </div>
    )
  }

  if (demoId === 'settings-rest-autostart') {
    return (
      <div
        data-tour="tour-settings-rest-autostart"
        className={`${shell} flex items-center justify-between gap-3 px-4 py-4`}
      >
        <div>
          <p className="text-sm font-medium text-[color:var(--text-primary)]">Auto-iniciar Timer</p>
          <p className="text-xs text-[color:var(--text-muted)]">Al completar el ejercicio</p>
        </div>
        <div className="h-6 w-11 rounded-full bg-[color:var(--color-primary)] p-0.5">
          <div className="ml-auto h-5 w-5 rounded-full bg-white" />
        </div>
      </div>
    )
  }

  if (demoId === 'settings-permissions-nav') {
    return (
      <div data-tour="tour-settings-permissions-section" className={`${shell} p-3`}>
        <div className="flex items-center gap-3 rounded-xl bg-[rgba(var(--color-primary-rgb),0.12)] px-3 py-3 text-[color:var(--color-primary)]">
          <FiHardDrive size={18} />
          <span className="flex-1 text-sm font-semibold">Permisos</span>
        </div>
      </div>
    )
  }

  if (demoId === 'settings-storage-access') {
    return (
      <div
        data-tour="tour-settings-storage-access"
        className={`${shell} flex items-center justify-between gap-3 px-4 py-4`}
      >
        <div>
          <p className="text-sm font-medium text-[color:var(--text-primary)]">Acceso a almacenamiento</p>
          <p className="text-xs text-[color:var(--text-muted)]">Fotos y videos para historias</p>
        </div>
        <div className="h-6 w-11 rounded-full bg-[color:var(--color-primary)] p-0.5">
          <div className="ml-auto h-5 w-5 rounded-full bg-white" />
        </div>
      </div>
    )
  }

  if (demoId === 'settings-notifications-nav') {
    return (
      <div data-tour="tour-settings-notifications-section" className={`${shell} p-3`}>
        <div className="flex items-center gap-3 rounded-xl bg-[rgba(var(--color-primary-rgb),0.12)] px-3 py-3 text-[color:var(--color-primary)]">
          <FiBell size={18} />
          <span className="flex-1 text-sm font-semibold">Notificaciones</span>
        </div>
      </div>
    )
  }

  if (demoId === 'settings-notifications-push') {
    return (
      <div
        data-tour="tour-settings-notifications-push"
        className={`${shell} flex items-center justify-between gap-3 px-4 py-4`}
      >
        <div>
          <p className="text-sm font-medium text-[color:var(--text-primary)]">Notificaciones Push</p>
          <p className="text-xs text-[color:var(--text-muted)]">Activa o silencia alertas</p>
        </div>
        <div className="h-6 w-11 rounded-full bg-[color:var(--bg-muted)] p-0.5">
          <div className="h-5 w-5 rounded-full bg-white" />
        </div>
      </div>
    )
  }

  if (demoId === 'settings-privacy-nav') {
    return (
      <div data-tour="tour-settings-privacy-section" className={`${shell} p-3`}>
        <div className="flex items-center gap-3 rounded-xl bg-[rgba(var(--color-primary-rgb),0.12)] px-3 py-3 text-[color:var(--color-primary)]">
          <FiEye size={18} />
          <span className="flex-1 text-sm font-semibold">Privacidad</span>
        </div>
      </div>
    )
  }

  if (demoId === 'settings-profile-public') {
    return (
      <div
        data-tour="tour-settings-profile-public"
        className={`${shell} flex items-center justify-between gap-3 px-4 py-4`}
      >
        <div>
          <p className="text-sm font-medium text-[color:var(--text-primary)]">Perfil Público</p>
          <p className="text-xs text-[color:var(--text-muted)]">Visible para la comunidad</p>
        </div>
        <div className="h-6 w-11 rounded-full bg-[color:var(--color-primary)] p-0.5">
          <div className="ml-auto h-5 w-5 rounded-full bg-white" />
        </div>
      </div>
    )
  }

  if (demoId === 'stories-create') {
    return (
      <div data-tour="tour-stories-create-demo" className={`${shell} overflow-hidden`}>
        <p className="px-4 pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ejemplo · Nueva historia
        </p>
        <div className="mt-3 flex items-center gap-3 px-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-[color:var(--color-primary)] text-2xl text-[color:var(--color-primary)]">
            +
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">Tu historia</p>
            <p className="text-xs text-[color:var(--text-muted)]">Foto o video · 24 h</p>
          </div>
        </div>
        <div
          className="mx-4 mt-3 h-24 rounded-xl"
          style={{
            background:
              'linear-gradient(145deg, rgba(var(--color-primary-rgb),0.4), rgba(var(--color-accent-rgb),0.2))'
          }}
        />
        <p className="px-4 py-3 text-xs text-[color:var(--text-secondary)]">
          Añade descripción y @menciones antes de publicar.
        </p>
      </div>
    )
  }

  if (demoId === 'stories-viewer') {
    return (
      <div
        data-tour="tour-stories-viewer-demo"
        className={`${shell} relative aspect-[9/14] max-h-[360px] overflow-hidden bg-black p-0`}
      >
        <div className="absolute inset-x-3 top-3 z-10 flex gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: i === 1 ? '70%' : i === 2 ? '0%' : '0%' }}
              />
            </div>
          ))}
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 28%, transparent 55%, rgba(0,0,0,0.65) 100%), linear-gradient(135deg, #3d4f6f, #1a1f2e)'
          }}
        />
        <div className="absolute inset-x-0 bottom-4 px-4 text-center text-xs text-white/80">
          Toca lados · desliza para cambiar
        </div>
      </div>
    )
  }

  if (demoId === 'stories-react') {
    return (
      <div data-tour="tour-stories-react-demo" className={`${shell} overflow-hidden p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ejemplo · Responder
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {['❤️', '🔥', '💪', '👏'].map((e) => (
            <span
              key={e}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--bg-muted)] text-lg"
            >
              {e}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/60 px-3 py-2">
          <span className="flex-1 text-xs text-[color:var(--text-muted)]">Responder…</span>
          <FiMessageCircle className="text-[color:var(--color-primary)]" size={16} />
        </div>
      </div>
    )
  }

  if (demoId === 'stories-own') {
    return (
      <div data-tour="tour-stories-own-demo" className={`${shell} overflow-hidden`}>
        <div className="flex items-center justify-between px-4 pt-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
              Mi estado
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[color:var(--text-primary)]">Hace 2 h</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(var(--color-primary-rgb),0.14)] px-2.5 py-1 text-xs font-semibold text-[color:var(--color-primary)]">
            <FiEye size={12} /> 12
          </span>
        </div>
        <div className="mx-4 mt-3 space-y-2 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]/40 p-3">
          <p className="text-xs font-semibold text-[color:var(--text-primary)]">Visto por 12</p>
          <div className="flex -space-x-2">
            {['A', 'B', 'C', 'D'].map((l) => (
              <div
                key={l}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[color:var(--bg-elevated)] bg-[rgba(var(--color-primary-rgb),0.25)] text-[10px] font-bold"
              >
                {l}
              </div>
            ))}
          </div>
        </div>
        <p className="px-4 py-3 text-xs text-[color:var(--text-muted)]">
          Abre el ojo para ver quién miró y cómo reaccionó.
        </p>
      </div>
    )
  }

  if (demoId === 'stories-share') {
    return (
      <div data-tour="tour-stories-share-demo" className={`${shell} p-3`}>
        <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
          Ejemplo · Menú
        </p>
        {[
          'Reenviar en chat',
          'Guardar',
          'Compartir en Facebook',
          'Compartir en Instagram',
          'Añadir a favoritos',
          'Eliminar'
        ].map((label) => (
          <div
            key={label}
            className="rounded-xl px-3 py-2.5 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)]"
          >
            {label}
          </div>
        ))}
      </div>
    )
  }

  if (demoId === 'qysi-fab') {
    return (
      <div data-tour="tour-qysi-fab-demo" className={`${shell} overflow-hidden p-0`}>
        <div className="relative flex h-36 items-end justify-end bg-[radial-gradient(ellipse_at_70%_40%,rgba(var(--color-primary-rgb),0.22),transparent_65%)] px-5 pb-5">
          <p className="absolute left-4 top-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
            Ejemplo · Burbuja
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--color-primary-rgb),0.35)] bg-[color:var(--bg-elevated)] py-2 pl-2 pr-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.35)]">
            <QySiAvatar size={36} />
            <span className="text-sm font-semibold text-[color:var(--text-primary)]">QySi</span>
          </div>
        </div>
        <p className="border-t border-[color:var(--border-subtle)] px-4 py-3 text-xs leading-relaxed text-[color:var(--text-secondary)]">
          La burbuja flota en Entrenamientos. Tócala para abrir el asistente.
        </p>
      </div>
    )
  }

  if (demoId === 'qysi-offer') {
    return (
      <div data-tour="tour-qysi-offer-demo" className={`${shell} p-4`}>
        <div className="flex items-center gap-2.5">
          <QySiAvatar size={40} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
              Ejemplo · Oferta
            </p>
            <p className="font-display text-base text-[color:var(--text-primary)]">Qué te da QySi</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {['Gimnasio', 'Casa', 'Calistenia', 'Running', 'Full body'].map((label, i) => (
            <div
              key={label}
              className={`rounded-xl border px-2.5 py-2.5 text-center text-[11px] font-semibold ${
                i === 0
                  ? 'border-[rgba(var(--color-primary-rgb),0.45)] bg-[rgba(var(--color-primary-rgb),0.14)] text-[color:var(--color-primary)]'
                  : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)]'
              } ${i === 4 ? 'col-span-2' : ''}`}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (demoId === 'qysi-path') {
    return (
      <div data-tour="tour-qysi-path-demo" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ejemplo · Ruta
        </p>
        <p className="mt-1 font-display text-base text-[color:var(--text-primary)]">Arma tu plan</p>
        <ol className="mt-3 space-y-2">
          {[
            { n: '1', t: 'Dónde entrenas', d: 'Gimnasio', active: false },
            { n: '2', t: 'Enfoque', d: 'Full body', active: true },
            { n: '3', t: 'Nivel', d: 'Elige…', active: false }
          ].map((row) => (
            <li
              key={row.n}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
                row.active
                  ? 'border-[rgba(var(--color-primary-rgb),0.45)] bg-[rgba(var(--color-primary-rgb),0.1)]'
                  : 'border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)]'
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--color-primary-rgb),0.16)] text-xs font-bold text-[color:var(--color-primary)]">
                {row.n}
              </span>
              <span>
                <span className="block text-sm font-semibold text-[color:var(--text-primary)]">{row.t}</span>
                <span className="text-[11px] text-[color:var(--text-muted)]">{row.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  if (demoId === 'qysi-adopt') {
    return (
      <div data-tour="tour-qysi-adopt-demo" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ejemplo · Adoptar
        </p>
        <div className="mt-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] p-3">
          <div className="flex items-center gap-2">
            <QySiAvatar size={28} />
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">QySi · Full Body</p>
              <p className="text-[11px] text-[color:var(--text-muted)]">6 ejercicios · intermedio</p>
            </div>
          </div>
          <div className="btn-primary mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-sm">
            Adoptar rutina
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-[color:var(--text-secondary)]">
          Tras adoptarla, aparece en tu lista con la etiqueta de QySi.
        </p>
      </div>
    )
  }

  if (demoId === 'qysi-no-edit') {
    return (
      <div data-tour="tour-qysi-no-edit-demo" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ejemplo · Bloqueo
        </p>
        <div className="mt-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">QySi · Full Body</p>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[rgba(var(--color-primary-rgb),0.12)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--color-primary)]">
                <QySiAvatar size={12} /> QySi
              </span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border-subtle)] px-2 py-1 text-[10px] font-semibold text-[color:var(--text-muted)]">
              <FiLock size={11} /> Bloqueada
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 opacity-45">
            <div className="rounded-xl border border-dashed border-[color:var(--border-subtle)] py-2 text-center text-[11px] text-[color:var(--text-muted)] line-through">
              Editar
            </div>
            <div className="rounded-xl border border-dashed border-[color:var(--border-subtle)] py-2 text-center text-[11px] text-[color:var(--text-muted)] line-through">
              Hacer pública
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[color:var(--text-secondary)]">
            Entrena tal cual o crea tu propia rutina si quieres personalizar.
          </p>
        </div>
      </div>
    )
  }

  if (demoId === 'qysi-start') {
    return (
      <div data-tour="tour-qysi-start-demo" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Ejemplo · Iniciar
        </p>
        <h3 className="mt-1 font-display text-lg text-[color:var(--text-primary)]">QySi · Full Body</h3>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[rgba(var(--color-primary-rgb),0.35)] bg-[rgba(var(--color-primary-rgb),0.12)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-primary)]">
          <QySiAvatar size={14} /> Rutina de QySi
        </span>
        <p className="mt-2 text-xs text-[color:var(--text-muted)]">6 ejercicios · ~45 min</p>
        <div className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-3">
          <FiPlay size={16} /> Iniciar
        </div>
      </div>
    )
  }

  return null
}
