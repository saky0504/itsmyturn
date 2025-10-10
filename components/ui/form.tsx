import React from 'react'

interface FormProps {
  children: React.ReactNode
  onSubmit?: (e: React.FormEvent) => void
  className?: string
}

interface FormFieldProps {
  children: React.ReactNode
  className?: string
}

interface FormLabelProps {
  children: React.ReactNode
  htmlFor?: string
  className?: string
}

interface FormMessageProps {
  children: React.ReactNode
  variant?: 'error' | 'success' | 'warning'
  className?: string
}

const Form: React.FC<FormProps> = ({ children, onSubmit, className = '' }) => (
  <form onSubmit={onSubmit} className={`space-y-4 ${className}`}>
    {children}
  </form>
)

const FormField: React.FC<FormFieldProps> = ({ children, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {children}
  </div>
)

const FormLabel: React.FC<FormLabelProps> = ({ children, htmlFor, className = '' }) => (
  <label
    htmlFor={htmlFor}
    className={`block text-sm font-medium text-white ${className}`}
  >
    {children}
  </label>
)

const FormMessage: React.FC<FormMessageProps> = ({ 
  children, 
  variant = 'error', 
  className = '' 
}) => {
  const variantClasses = {
    error: 'text-red-400',
    success: 'text-green-400',
    warning: 'text-yellow-400'
  }

  return (
    <p className={`text-sm ${variantClasses[variant]} ${className}`}>
      {children}
    </p>
  )
}

const FormDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className = '' 
}) => (
  <p className={`text-sm text-gray-400 ${className}`}>
    {children}
  </p>
)

export { Form, FormField, FormLabel, FormMessage, FormDescription }
