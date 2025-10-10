import React from 'react'

interface CodeComponentProps {
  code: string
  language?: string
  showLineNumbers?: boolean
  className?: string
}

const CodeComponent: React.FC<CodeComponentProps> = ({
  code,
  language = 'javascript',
  showLineNumbers = true,
  className = ''
}) => {
  const lines = code.split('\n')

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="ml-4 text-gray-400 text-sm">{language}</span>
        </div>
      </div>

      {/* Code Content */}
      <div className="p-4">
        <pre className="text-gray-100 text-sm font-mono leading-relaxed">
          {showLineNumbers ? (
            <div className="flex">
              <div className="text-gray-600 pr-4 select-none">
                {lines.map((_, index) => (
                  <div key={index} className="leading-relaxed">
                    {(index + 1).toString().padStart(3, ' ')}
                  </div>
                ))}
              </div>
              <div className="flex-1">
                {lines.map((line, index) => (
                  <div key={index} className="leading-relaxed">
                    {line || '\u00A0'}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            code
          )}
        </pre>
      </div>
    </div>
  )
}

export default CodeComponent
