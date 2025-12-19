import { useState, useEffect, useCallback } from 'react'
import { FiPlay, FiPause, FiRotateCcw } from 'react-icons/fi'

export default function Timer({ initialTime = 60, autoStart = false, size = 'md', onComplete }) {
  const [timeLeft, setTimeLeft] = useState(initialTime)
  const [isRunning, setIsRunning] = useState(autoStart)
  
  useEffect(() => {
    let interval
    
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setIsRunning(false)
            onComplete?.()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    
    return () => clearInterval(interval)
  }, [isRunning, timeLeft, onComplete])
  
  const reset = useCallback(() => {
    setTimeLeft(initialTime)
    setIsRunning(false)
  }, [initialTime])
  
  const toggle = () => setIsRunning(prev => !prev)
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  const progress = (timeLeft / initialTime) * 100
  
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
        {/* Background circle */}
        <svg className="absolute inset-0 -rotate-90" width={s.circle} height={s.circle}>
          <circle
            cx={s.circle / 2}
            cy={s.circle / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
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
            className="transition-all duration-1000"
          />
        </svg>
        
        {/* Time display */}
        <div className={`absolute inset-0 flex items-center justify-center font-mono ${s.text} ${timeLeft <= 5 ? 'text-red-500' : 'text-white'}`}>
          {formatTime(timeLeft)}
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={toggle}
          className={`p-2 rounded-full ${isRunning ? 'bg-yellow-500' : 'bg-primary-500'} text-white`}
        >
          {isRunning ? <FiPause size={20} /> : <FiPlay size={20} />}
        </button>
        <button
          onClick={reset}
          className="p-2 rounded-full bg-dark-100 text-white"
        >
          <FiRotateCcw size={20} />
        </button>
      </div>
    </div>
  )
}
