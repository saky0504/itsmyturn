import React, { useState } from 'react'

interface ToggleGroupItem {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

interface ToggleGroupProps {
  items: ToggleGroupItem[]
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  type?: 'single' | 'multiple'
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline'
  className?: string
}

const ToggleGroup: React.FC<ToggleGroupProps> = ({
  items,
  value: controlledValue,
  defaultValue = [],
  onValueChange,
  type = 'multiple',
  size = 'md',
  variant = 'default',
  className = ''
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const value = controlledValue !== undefined ? controlledValue : internalValue

  const sizeClasses = {
    sm: 'h-8 px-2 text-xs',
    md: 'h-9 px-3 text-sm',
    lg: 'h-10 px-4 text-base'
  }

  const variantClasses = {
    default: 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white',
    outline: 'border border-gray-600 bg-transparent text-gray-300 hover:bg-gray-700 hover:text-white'
  }

  const activeClasses = {
    default: 'bg-gray-700 text-white',
    outline: 'border border-gray-600 bg-gray-700 text-white'
  }

  const handleToggle = (itemValue: string) => {
    let newValue: string[]
    
    if (type === 'single') {
      newValue = value.includes(itemValue) ? [] : [itemValue]
    } else {
      newValue = value.includes(itemValue)
        ? value.filter(v => v !== itemValue)
        : [...value, itemValue]
    }

    if (controlledValue === undefined) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }

  return (
    <div className={`inline-flex rounded-md border border-gray-700 overflow-hidden ${className}`}>
      {items.map((item) => (
        <button
          key={item.value}
          onClick={() => handleToggle(item.value)}
          disabled={item.disabled}
          className={`inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:pointer-events-none disabled:opacity-50 ${
            sizeClasses[size]
          } ${
            value.includes(item.value) ? activeClasses[variant] : variantClasses[variant]
          } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export default ToggleGroup
