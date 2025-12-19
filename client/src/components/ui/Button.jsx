import { motion } from 'framer-motion'

const variants = {
  primary: 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg hover:shadow-primary-500/30',
  secondary: 'bg-dark-100 text-white border border-white/10 hover:border-primary-500/50',
  ghost: 'text-gray-400 hover:text-white hover:bg-white/5',
  danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
  success: 'bg-accent-green/10 text-accent-green hover:bg-accent-green/20',
}

const sizes = {
  sm: 'py-2 px-3 text-sm',
  md: 'py-3 px-6',
  lg: 'py-4 px-8 text-lg',
}

export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '',
  loading = false,
  disabled = false,
  icon: Icon,
  ...props 
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={`
        inline-flex items-center justify-center gap-2 
        font-semibold rounded-xl transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
      ) : (
        <>
          {Icon && <Icon size={size === 'sm' ? 16 : 20} />}
          {children}
        </>
      )}
    </motion.button>
  )
}

