import React, { useState } from 'react'

interface SidebarItem {
  label: string
  href?: string
  icon?: React.ReactNode
  badge?: string | number
  children?: SidebarItem[]
  onClick?: () => void
}

interface SidebarProps {
  items: SidebarItem[]
  isOpen?: boolean
  onToggle?: () => void
  className?: string
  header?: React.ReactNode
  footer?: React.ReactNode
}

const Sidebar: React.FC<SidebarProps> = ({
  items,
  isOpen = true,
  onToggle,
  className = '',
  header,
  footer
}) => {
  const [activeItem, setActiveItem] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleExpanded = (label: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(label)) {
      newExpanded.delete(label)
    } else {
      newExpanded.add(label)
    }
    setExpandedItems(newExpanded)
  }

  const renderItem = (item: SidebarItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.has(item.label)
    const isActive = activeItem === item.label

    return (
      <div key={item.label}>
        <div
          className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            isActive
              ? 'bg-green-500 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-700'
          }`}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleExpanded(item.label)
            } else {
              setActiveItem(item.label)
              item.onClick?.()
            }
          }}
        >
          {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && (
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              {item.badge}
            </span>
          )}
          {hasChildren && (
            <svg
              className={`w-4 h-4 flex-shrink-0 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-1">
            {item.children!.map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col bg-gray-900 border-r border-gray-700 transition-all duration-300 ${
      isOpen ? 'w-64' : 'w-16'
    } ${className}`}>
      {/* Header */}
      {header && (
        <div className="p-4 border-b border-gray-700">
          {header}
        </div>
      )}

      {/* Toggle Button */}
      {onToggle && (
        <button
          onClick={onToggle}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-1">
        {items.map(item => renderItem(item))}
      </nav>

      {/* Footer */}
      {footer && (
        <div className="p-4 border-t border-gray-700">
          {footer}
        </div>
      )}
    </div>
  )
}

export default Sidebar
