import React, { useRef, useEffect, useState } from 'react'

interface ScrollAreaProps {
  children: React.ReactNode
  className?: string
  maxHeight?: string
}

const ScrollArea: React.FC<ScrollAreaProps> = ({
  children,
  className = '',
  maxHeight = '300px'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showScrollbar, setShowScrollbar] = useState(false)

  useEffect(() => {
    const checkScrollbar = () => {
      if (scrollRef.current) {
        const { scrollHeight, clientHeight } = scrollRef.current
        setShowScrollbar(scrollHeight > clientHeight)
      }
    }

    checkScrollbar()
    window.addEventListener('resize', checkScrollbar)
    
    return () => window.removeEventListener('resize', checkScrollbar)
  }, [children])

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollRef}
        className="overflow-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"
        style={{ maxHeight }}
      >
        {children}
      </div>
      
      {showScrollbar && (
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-gray-700 opacity-50 pointer-events-none" />
      )}
    </div>
  )
}

export default ScrollArea
