import React, { useState, useRef, useEffect } from 'react'

interface HoverCardProps {
  trigger: React.ReactNode
  content: React.ReactNode
  delay?: number
  className?: string
}

const HoverCard: React.FC<HoverCardProps> = ({
  trigger,
  content,
  delay = 200,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const timeoutRef = useRef<NodeJS.Timeout>()
  const triggerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const showCard = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        setPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 8
        })
      }
      setIsVisible(true)
    }, delay)
  }

  const hideCard = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        ref={triggerRef}
        onMouseEnter={showCard}
        onMouseLeave={hideCard}
        className="inline-block"
      >
        {trigger}
      </div>

      {isVisible && (
        <div
          ref={cardRef}
          className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-3 max-w-xs"
          style={{
            left: position.x,
            top: position.y,
            transform: 'translate(-50%, -100%)'
          }}
          onMouseEnter={showCard}
          onMouseLeave={hideCard}
        >
          {content}
          
          {/* Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2">
            <div className="w-2 h-2 bg-gray-800 border-r border-b border-gray-700 rotate-45 transform translate-y-1"></div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HoverCard
