import React from 'react'

interface AvatarProps {
  src?: string
  alt?: string
  fallback?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  onClick?: () => void
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  fallback,
  size = 'md',
  className = '',
  onClick
}) => {
  const [imageError, setImageError] = React.useState(false)
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-gray-700 text-white font-medium overflow-hidden ${
        onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
      } ${sizeClasses[size]} ${className}`}
      onClick={onClick}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span>
          {fallback ? getInitials(fallback) : '?'}
        </span>
      )}
    </div>
  )
}

interface AvatarGroupProps {
  children: React.ReactNode
  max?: number
  className?: string
}

const AvatarGroup: React.FC<AvatarGroupProps> = ({
  children,
  max = 3,
  className = ''
}) => {
  const childrenArray = React.Children.toArray(children)
  const visibleChildren = childrenArray.slice(0, max)
  const remainingCount = childrenArray.length - max

  return (
    <div className={`flex -space-x-2 ${className}`}>
      {visibleChildren.map((child, index) => (
        <div key={index} className="relative">
          {child}
        </div>
      ))}
      {remainingCount > 0 && (
        <div className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-600 text-white text-sm font-medium border-2 border-gray-800">
          +{remainingCount}
        </div>
      )}
    </div>
  )
}

export { Avatar, AvatarGroup }
