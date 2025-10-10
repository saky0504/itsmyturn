import React from 'react'

interface AspectRatioProps {
  ratio?: number
  children: React.ReactNode
  className?: string
}

const AspectRatio: React.FC<AspectRatioProps> = ({
  ratio = 16 / 9,
  children,
  className = ''
}) => {
  return (
    <div className={`relative w-full ${className}`}>
      <div
        className="absolute inset-0"
        style={{ paddingBottom: `${(1 / ratio) * 100}%` }}
      />
      <div className="absolute inset-0">
        {children}
      </div>
    </div>
  )
}

export default AspectRatio
