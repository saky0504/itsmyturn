import React, { useState } from 'react'

interface SheetProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
}

interface SheetTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

interface SheetContentProps {
  children: React.ReactNode
  className?: string
}

interface SheetHeaderProps {
  children: React.ReactNode
}

interface SheetTitleProps {
  children: React.ReactNode
}

interface SheetDescriptionProps {
  children: React.ReactNode
}

interface SheetFooterProps {
  children: React.ReactNode
}

const SheetContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
  side: 'top' | 'right' | 'bottom' | 'left'
}>({
  open: false,
  setOpen: () => {},
  side: 'right'
})

const Sheet: React.FC<SheetProps> = ({
  children,
  open: controlledOpen,
  onOpenChange,
  side = 'right'
}) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  return (
    <SheetContext.Provider value={{ open, setOpen, side }}>
      {children}
    </SheetContext.Provider>
  )
}

const SheetTrigger: React.FC<SheetTriggerProps> = ({ children, asChild }) => {
  const { setOpen } = React.useContext(SheetContext)
  
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: () => setOpen(true)
    })
  }
  
  return (
    <button onClick={() => setOpen(true)}>
      {children}
    </button>
  )
}

const SheetContent: React.FC<SheetContentProps> = ({ children, className = '' }) => {
  const { open, setOpen, side } = React.useContext(SheetContext)
  
  if (!open) return null
  
  const sideClasses = {
    top: 'top-0 left-0 right-0 max-h-screen',
    right: 'top-0 right-0 h-screen w-80',
    bottom: 'bottom-0 left-0 right-0 max-h-screen',
    left: 'top-0 left-0 h-screen w-80'
  }
  
  const slideClasses = {
    top: open ? 'translate-y-0' : '-translate-y-full',
    right: open ? 'translate-x-0' : 'translate-x-full',
    bottom: open ? 'translate-y-0' : 'translate-y-full',
    left: open ? '-translate-x-0' : '-translate-x-full'
  }
  
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={() => setOpen(false)}
      />
      
      {/* Sheet */}
      <div 
        className={`absolute bg-gray-800 border border-gray-700 shadow-lg transition-transform duration-300 ${sideClasses[side]} ${slideClasses[side]} ${className}`}
      >
        {children}
      </div>
    </div>
  )
}

const SheetHeader: React.FC<SheetHeaderProps> = ({ children }) => (
  <div className="p-6 border-b border-gray-700">
    {children}
  </div>
)

const SheetTitle: React.FC<SheetTitleProps> = ({ children }) => (
  <h2 className="text-lg font-semibold text-white">
    {children}
  </h2>
)

const SheetDescription: React.FC<SheetDescriptionProps> = ({ children }) => (
  <p className="text-sm text-gray-400 mt-2">
    {children}
  </p>
)

const SheetFooter: React.FC<SheetFooterProps> = ({ children }) => (
  <div className="p-6 border-t border-gray-700">
    {children}
  </div>
)

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter }
