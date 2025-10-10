import React, { useState, useRef, useEffect } from 'react'

interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  separator?: boolean
}

interface ContextMenuProps {
  children: React.ReactNode
  items: ContextMenuItem[]
  className?: string
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  children,
  items,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setPosition({ x: e.clientX, y: e.clientY })
    setIsOpen(true)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleScroll = () => {
      setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('scroll', handleScroll, true)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className={className}>
      <div onContextMenu={handleContextMenu}>
        {children}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 min-w-48"
          style={{
            left: position.x,
            top: position.y,
          }}
        >
          {items.map((item, index) => {
            if (item.separator) {
              return <div key={index} className="h-px bg-gray-600 my-1" />
            }

            return (
              <button
                key={index}
                onClick={() => {
                  item.onClick?.()
                  setIsOpen(false)
                }}
                disabled={item.disabled}
                className={`w-full flex items-center space-x-2 px-3 py-2 text-sm text-left hover:bg-gray-700 transition-colors ${
                  item.disabled ? 'text-gray-500 cursor-not-allowed' : 'text-white'
                }`}
              >
                {item.icon && <span className="text-gray-400">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ContextMenu
