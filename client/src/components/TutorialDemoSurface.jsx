import { FiCheck, FiMessageCircle, FiPlay, FiShare2, FiSkipForward, FiTarget, FiUsers, FiHardDrive, FiBell, FiEye } from 'react-icons/fi'

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
        <div className="mr-auto max-w-[80%] rounded-2xl rounded-bl-md border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-3 py-2 text-sm">
          ¿Entrenamos juntos mañana?
          <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">10:21</p>
        </div>
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-[color:var(--color-primary)] px-3 py-2 text-sm text-white">
          ¡Dale! A las 7 en el gym.
          <p className="mt-1 text-right text-[10px] text-white/75">10:22 · leído</p>
        </div>
      </div>
    )
  }

  if (demoId === 'chat-compose') {
    return (
      <div data-tour="tour-chat-compose-demo" className={`${shell} p-4`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Enviar mensaje
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="rounded-full bg-[color:var(--bg-muted)] px-2 py-1 text-[11px]">😊</span>
          <span className="rounded-full bg-[color:var(--bg-muted)] px-2 py-1 text-[11px]">📷</span>
          <span className="rounded-full bg-[color:var(--bg-muted)] px-2 py-1 text-[11px]">📎</span>
          <span className="rounded-full bg-[color:var(--bg-muted)] px-2 py-1 text-[11px]">🎤</span>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-muted)] px-3 py-2.5">
          <span className="flex-1 text-sm text-[color:var(--text-muted)]">Escribe un mensaje…</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-white">
            <FiShare2 size={14} className="rotate-45" />
          </span>
        </div>
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

  if (demoId === 'chat-options') {
    return (
      <div data-tour="tour-chat-options-demo" className={`${shell} p-2`}>
        <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--color-primary)]">
          Opciones del chat
        </p>
        {['Archivos y publicaciones', 'Ver entrenamientos', 'Estilo del chat', 'Vaciar chat', 'Crear acceso directo'].map(
          (label) => (
            <div
              key={label}
              className="rounded-xl px-3 py-2.5 text-sm text-[color:var(--text-primary)] hover:bg-[color:var(--bg-muted)]"
            >
              {label}
            </div>
          )
        )}
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

  return null
}
