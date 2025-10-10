import React from 'react'

interface ToggleProps {
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline'
  children: React.ReactNode
  className?: string
}

const Toggle: React.FC<ToggleProps> = ({
  pressed = false,
  onPressedChange,
  disabled = false,
  size = 'md',
  variant = 'default',
  children,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'h-8 px-2 text-xs',
    md: 'h-9 px-3 text-sm',
    lg: 'h-10 px-4 text-base'
  }

  const variantClasses = {
    default: pressed 
      ? 'bg-gray-700 text-white' 
      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white',
    outline: pressed
      ? 'border border-gray-600 bg-gray-700 text-white'
      : 'border border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white'
  }

  return (
    <button
      onClick={() => onPressedChange?.(!pressed)}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:pointer-events-none disabled:opacity-50 ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export default Toggle
