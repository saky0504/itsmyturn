import React from 'react'

interface BreadcrumbItem {
  label: string
  href?: string
  isCurrentPage?: boolean
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  separator?: React.ReactNode
  className?: string
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  separator = '/',
  className = ''
}) => {
  return (
    <nav className={`flex items-center space-x-1 text-sm ${className}`}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <span className="text-gray-500 mx-2">
              {separator}
            </span>
          )}
          {item.isCurrentPage ? (
            <span className="text-gray-400 font-medium">
              {item.label}
            </span>
          ) : item.href ? (
            <a
              href={item.href}
              className="text-gray-300 hover:text-white transition-colors"
            >
              {item.label}
            </a>
          ) : (
            <span className="text-gray-300">
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

export default Breadcrumb
