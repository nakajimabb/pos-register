import React from 'react';
import clsx from 'clsx';

type FlexProps = {
  direction?: 'row' | 'row-reverse' | 'col' | 'col-reverse';
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  justify_content?:
    | 'start'
    | 'end'
    | 'center'
    | 'between'
    | 'around'
    | 'evenly';
  align_items?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
  align_content?: 'center' | 'start' | 'end' | 'between' | 'around' | 'evenly';
  className?: string;
};

const Flex: React.FC<FlexProps> = ({
  direction,
  wrap,
  justify_content,
  align_items,
  align_content,
  className,
  children,
  ...other
}) => {
  return (
    <div
      className={clsx(
        'flex',
        direction && `flex-${direction}`,
        wrap && `flex-${wrap}`,
        justify_content && `justify-${justify_content}`,
        align_items && `items-${align_items}`,
        align_content && `content-${align_content}`,
        className
      )}
    >
      {children}
    </div>
  );
};

export default Flex;
