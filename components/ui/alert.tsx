import React from 'react'

interface AlertProps {
  variant?: 'default' | 'destructive' | 'success' | 'warning'
  children: React.ReactNode
  className?: string
}

const Alert: React.FC<AlertProps> = ({
  variant = 'default',
  children,
  className = ''
}) => {
  const baseClasses = 'p-4 rounded-lg border flex items-start space-x-3'
  
  const variantClasses = {
    default: 'bg-gray-800 border-gray-700 text-white',
    destructive: 'bg-red-900/20 border-red-700 text-red-300',
    success: 'bg-green-900/20 border-green-700 text-green-300',
    warning: 'bg-yellow-900/20 border-yellow-700 text-yellow-300'
  }

  const iconClasses = {
    default: 'text-gray-400',
    destructive: 'text-red-400',
    success: 'text-green-400',
    warning: 'text-yellow-400'
  }

  const icons = {
    default: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
      </svg>
    ),
    destructive: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 0 8 8 0 0116 0zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
      </svg>
    ),
    success: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 0 8 8 0 0116 0zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
      </svg>
    )
  }

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      <div className={iconClasses[variant]}>
        {icons[variant]}
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}

const AlertTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="font-semibold mb-1">{children}</h4>
)

const AlertDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-sm opacity-90">{children}</div>
)

export { Alert, AlertTitle, AlertDescription }
