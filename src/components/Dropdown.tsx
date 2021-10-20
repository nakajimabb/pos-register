import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

import { Flex } from './';
import './Dropdown.css';

type ItemProps = {
  title: React.ReactElement | string;
  to?: string;
  onClick?(e: React.MouseEvent<HTMLDivElement>): void;
  setShow?: React.Dispatch<React.SetStateAction<boolean>>;
  trigger?: 'clicked' | 'downup';
  className?: string;
};

const DropdownItem: React.FC<ItemProps> = ({
  title,
  to,
  onClick,
  setShow,
  trigger = 'clicked',
  className,
  children,
}) => {
  return (
    <div
      onClick={(e) => {
        if (trigger === 'clicked') {
          if (onClick) {
            onClick(e);
            if (setShow) setShow(false);
          }
          e.stopPropagation();
        }
      }}
      onMouseUp={(e) => {
        if (trigger === 'downup') {
          if (onClick) {
            onClick(e);
            if (setShow) setShow(false);
          }
          e.stopPropagation();
        }
      }}
      className={clsx(
        'relative overflow-hidden hover-overflow-visible',
        'items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 text-left',
        className
      )}
    >
      {children && (
        <>
          <Flex justify_content="between">
            {title}
            <div className="triangle ml-4 my-1"></div>
          </Flex>
          <div className="absolute left-full top-0 bg-white py-1 rounded-md">
            {React.Children.map(children, (child) => {
              if (!React.isValidElement(child)) return null;

              return React.cloneElement(child, { setShow, trigger });
            })}
          </div>
        </>
      )}
      {!children &&
        (to ? (
          <Link to={to}>{title}</Link>
        ) : (
          <div className="w-max">{title}</div>
        ))}
    </div>
  );
};

const Divider: React.FC = () => {
  return (
    <div className="py-1 bg-white">
      <hr />
    </div>
  );
};

type DropdownProps = {
  icon?: React.ReactElement;
  align: 'right' | 'left';
  onEnter?: () => void;
  trigger?: 'clicked' | 'downup';
  className?: string;
};

type DropdownType = React.FC<DropdownProps> & {
  Item: typeof DropdownItem;
  Divider: typeof Divider;
};

const Dropdown: DropdownType = ({
  icon,
  align = 'right',
  onEnter,
  trigger = 'clicked',
  children,
}) => {
  const [show, setShow] = useState(false);
  var clicking = false;

  return (
    <>
      {/* Background overlay */}
      {show && (
        <div
          className="fixed inset-0"
          aria-hidden="true"
          onClick={() => setShow(false)}
        ></div>
      )}
      <span
        onClick={async () => {
          if (trigger === 'clicked') {
            if (!show && onEnter) await onEnter();
            setShow((prev) => !prev);
          }
        }}
        onMouseDown={() => {
          clicking = true;
          if (trigger === 'downup' && !show) {
            setTimeout(() => {
              if (clicking) setShow((prev) => !prev);
            }, 250);
          }
        }}
        onMouseUp={() => {
          clicking = false;
          if (trigger === 'downup' && show) setShow(false);
        }}
        className="relative"
      >
        {icon}
        {show && (
          <div
            className={clsx(
              'dropdown',
              'origin-top-right absolute rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-20 py-1 w-max',
              `${align}-0`,
              !show && 'hidden'
            )}
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="options-menu"
          >
            {React.Children.map(children, (child) => {
              if (!React.isValidElement(child)) return null;

              return React.cloneElement(child, { setShow, trigger });
            })}
          </div>
        )}
      </span>
    </>
  );
};

Dropdown.Item = DropdownItem;
Dropdown.Divider = Divider;

export default Dropdown;
