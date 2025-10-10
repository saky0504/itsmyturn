import React, { useState, useEffect } from 'react'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  onSelect?: () => void
}

interface CommandProps {
  items: CommandItem[]
  placeholder?: string
  className?: string
}

const Command: React.FC<CommandProps> = ({
  items,
  placeholder = 'Type a command or search...',
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filteredItems = items.filter(item =>
    item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [searchTerm])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % filteredItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selectedItem = filteredItems[selectedIndex]
      selectedItem?.onSelect?.()
    }
  }

  return (
    <div className={`bg-gray-800 rounded-lg shadow-lg ${className}`}>
      {/* Search Input */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none"
          />
        </div>
      </div>

      {/* Command List */}
      <div className="max-h-64 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            No commands found.
          </div>
        ) : (
          filteredItems.map((item, index) => (
            <button
              key={item.id}
              onClick={item.onSelect}
              className={`w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-700 transition-colors ${
                index === selectedIndex ? 'bg-gray-700' : ''
              }`}
            >
              {item.icon && (
                <div className="flex-shrink-0 text-gray-400">
                  {item.icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium">{item.label}</div>
                {item.description && (
                  <div className="text-sm text-gray-400 truncate">
                    {item.description}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default Command
