/** WhatsApp-style “view once” mark (circle + 1 + dashed arc). */
export default function ViewOnceIcon({ size = 22, active = false, className = '' }) {
  const stroke = active ? 'var(--color-primary)' : 'currentColor'
  const fill = active ? 'rgba(var(--color-primary-rgb),0.14)' : 'transparent'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth="1.7" fill={fill} />
      <path
        d="M18.2 7.2a9 9 0 0 0-3.4-2.4"
        stroke={stroke}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeDasharray="1.6 2.2"
      />
      <text
        x="12"
        y="12.5"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={stroke}
        fontSize="10"
        fontWeight="700"
        fontFamily="Outfit, system-ui, sans-serif"
      >
        1
      </text>
    </svg>
  )
}
