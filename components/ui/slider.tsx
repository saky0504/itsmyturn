import React, { useState, useRef, useEffect } from 'react'

interface SliderProps {
  value?: number
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  onChange?: (value: number) => void
  disabled?: boolean
  className?: string
}

const Slider: React.FC<SliderProps> = ({
  value: controlledValue,
  defaultValue = 0,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  className = ''
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const [isDragging, setIsDragging] = useState(false)
  const sliderRef = useRef<HTMLDivElement>(null)
  
  const value = controlledValue !== undefined ? controlledValue : internalValue
  const percentage = ((value - min) / (max - min)) * 100

  const updateValue = (clientX: number) => {
    if (!sliderRef.current || disabled) return

    const rect = sliderRef.current.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const newValue = min + percentage * (max - min)
    const steppedValue = Math.round(newValue / step) * step
    const clampedValue = Math.max(min, Math.min(max, steppedValue))

    if (controlledValue === undefined) {
      setInternalValue(clampedValue)
    }
    onChange?.(clampedValue)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return
    setIsDragging(true)
    updateValue(e.clientX)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    updateValue(e.clientX)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div className={`relative ${className}`}>
      <div
        ref={sliderRef}
        className={`relative h-2 bg-gray-700 rounded-full cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        {/* Track */}
        <div className="absolute inset-0 bg-gray-700 rounded-full" />
        
        {/* Active track */}
        <div
          className="absolute inset-y-0 bg-green-500 rounded-full"
          style={{ width: `${percentage}%` }}
        />
        
        {/* Thumb */}
        <div
          className={`absolute top-1/2 w-4 h-4 bg-white border-2 border-green-500 rounded-full transform -translate-y-1/2 -translate-x-1/2 transition-all ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:scale-110'
          }`}
          style={{ left: `${percentage}%` }}
        />
      </div>
      
      {/* Value display */}
      <div className="mt-1 text-sm text-gray-400 text-center">
        {value}
      </div>
    </div>
  )
}

export default Slider
