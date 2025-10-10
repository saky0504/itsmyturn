import React, { useState } from 'react'

interface CodeBlockProps {
  title?: string
  code: string
  language?: string
  maxHeight?: string
  className?: string
}

const CodeBlock: React.FC<CodeBlockProps> = ({
  title,
  code,
  language = 'typescript',
  maxHeight = '400px',
  className = ''
}) => {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  const lines = code.split('\n')

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex space-x-1.5">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            {title && (
              <h3 className="text-white text-sm font-medium">{title}</h3>
            )}
            <span className="text-gray-400 text-xs bg-gray-700 px-2 py-1 rounded">
              {language}
            </span>
          </div>
          
          <button
            onClick={handleCopy}
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            {isCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Code Content */}
      <div 
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <div className="p-4">
          <pre className="text-gray-100 text-sm font-mono leading-relaxed">
            <div className="flex">
              {/* Line Numbers */}
              <div className="text-gray-600 pr-4 select-none flex-shrink-0">
                {lines.map((_, index) => (
                  <div key={index} className="leading-relaxed">
                    {(index + 1).toString().padStart(3, ' ')}
                  </div>
                ))}
              </div>
              
              {/* Code Lines */}
              <div className="flex-1 min-w-0">
                {lines.map((line, index) => (
                  <div key={index} className="leading-relaxed">
                    {line || '\u00A0'}
                  </div>
                ))}
              </div>
            </div>
          </pre>
        </div>
      </div>
    </div>
  )
}

export default CodeBlock
