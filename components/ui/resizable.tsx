import React, { useState, useRef, useEffect } from 'react'

interface ResizableProps {
  children: React.ReactNode
  defaultSize?: { width: number; height: number }
  minSize?: { width: number; height: number }
  maxSize?: { width: number; height: number }
  className?: string
}

const Resizable: React.FC<ResizableProps> = ({
  children,
  defaultSize = { width: 300, height: 200 },
  minSize = { width: 100, height: 100 },
  maxSize = { width: 800, height: 600 },
  className = ''
}) => {
  const [size, setSize] = useState(defaultSize)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startPosRef = useRef({ x: 0, y: 0 })
  const startSizeRef = useRef({ width: 0, height: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startPosRef.current = { x: e.clientX, y: e.clientY }
    startSizeRef.current = { ...size }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const deltaX = e.clientX - startPosRef.current.x
      const deltaY = e.clientY - startPosRef.current.y

      const newWidth = Math.max(
        minSize.width,
        Math.min(maxSize.width, startSizeRef.current.width + deltaX)
      )
      const newHeight = Math.max(
        minSize.height,
        Math.min(maxSize.height, startSizeRef.current.height + deltaY)
      )

      setSize({ width: newWidth, height: newHeight })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, minSize, maxSize])

  return (
    <div
      ref={containerRef}
      className={`relative border border-gray-600 rounded-lg overflow-hidden ${className}`}
      style={{ width: size.width, height: size.height }}
    >
      {children}
      
      {/* Resize Handle */}
      <div
        className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize bg-gray-600 hover:bg-gray-500 transition-colors"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute bottom-1 right-1 w-1 h-1 bg-gray-400"></div>
        <div className="absolute bottom-1 right-0.5 w-1 h-1 bg-gray-400"></div>
        <div className="absolute bottom-0.5 right-1 w-1 h-1 bg-gray-400"></div>
      </div>
    </div>
  )
}

export default Resizable
