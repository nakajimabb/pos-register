import React from 'react';
import clsx from 'clsx';
import { makeResponsiveClasses } from './tools';

type GridProps = {
  cols?: string | number;
  rows?: string | number;
  gap?: string;
  flow?: 'row' | 'col' | 'row-dense' | 'col-dense';
  auto_cols?: 'auto' | 'min' | 'max' | 'fr';
  auto_rows?: 'auto' | 'min' | 'max' | 'fr';
  template_cols?: string;
  template_rows?: string;
  className?: string;
};

const Grid: React.FC<GridProps> = ({
  cols,
  rows,
  gap,
  flow,
  auto_cols,
  auto_rows,
  template_cols,
  template_rows,
  className,
  children,
}) => {
  return (
    <div
      className={clsx(
        'grid',
        cols && makeResponsiveClasses(String(cols), 'grid-cols'),
        rows && makeResponsiveClasses(String(rows), 'grid-rows'),
        gap && makeResponsiveClasses(gap, 'gap'),
        flow && `grid-flow-${flow}`,
        auto_cols && `auto-cols-${auto_cols}`,
        auto_rows && `auto-rows-${auto_rows}`,
        className
      )}
      style={{
        gridTemplateColumns: template_cols,
        gridTemplateRows: template_rows,
      }}
    >
      {children}
    </div>
  );
};

export default Grid;
