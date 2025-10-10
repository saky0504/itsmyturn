import React, { useState } from 'react'

interface AccordionItem {
  value: string
  trigger: React.ReactNode
  content: React.ReactNode
}

interface AccordionProps {
  items: AccordionItem[]
  type?: 'single' | 'multiple'
  defaultValue?: string | string[]
  className?: string
}

const Accordion: React.FC<AccordionProps> = ({
  items,
  type = 'single',
  defaultValue,
  className = ''
}) => {
  const [openItems, setOpenItems] = useState<string[]>(
    Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : []
  )

  const handleToggle = (value: string) => {
    setOpenItems(prev => {
      if (type === 'single') {
        return prev.includes(value) ? [] : [value]
      } else {
        return prev.includes(value)
          ? prev.filter(item => item !== value)
          : [...prev, value]
      }
    })
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((item) => (
        <div key={item.value} className="border border-gray-700 rounded-lg">
          <button
            onClick={() => handleToggle(item.value)}
            className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-800 transition-colors duration-200"
          >
            <span className="text-white font-medium">{item.trigger}</span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                openItems.includes(item.value) ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {openItems.includes(item.value) && (
            <div className="px-4 pb-3 text-gray-300">
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default Accordion
