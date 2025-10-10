import React, { useState, useRef, useEffect } from 'react'

interface PopoverProps {
  trigger: React.ReactNode
  content: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  className?: string
}

const Popover: React.FC<PopoverProps> = ({
  trigger,
  content,
  open: controlledOpen,
  onOpenChange,
  side = 'bottom',
  align = 'center',
  className = ''
}) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setIsOpen = onOpenChange || setInternalOpen

  const updatePosition = () => {
    if (triggerRef.current && popoverRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const popoverRect = popoverRef.current.getBoundingClientRect()
      
      let x = 0
      let y = 0

      switch (side) {
        case 'top':
          x = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2
          y = triggerRect.top - popoverRect.height - 8
          break
        case 'bottom':
          x = triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2
          y = triggerRect.bottom + 8
          break
        case 'left':
          x = triggerRect.left - popoverRect.width - 8
          y = triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2
          break
        case 'right':
          x = triggerRect.right + 8
          y = triggerRect.top + triggerRect.height / 2 - popoverRect.height / 2
          break
      }

      // Adjust alignment
      if (side === 'top' || side === 'bottom') {
        switch (align) {
          case 'start':
            x = triggerRect.left
            break
          case 'end':
            x = triggerRect.right - popoverRect.width
            break
        }
      } else {
        switch (align) {
          case 'start':
            y = triggerRect.top
            break
          case 'end':
            y = triggerRect.bottom - popoverRect.height
            break
        }
      }

      setPosition({ x, y })
    }
  }

  useEffect(() => {
    if (isOpen) {
      updatePosition()
      const handleResize = () => updatePosition()
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [isOpen, side, align])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, setIsOpen])

  const handleTriggerClick = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={triggerRef} onClick={handleTriggerClick}>
        {trigger}
      </div>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" />
          
          {/* Popover */}
          <div
            ref={popoverRef}
            className="fixed z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg p-3"
            style={{
              left: position.x,
              top: position.y
            }}
          >
            {content}
          </div>
        </>
      )}
    </div>
  )
}

export default Popover
