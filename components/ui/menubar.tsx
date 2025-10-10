import React, { useState } from 'react'

interface MenuItem {
  label: string
  shortcut?: string
  icon?: React.ReactNode
  children?: MenuItem[]
  onClick?: () => void
  disabled?: boolean
  separator?: boolean
}

interface MenubarProps {
  items: MenuItem[]
  className?: string
}

const Menubar: React.FC<MenubarProps> = ({ items, className = '' }) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const renderMenuItem = (item: MenuItem, index: number) => {
    if (item.separator) {
      return <div key={index} className="h-px bg-gray-600 my-1" />
    }

    const hasChildren = item.children && item.children.length > 0
    const isActive = activeMenu === item.label

    return (
      <div key={index} className="relative group">
        <button
          onClick={() => {
            if (hasChildren) {
              setActiveMenu(isActive ? null : item.label)
            } else {
              item.onClick?.()
              setActiveMenu(null)
            }
          }}
          disabled={item.disabled}
          className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            item.disabled
              ? 'text-gray-500 cursor-not-allowed'
              : isActive
              ? 'bg-green-500 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-700'
          }`}
        >
          {item.icon && <span>{item.icon}</span>}
          <span>{item.label}</span>
          {item.shortcut && (
            <span className="text-xs text-gray-500 ml-auto">
              {item.shortcut}
            </span>
          )}
          {hasChildren && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </button>

        {hasChildren && isActive && (
          <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50 min-w-48">
            <div className="py-1">
              {item.children!.map((child, childIndex) => renderMenuItem(child, childIndex))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-1 bg-gray-900 border-b border-gray-700 px-4 py-2 ${className}`}>
      {items.map((item, index) => renderMenuItem(item, index))}
    </div>
  )
}

export default Menubar
