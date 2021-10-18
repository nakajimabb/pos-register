import React, { useState } from 'react';
import clsx from 'clsx';

type TooltipProps = {
  title: string;
  disabled?: boolean;
  className?: string;
};

const Tooltip: React.FC<TooltipProps> = ({
  title,
  disabled,
  className,
  children,
}) => {
  const [show, setShow] = useState(false);

  const onMouseOver = (e: React.MouseEvent<HTMLButtonElement>) => {
    setShow(true);
  };

  const onMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    setShow(false);
  };

  return (
    <span
      onMouseOver={disabled ? undefined : onMouseOver}
      onMouseLeave={disabled ? undefined : onMouseLeave}
      className="relative inline-block"
    >
      {children}
      {!disabled && (
        <div
          className={clsx(
            !show && 'hidden',
            'opacity-90 bg-gray-600 text-white text-xs rounded px-2 py-1 whitespace-pre z-10',
            'absolute left-1/2 top-full m-auto',
            'transform -translate-x-1/2 translate-y-2',
            className
          )}
        >
          {title}
        </div>
      )}
    </span>
  );
};

export default Tooltip;
