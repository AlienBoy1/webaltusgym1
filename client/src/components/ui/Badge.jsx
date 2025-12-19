const variants = {
  primary: 'bg-primary-500/20 text-primary-500',
  success: 'bg-accent-green/20 text-accent-green',
  warning: 'bg-yellow-500/20 text-yellow-500',
  danger: 'bg-red-500/20 text-red-500',
  info: 'bg-accent-cyan/20 text-accent-cyan',
  purple: 'bg-accent-purple/20 text-accent-purple',
  gray: 'bg-gray-500/20 text-gray-400',
}

export default function Badge({ 
  children, 
  variant = 'primary',
  size = 'md',
  className = '' 
}) {
  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-3 py-1',
    lg: 'text-sm px-4 py-1.5'
  }
  
  return (
    <span className={`
      inline-flex items-center rounded-full font-medium
      ${variants[variant]} ${sizes[size]} ${className}
    `}>
      {children}
    </span>
  )
}

