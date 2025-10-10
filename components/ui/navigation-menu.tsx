import React, { useState } from 'react'

interface NavigationItem {
  label: string
  href?: string
  icon?: React.ReactNode
  children?: NavigationItem[]
}

interface NavigationMenuProps {
  items: NavigationItem[]
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({
  items,
  orientation = 'horizontal',
  className = ''
}) => {
  const [activeItem, setActiveItem] = useState<string | null>(null)

  const baseClasses = orientation === 'horizontal' 
    ? 'flex items-center space-x-1' 
    : 'flex flex-col space-y-1'

  const renderItem = (item: NavigationItem, index: number) => {
    const hasChildren = item.children && item.children.length > 0
    const isActive = activeItem === item.label

    return (
      <div key={index} className="relative group">
        <button
          onClick={() => setActiveItem(isActive ? null : item.label)}
          className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActive 
              ? 'bg-green-500 text-white' 
              : 'text-gray-300 hover:text-white hover:bg-gray-700'
          }`}
        >
          {item.icon && <span>{item.icon}</span>}
          <span>{item.label}</span>
          {hasChildren && (
            <svg
              className={`w-4 h-4 transition-transform ${isActive ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>

        {hasChildren && isActive && (
          <div className={`absolute top-full left-0 mt-1 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50 ${
            orientation === 'horizontal' ? 'w-48' : 'w-full'
          }`}>
            <div className="py-1">
              {item.children!.map((child, childIndex) => (
                <a
                  key={childIndex}
                  href={child.href}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700"
                >
                  {child.icon && <span>{child.icon}</span>}
                  <span>{child.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <nav className={`${baseClasses} ${className}`}>
      {items.map((item, index) => renderItem(item, index))}
    </nav>
  )
}

export default NavigationMenu
