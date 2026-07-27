const sizeMap = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
}

/**
 * Isotipo Qyntra — Q geométrica con trazo ascendente (progreso / potencia).
 */
export default function QyntraLogo({
  size = 'md',
  className = '',
  withGlow = false,
  rounded = 'xl',
}) {
  const box = sizeMap[size] || sizeMap.md
  const radius =
    rounded === 'lg' ? 'rounded-lg' :
    rounded === 'xl' ? 'rounded-xl' :
    rounded === '2xl' ? 'rounded-2xl' :
    'rounded-xl'

  return (
    <div
      className={`${box} ${radius} bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0 ${withGlow ? 'glow-primary' : ''} ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="w-[72%] h-[72%]" fill="none">
        <circle
          cx="46"
          cy="46"
          r="24"
          stroke="white"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M54 58 L78 82"
          stroke="white"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d="M34 30 L42 22"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    </div>
  )
}

export function QyntraWordmark({ className = '', showGym = false }) {
  return (
    <span className={`font-display tracking-wider ${className}`}>
      <span className="text-primary-500">QYNTRA</span>
      {showGym ? <span className="text-white"> GYM</span> : null}
    </span>
  )
}
