import { Link } from 'react-router-dom'
import { FiActivity, FiAward, FiClock } from 'react-icons/fi'
import { Avatar } from '../utils/avatarUtils'

/**
 * Facebook-style embedded original post shown inside a reshare.
 */
export default function SharedPostAttachment({ shared, onOpenRoutine }) {
  if (!shared) return null

  const author = typeof shared.user === 'object' ? shared.user : null
  const name = author?.name || 'Usuario'
  const workout = shared.workoutData
  const isRoutine =
    shared.postType === 'routine' || workout?.isRoutine || workout?.shareKind === 'routine'

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-app bg-[color:var(--bg-muted)]/60">
      <div className="flex items-center gap-2.5 border-b border-app px-3.5 py-2.5">
        {author ? (
          <Link to={`/user/${author._id || author.id}`} className="shrink-0">
            <Avatar avatar={author.avatar} name={name} size="sm" />
          </Link>
        ) : (
          <Avatar name={name} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          {author ? (
            <Link
              to={`/user/${author._id || author.id}`}
              className="block truncate text-sm font-semibold text-app hover:text-primary-500"
            >
              {name}
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold text-app">{name}</p>
          )}
          <p className="text-[11px] text-app-secondary">Publicación original</p>
        </div>
      </div>

      <div className="space-y-3 px-3.5 py-3">
        {shared.content && !String(shared.content).includes('[workout]') && (
          <p className="text-sm leading-relaxed text-app break-words">{shared.content}</p>
        )}
        {shared.content && String(shared.content).includes('[workout]') && (
          <p className="text-sm leading-relaxed text-app break-words">
            {String(shared.content).replace(/\[workout\][\s\S]*?\[\/workout\]/g, '').trim()}
          </p>
        )}

        {shared.postType === 'badge' && shared.badgeData && (
          <div className="flex items-center gap-3 rounded-xl border border-accent-yellow/30 bg-accent-yellow/10 p-3">
            <span className="text-3xl">{shared.badgeData.badgeIcon}</span>
            <div>
              <p className="flex items-center gap-1 text-xs text-accent-yellow">
                <FiAward size={12} /> Insignia
              </p>
              <p className="font-semibold text-app">{shared.badgeData.badgeName}</p>
            </div>
          </div>
        )}

        {workout && isRoutine && (
          <button
            type="button"
            onClick={() => onOpenRoutine?.(workout, author)}
            className="w-full overflow-hidden rounded-xl border border-accent-cyan/30 bg-gradient-to-br from-accent-cyan/10 to-primary-500/5 p-3 text-left"
          >
            <div className="mb-2 flex items-center gap-2 text-accent-cyan">
              <FiActivity size={14} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">Rutina</span>
            </div>
            <p className="font-display text-lg text-app">{workout.name}</p>
            <p className="mt-1 text-xs text-app-secondary">
              {workout.totalExercises || workout.exercises?.length || 0} ejercicios
            </p>
          </button>
        )}

        {workout && !isRoutine && (
          <button
            type="button"
            onClick={() => onOpenRoutine?.(workout, author)}
            className="w-full overflow-hidden rounded-xl border border-primary-500/25 bg-gradient-to-br from-primary-500/10 to-accent-cyan/5 p-3 text-left"
          >
            <div className="mb-2 flex items-center gap-2 text-primary-500">
              <FiActivity size={14} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                Entrenamiento
              </span>
            </div>
            <p className="font-display text-lg text-app">{workout.name}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-app-secondary">
              <span>
                {workout.completedExercises}/{workout.totalExercises} ej.
              </span>
              {workout.totalSets != null && <span>{workout.totalSets} series</span>}
              {workout.durationSeconds != null && (
                <span className="inline-flex items-center gap-1">
                  <FiClock size={11} /> {Math.floor((workout.durationSeconds || 0) / 60)}m
                </span>
              )}
            </div>
          </button>
        )}

        {shared.images?.length > 0 && (
          <div className={`grid gap-1.5 ${shared.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {shared.images.slice(0, 4).map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt=""
                className={`w-full rounded-lg object-cover ${
                  shared.images.length === 1 ? 'max-h-56' : 'h-28'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
