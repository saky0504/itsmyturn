import React from 'react'

interface ProgressProps {
  value?: number
  max?: number
  className?: string
}

const Progress: React.FC<ProgressProps> = ({ value = 0, max = 100, className = '' }) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div className={`relative h-2 w-full overflow-hidden rounded-full bg-gray-700 ${className}`}>
      <div
        className="h-full w-full flex-1 bg-green-500 transition-all duration-300 ease-in-out"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  )
}

export { Progress }
