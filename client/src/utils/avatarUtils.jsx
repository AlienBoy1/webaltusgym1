import React from 'react'
import { 
  FiActivity, FiTarget, FiZap, FiTrendingUp, 
  FiAward, FiStar, FiHeart, FiShield, FiUser, FiCoffee, FiSun
} from 'react-icons/fi'

const exerciseAvatars = {
  muscle: { Icon: FiActivity, gradient: 'from-orange-500 to-red-600' },
  target: { Icon: FiTarget, gradient: 'from-blue-500 to-cyan-600' },
  energy: { Icon: FiZap, gradient: 'from-green-500 to-emerald-600' },
  trending: { Icon: FiTrendingUp, gradient: 'from-purple-500 to-pink-600' },
  award: { Icon: FiAward, gradient: 'from-indigo-500 to-blue-600' },
  star: { Icon: FiStar, gradient: 'from-red-500 to-orange-600' },
  heart: { Icon: FiHeart, gradient: 'from-cyan-500 to-blue-600' },
  shield: { Icon: FiShield, gradient: 'from-amber-500 to-yellow-600' },
  user: { Icon: FiUser, gradient: 'from-yellow-500 to-orange-600' },
  coffee: { Icon: FiCoffee, gradient: 'from-red-600 to-pink-600' },
  sun: { Icon: FiSun, gradient: 'from-yellow-400 to-amber-500' },
  activity2: { Icon: FiActivity, gradient: 'from-gray-600 to-gray-800' }
}

export const getAvatarDisplay = (avatar, name, size = 'md') => {
  const sizes = {
    sm: { container: 'w-8 h-8', icon: 16, text: 'text-sm' },
    md: { container: 'w-12 h-12', icon: 24, text: 'text-lg' },
    lg: { container: 'w-24 h-24', icon: 48, text: 'text-4xl' },
    xl: { container: 'w-32 h-32', icon: 64, text: 'text-6xl' }
  }
  
  const sizeConfig = sizes[size] || sizes.md
  
  if (!avatar) {
    return {
      type: 'initial',
      content: name?.charAt(0) || 'U',
      className: `rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center ${sizeConfig.container} ${sizeConfig.text} font-bold`
    }
  }
  
  if (avatar.startsWith('data:') || avatar.startsWith('http')) {
    return {
      type: 'image',
      content: avatar,
      className: `rounded-full overflow-hidden ${sizeConfig.container}`
    }
  }
  
  if (avatar.startsWith('icon:')) {
    const iconId = avatar.replace('icon:', '')
    const avatarConfig = exerciseAvatars[iconId] || exerciseAvatars.user
    const IconComponent = avatarConfig.Icon
    
    return {
      type: 'icon',
      content: <IconComponent size={sizeConfig.icon} className="text-white" />,
      className: `rounded-full bg-gradient-to-br ${avatarConfig.gradient} flex items-center justify-center ${sizeConfig.container}`
    }
  }
  
  // Fallback to initial
  return {
    type: 'initial',
    content: name?.charAt(0) || 'U',
    className: `rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center ${sizeConfig.container} ${sizeConfig.text} font-bold`
  }
}

export const Avatar = ({ avatar, name, size = 'md', className = '' }) => {
  const display = getAvatarDisplay(avatar, name, size)
  
  if (display.type === 'image') {
    return (
      <div className={`${display.className} ${className}`}>
        <img src={display.content} alt={name} className="w-full h-full object-cover rounded-full" />
      </div>
    )
  }
  
  if (display.type === 'icon') {
    return (
      <div className={`${display.className} ${className}`}>
        {display.content}
      </div>
    )
  }
  
  return (
    <div className={`${display.className} ${className}`}>
      {display.content}
    </div>
  )
}

