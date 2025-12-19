import { forwardRef } from 'react'

const Input = forwardRef(({ 
  label, 
  error, 
  icon: Icon, 
  className = '',
  ...props 
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="text-sm text-gray-400 mb-2 block">{label}</label>
      )}
      <div className="relative">
        {Icon && (
          <Icon 
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" 
            size={20} 
          />
        )}
        <input
          ref={ref}
          className={`
            w-full bg-dark-200 border rounded-xl px-4 py-3 text-white
            placeholder:text-gray-500 
            focus:outline-none focus:border-primary-500
            transition-all duration-300
            ${Icon ? 'pl-12' : ''}
            ${error ? 'border-red-500' : 'border-white/10'}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input

