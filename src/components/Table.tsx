import React from 'react';
import clsx from 'clsx';

const cloneChild = (children: React.ReactNode, props: object) =>
  React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) {
      return null;
    }
    return React.cloneElement(child, props);
  });

type Props = {
  size?: 'xs' | 'sm' | 'md';
  border?: 'none' | 'row' | 'cell';
  hover?: boolean;
  className?: string;
};

const TableHead: React.FC<Props> = ({ size = 'md', border = 'row', className, children }) => {
  return <thead className={className}>{cloneChild(children, { size, hover: false, border })}</thead>;
};

const TableBody: React.FC<Props> = ({ size = 'md', border = 'row', hover = true, className, children }) => {
  return <tbody className={className}>{cloneChild(children, { size, hover, border })}</tbody>;
};

const TableRow: React.FC<Props> = ({ size = 'md', border = 'row', hover = true, className, children }) => {
  return (
    <tr className={clsx('bg-white', hover && 'hover:bg-opacity-10', border === 'row' && 'border-b', className)}>
      {cloneChild(children, { size, hover, border: border === 'cell' })}
    </tr>
  );
};

type CellProps = {
  type?: 'td' | 'th';
  size?: 'xs' | 'sm' | 'md';
  border?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  rowSpan?: number;
  colSpan?: number;
  className?: string;
};

const TableCell: React.FC<CellProps> = ({
  type: Component = 'td',
  size = 'md',
  border = false,
  textAlign,
  rowSpan,
  colSpan,
  className,
  children,
}) => {
  const padding = { xs: 'p-1', sm: 'p-1', md: 'px-3 py-2', lg: 'px-6 py-4' };
  return (
    <Component
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={clsx(
        padding[size],
        border && 'border',
        // th && 'font-medium text-gray-900',
        // !th && 'text-gray-500',
        textAlign && `text-${textAlign}`,
        `text-${size}`,
        className
      )}
    >
      {children}
    </Component>
  );
};

type TableProps = {
  size?: 'xs' | 'sm' | 'md';
  border?: 'none' | 'row' | 'cell';
  hover?: boolean;
  className?: string;
};

type TableType = React.FC<TableProps> & {
  Head: typeof TableHead;
  Body: typeof TableBody;
  Row: typeof TableRow;
  Cell: typeof TableCell;
};

const Table: TableType = ({ size = 'md', border = 'row', hover = true, className, children }) => {
  return (
    <table
      className={clsx(
        border === 'cell' && 'border border-gray-200 shadow-md',
        border === 'none' && 'border-none',
        className
      )}
    >
      {cloneChild(children, { size, hover, border })}
    </table>
  );
};

Table.Head = TableHead;
Table.Body = TableBody;
Table.Row = TableRow;
Table.Cell = TableCell;

export default Table;
