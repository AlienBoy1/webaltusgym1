import { FiPlay, FiPause, FiRotateCcw } from 'react-icons/fi'
import { formatTime } from '../utils/workoutSession'

/**
 * Circular rest timer.
 * Prefer controlled `remaining` + `total` from an absolute restEndsAt clock
 * so parent ticks don't remount / reset the ring every second.
 */
export default function Timer({
  remaining,
  total = 60,
  initialTime,
  autoStart = false,
  size = 'md',
  onComplete,
  controlled = remaining != null,
  onToggle,
  onReset,
  isRunning
}) {
  const displayTotal = total || initialTime || 60
  const timeLeft = controlled ? Math.max(0, remaining ?? 0) : Math.max(0, remaining ?? initialTime ?? 0)

  const progress = displayTotal > 0 ? (timeLeft / displayTotal) * 100 : 0

  const sizes = {
    sm: { circle: 80, stroke: 4, text: 'text-xl' },
    md: { circle: 120, stroke: 6, text: 'text-3xl' },
    lg: { circle: 160, stroke: 8, text: 'text-4xl' }
  }

  const s = sizes[size]
  const radius = (s.circle - s.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: s.circle, height: s.circle }}>
        <svg className="absolute inset-0 -rotate-90" width={s.circle} height={s.circle}>
          <circle
            cx={s.circle / 2}
            cy={s.circle / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-app opacity-15"
            strokeWidth={s.stroke}
          />
          <circle
            cx={s.circle / 2}
            cy={s.circle / 2}
            r={radius}
            fill="none"
            stroke={timeLeft <= 5 ? '#ef4444' : '#FF6B35'}
            strokeWidth={s.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-[stroke-dashoffset] duration-1000 linear"
          />
        </svg>

        <div
          className={`absolute inset-0 flex items-center justify-center font-mono tabular-nums ${s.text} ${
            timeLeft <= 5 ? 'text-red-500' : 'text-app'
          }`}
        >
          {formatTime(timeLeft)}
        </div>
      </div>

      {(onToggle || onReset) && (
        <div className="flex gap-2">
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className={`rounded-full p-2 text-white ${(isRunning ?? autoStart) ? 'bg-yellow-500' : 'bg-primary-500'}`}
            >
              {(isRunning ?? autoStart) ? <FiPause size={20} /> : <FiPlay size={20} />}
            </button>
          )}
          {onReset && (
            <button type="button" onClick={onReset} className="rounded-full bg-elevated border border-app p-2 text-app">
              <FiRotateCcw size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
