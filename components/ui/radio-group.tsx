import React, { createContext, useContext } from 'react'

interface RadioGroupContextType {
  value?: string
  onValueChange?: (value: string) => void
  name?: string
}

const RadioGroupContext = createContext<RadioGroupContextType>({})

interface RadioGroupProps {
  value?: string
  onValueChange?: (value: string) => void
  name?: string
  children: React.ReactNode
  className?: string
}

const RadioGroup: React.FC<RadioGroupProps> = ({
  value,
  onValueChange,
  name,
  children,
  className = ''
}) => {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange, name }}>
      <div className={`space-y-2 ${className}`}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

interface RadioGroupItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'name'> {
  value: string
  className?: string
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ value, className = '', ...props }, ref) => {
    const context = useContext(RadioGroupContext)
    
    return (
      <input
        type="radio"
        value={value}
        name={context.name}
        checked={context.value === value}
        onChange={(e) => context.onValueChange?.(e.target.value)}
        className={`h-4 w-4 border-gray-600 bg-gray-800 text-green-500 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        ref={ref}
        {...props}
      />
    )
  }
)

RadioGroupItem.displayName = 'RadioGroupItem'

export { RadioGroup, RadioGroupItem }
