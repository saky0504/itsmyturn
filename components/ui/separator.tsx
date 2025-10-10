import React from 'react'

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

const Separator: React.FC<SeparatorProps> = ({ orientation = 'horizontal', className = '' }) => (
  <div
    className={`bg-gray-600 ${
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px'
    } ${className}`}
  />
)

export { Separator }
