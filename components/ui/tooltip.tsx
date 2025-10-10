import React, { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  delay?: number
  className?: string
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  side = 'top',
  align = 'center',
  delay = 200,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const timeoutRef = useRef<NodeJS.Timeout>()
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current && tooltipRef.current) {
        const triggerRect = triggerRef.current.getBoundingClientRect()
        const tooltipRect = tooltipRef.current.getBoundingClientRect()
        
        let x = 0
        let y = 0

        switch (side) {
          case 'top':
            x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
            y = triggerRect.top - tooltipRect.height - 8
            break
          case 'bottom':
            x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
            y = triggerRect.bottom + 8
            break
          case 'left':
            x = triggerRect.left - tooltipRect.width - 8
            y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
            break
          case 'right':
            x = triggerRect.right + 8
            y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
            break
        }

        // Adjust alignment
        if (side === 'top' || side === 'bottom') {
          switch (align) {
            case 'start':
              x = triggerRect.left
              break
            case 'end':
              x = triggerRect.right - tooltipRect.width
              break
          }
        } else {
          switch (align) {
            case 'start':
              y = triggerRect.top
              break
            case 'end':
              y = triggerRect.bottom - tooltipRect.height
              break
          }
        }

        setPosition({ x, y })
        setIsVisible(true)
      }
    }, delay)
  }

  const hideTooltip = () => {
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
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 px-2 py-1 text-sm text-white bg-gray-900 border border-gray-700 rounded-md shadow-lg"
          style={{
            left: position.x,
            top: position.y
          }}
        >
          {content}
          
          {/* Arrow */}
          <div className={`absolute w-2 h-2 bg-gray-900 border border-gray-700 rotate-45 ${
            side === 'top' ? 'top-full left-1/2 -translate-x-1/2 -translate-y-1' :
            side === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 translate-y-1' :
            side === 'left' ? 'left-full top-1/2 -translate-y-1/2 -translate-x-1' :
            'right-full top-1/2 -translate-y-1/2 translate-x-1'
          }`} />
        </div>
      )}
    </div>
  )
}

export default Tooltip
