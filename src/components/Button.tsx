import React from 'react';
import clsx from 'clsx';

import { useTheme } from './ThemeProvider';
import { Size, Brand } from './type';

type Props = {
  variant?: 'contained' | 'outlined' | 'text' | 'icon';
  color?: Brand;
  size?: Size;
  disabled?: boolean;
  onClick?(e: React.MouseEvent<HTMLButtonElement>): void;
  className?: string;
};

const Button: React.FC<Props> = ({
  variant = 'contained',
  color = 'primary',
  size = 'md',
  onClick,
  disabled = false,
  className,
  children,
  ...other
}) => {
  const { theme } = useTheme();
  const classes: string[] = [];

  // border
  classes.push('border border-transparent');
  if (variant === 'outlined') {
    if (color) classes.push(`border-${theme.color[color]}`);
  }

  // background-color
  if (variant === 'contained' || variant === 'icon') {
    if (color) classes.push(`bg-${theme.color[color]}`);
  }

  // font-size
  const textSize = {
    xs: 'text-xs',
    sm: 'text-sm leading-4',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-base',
    none: '',
  };
  classes.push(textSize[size]);

  // text-color
  if (variant === 'contained' || variant === 'icon') {
    classes.push(`text-${theme.textColor[color]}`);
  } else {
    classes.push(`text-${theme.color[color]}`);
  }

  // font-weight
  classes.push('font-medium');

  // shadow
  if (variant === 'contained' || variant === 'icon') {
    if (color !== 'none') classes.push('shadow-md');
  }

  // hover
  if (disabled) {
    classes.push('bg-opacity-50');
    classes.push('cursor-not-allowed');
  } else {
    if (variant === 'contained' || variant === 'icon') {
      if (color !== 'none') {
        classes.push('hover:bg-opacity-75');
      } else {
        // classes.push('hover:bg-gray-100');
      }
    } else if (variant === 'outlined') {
      classes.push('hover:bg-gray-100');
    } else {
      classes.push('hover:bg-opacity-20');
      classes.push(`hover:bg-${theme.color[color]}`);
    }
  }

  // focus-ring
  if (variant === 'text') {
    classes.push('focus:outline-none');
  } else {
    classes.push('focus:outline-none focus:ring-2');
    if (size === 'xs' || size === 'sm') {
      classes.push('focus:ring-offset-1');
    } else {
      classes.push('focus:ring-offset-2');
    }
    if (color === 'none') {
      // classes.push('focus:ring-gray-300');
    } else {
      classes.push(`focus:ring-${theme.color[color]}`);
    }
  }

  // padding
  if (variant === 'icon') {
    const p = {
      xs: 'p-0.5',
      sm: 'p-2',
      md: 'p-2',
      lg: 'p-2',
      xl: 'p-3',
      none: '',
    };
    classes.push(p[size]);
  } else {
    const px = {
      xs: 'px-2.5',
      sm: 'px-3',
      md: 'px-4',
      lg: 'px-4',
      xl: 'px-6',
      none: '',
    };
    const py = {
      xs: 'py-1.5',
      sm: 'py-2',
      md: 'py-2',
      lg: 'py-2',
      xl: 'py-3',
      none: '',
    };
    classes.push(px[size]);
    classes.push(py[size]);
  }

  // rounded
  if (variant === 'icon') {
    classes.push('rounded-full');
  } else {
    classes.push('rounded');
  }

  // width/height
  if (variant === 'icon') {
    const w = {
      xs: 'w-6',
      sm: 'w-9',
      md: 'w-10',
      lg: 'w-11',
      xl: 'w-12',
      none: '',
    };
    const h = {
      xs: 'h-6',
      sm: 'h-9',
      md: 'h-10',
      lg: 'h-11',
      xl: 'h-12',
      none: '',
    };
    classes.push(w[size], h[size]);
  }

  return (
    <button
      className={clsx(classes.join(' '), className)}
      onClick={onClick}
      disabled={disabled}
      {...other}
    >
      {children}
    </button>
  );
};

export default Button;
