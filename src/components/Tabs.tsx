import React from 'react';
import clsx from 'clsx';

import { Form } from './';

type TabProps = {
  value: string;
  label: string;
  icon?: React.ReactElement;
  variant?: 'line' | 'bar';
  size?: 'sm' | 'md';
  disabled?: boolean;
  selected?: boolean;
  className?: string;
  onChange?: (value: string) => void;
};

const Tab: React.FC<TabProps> = ({
  value,
  label,
  icon,
  variant = 'line',
  size = 'md',
  disabled = false,
  selected,
  className,
  onChange,
}) => {
  const py = size === 'sm' ? 2 : 4;

  const handleClick = () => {
    if (!selected && !disabled && onChange) {
      onChange(value);
    }
  };

  return (
    <div
      className={clsx(
        'flex justify-center font-medium text-sm border-transparent border-b-2',
        `p-${py}`,
        disabled && 'text-gray-300',
        !disabled && 'cursor-pointer',
        selected && 'border-indigo-500 text-indigo-600',
        selected && 'text-indigo-600',
        !disabled && !selected && 'text-gray-500 hover:text-gray-800',
        variant === 'line' && !disabled && !selected && 'hover:border-gray-400',
        variant === 'bar' && 'w-full',
        variant === 'bar' && !disabled && 'hover:bg-gray-50',
        className
      )}
      onClick={handleClick}
      style={{
        borderLeftColor: 'rgba(209, 213, 219)',
      }}
    >
      {icon && <div className="mr-2 h-5 w-5">{icon}</div>}
      {label}
    </div>
  );
};

type TabsProps = {
  value: string;
  variant?: 'line' | 'bar';
  size?: 'sm' | 'md';
  baseLine?: boolean;
  responsible?: boolean;
  className?: string;
  onChange: (value: string) => void;
};

type TabsType = React.FC<TabsProps> & {
  Tab: typeof Tab;
};

const Tabs: TabsType = ({
  value,
  variant = 'line',
  size = 'md',
  baseLine = true,
  responsible = false,
  children: childrenProp,
  className,
  onChange,
}) => {
  const children = React.Children.map(childrenProp, (child) => {
    if (!React.isValidElement(child)) return null;

    const selected = child.props.value === value;
    return React.cloneElement(child, {
      size,
      variant,
      selected,
      onChange,
    });
  });

  const options =
    React.Children.map(childrenProp, (child) => {
      if (!React.isValidElement(child)) return null;
      return {
        label: String(child.props.label),
        value: String(child.props.value),
      };
    })?.filter((item) => item) || [];

  return (
    <>
      <nav
        className={clsx(
          'flex overflow-hidden items-center max-w-full',
          variant === 'bar' && 'justify-around divide-x',
          baseLine && 'border-b',
          responsible && 'hidden sm:flex',
          className
        )}
        aria-label="Tabs"
      >
        {children}
      </nav>
      {responsible && (
        <Form.Select
          size="sm"
          options={options}
          className="sm:hidden h-8 m-2"
        />
      )}
    </>
  );
};
Tabs.Tab = Tab;

export default Tabs;
