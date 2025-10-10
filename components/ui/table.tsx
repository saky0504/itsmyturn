import React from 'react'

interface TableProps {
  children: React.ReactNode
  className?: string
}

interface TableHeaderProps {
  children: React.ReactNode
  className?: string
}

interface TableBodyProps {
  children: React.ReactNode
  className?: string
}

interface TableFooterProps {
  children: React.ReactNode
  className?: string
}

interface TableRowProps {
  children: React.ReactNode
  className?: string
}

interface TableHeadProps {
  children: React.ReactNode
  className?: string
}

interface TableCellProps {
  children: React.ReactNode
  className?: string
}

interface TableCaptionProps {
  children: React.ReactNode
  className?: string
}

const Table: React.FC<TableProps> = ({ children, className = '' }) => (
  <div className={`relative overflow-auto ${className}`}>
    <table className="w-full caption-bottom text-sm">
      {children}
    </table>
  </div>
)

const TableHeader: React.FC<TableHeaderProps> = ({ children, className = '' }) => (
  <thead className={`[&_tr]:border-b ${className}`}>
    {children}
  </thead>
)

const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => (
  <tbody className={`[&_tr:last-child]:border-0 ${className}`}>
    {children}
  </tbody>
)

const TableFooter: React.FC<TableFooterProps> = ({ children, className = '' }) => (
  <tfoot className={`border-t bg-gray-800/50 font-medium [&>tr]:last:border-b-0 ${className}`}>
    {children}
  </tfoot>
)

const TableRow: React.FC<TableRowProps> = ({ children, className = '' }) => (
  <tr className={`border-b border-gray-700 transition-colors hover:bg-gray-800/50 data-[state=selected]:bg-gray-800 ${className}`}>
    {children}
  </tr>
)

const TableHead: React.FC<TableHeadProps> = ({ children, className = '' }) => (
  <th className={`h-12 px-4 text-left align-middle font-medium text-gray-400 [&:has([role=checkbox])]:pr-0 ${className}`}>
    {children}
  </th>
)

const TableCell: React.FC<TableCellProps> = ({ children, className = '' }) => (
  <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`}>
    {children}
  </td>
)

const TableCaption: React.FC<TableCaptionProps> = ({ children, className = '' }) => (
  <caption className={`mt-4 text-sm text-gray-400 ${className}`}>
    {children}
  </caption>
)

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption
}
