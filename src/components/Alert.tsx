import React from 'react';
import clsx from 'clsx';

import { Button, Icon } from '.';

type Props = {
  severity: 'error' | 'info' | 'success' | 'warning';
  onClose?(): void;
  className?: string;
};

const Alert: React.FC<Props> = ({ severity, onClose, className, children }) => {
  const color = {
    bg: {
      warning: 'bg-yellow-50',
      error: 'bg-red-50',
      success: 'bg-green-50',
      info: 'bg-blue-50',
    },
    icon: {
      warning: 'text-yellow-400',
      error: 'text-red-400',
      success: 'text-green-400',
      info: 'text-blue-400',
    },
    text: {
      warning: 'text-yellow-800',
      error: 'text-red-800',
      success: 'text-green-800',
      info: 'text-blue-700',
    },
    hover: {
      warning: 'hover:bg-yellow-100',
      error: 'hover:bg-red-100',
      success: 'hover:bg-green-100',
      info: 'hover:bg-blue-100',
    },
    ring: {
      warning: 'focus:ring-yellow-400',
      error: 'focus:ring-red-400',
      success: 'focus:ring-green-400',
      info: 'focus:ring-blue-400',
    },
  };

  const icons = {
    error: 'x-circle',
    info: 'information-circle',
    success: 'check-circle',
    warning: 'exclamation',
  };

  return (
    <div className={clsx('rounded-md p-4', color.bg[severity], className)}>
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon
            name={icons[severity]}
            variant="solid"
            className={clsx('h-5 w-5', color.icon[severity])}
          />
        </div>
        <div className="ml-3">
          <p className={clsx('text-sm font-medium', color.text[severity])}>
            {children}
          </p>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <Button
                variant="icon"
                color="none"
                size="xs"
                onClick={onClose}
                className={clsx(
                  color.text[severity],
                  color.hover[severity],
                  color.ring[severity],
                  'focus:outline-none focus:ring-1 focus:ring-offset-0'
                )}
              >
                <Icon name="x" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Alert;
