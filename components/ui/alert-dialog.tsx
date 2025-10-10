import React, { useState } from 'react'

interface AlertDialogProps {
  title: string
  description?: string
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

interface AlertDialogTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

interface AlertDialogContentProps {
  children: React.ReactNode
  className?: string
}

interface AlertDialogHeaderProps {
  children: React.ReactNode
}

interface AlertDialogFooterProps {
  children: React.ReactNode
}

const AlertDialogContext = React.createContext<{
  open: boolean
  setOpen: (open: boolean) => void
}>({
  open: false,
  setOpen: () => {}
})

const AlertDialog: React.FC<AlertDialogProps> = ({
  children,
  open: controlledOpen,
  onOpenChange
}) => {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen

  return (
    <AlertDialogContext.Provider value={{ open, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  )
}

const AlertDialogTrigger: React.FC<AlertDialogTriggerProps> = ({ children, asChild }) => {
  const { setOpen } = React.useContext(AlertDialogContext)
  
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

const AlertDialogContent: React.FC<AlertDialogContentProps> = ({ children, className = '' }) => {
  const { open, setOpen } = React.useContext(AlertDialogContext)
  
  if (!open) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={() => setOpen(false)}
      />
      
      {/* Dialog */}
      <div className={`relative bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 ${className}`}>
        {children}
      </div>
    </div>
  )
}

const AlertDialogHeader: React.FC<AlertDialogHeaderProps> = ({ children }) => (
  <div className="px-6 py-4 border-b border-gray-700">
    {children}
  </div>
)

const AlertDialogFooter: React.FC<AlertDialogFooterProps> = ({ children }) => (
  <div className="px-6 py-4 border-t border-gray-700 flex justify-end space-x-2">
    {children}
  </div>
)

const AlertDialogTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-lg font-semibold text-white">{children}</h2>
)

const AlertDialogDescription: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-gray-300 mt-2">{children}</p>
)

const AlertDialogAction: React.FC<{
  children: React.ReactNode
  onClick?: () => void
  className?: string
}> = ({ children, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors ${className}`}
  >
    {children}
  </button>
)

const AlertDialogCancel: React.FC<{
  children: React.ReactNode
  onClick?: () => void
  className?: string
}> = ({ children, onClick, className = '' }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors ${className}`}
  >
    {children}
  </button>
)

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
}
