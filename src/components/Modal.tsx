import React from 'react';
import clsx from 'clsx';

import { Size2 } from './type';
import { Button, Icon, Flex } from './';

type HeaderProps = {
  centered?: boolean;
  padding?: number;
  showCloseButton?: boolean;
  onClose?(): void;
  className?: string;
};

const ModalHeader: React.FC<HeaderProps> = ({
  centered = false,
  padding = 3,
  onClose,
  className,
  children,
}) => {
  return (
    <h1
      className={clsx(
        'bg-white border text-lg leading-6 font-medium text-gray-900',
        `p-${padding}`,
        centered && 'text-center',
        className
      )}
    >
      <Flex align_items="center">
        <div className="flex-1">{children}</div>
        {onClose && (
          <CloseButton
            onClose={onClose}
            className={clsx(padding === 0 && 'mx-2')}
          />
        )}
      </Flex>
    </h1>
  );
};

type Props = {
  padding?: number;
  className?: string;
};

const ModalBody: React.FC<Props> = ({ padding = 4, className, children }) => {
  return (
    <div className={clsx('bg-white', `p-${padding}`, className)}>
      {children}
    </div>
  );
};

const ModalFooter: React.FC<Props> = ({ className, children }) => {
  return <div className={clsx('px-4 py-3 border', className)}>{children}</div>;
};

type CloseButtonProps = {
  onClose?(): void;
  className?: string;
};

const CloseButton: React.FC<CloseButtonProps> = ({ onClose, className }) => {
  return (
    <Button
      variant="icon"
      color="none"
      size="xs"
      onClick={onClose}
      className={clsx(
        'text-gray-400 hover:text-gray-600 hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-offset-0 focus:ring-gray-400',
        className
      )}
    >
      <Icon name="x" />
    </Button>
  );
};

type ModalProps = {
  open: boolean;
  size?: Size2;
  onClose?(): void;
  className?: string;
};

type ModalType = React.FC<ModalProps> & {
  Header: typeof ModalHeader;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
};

const Modal: ModalType = ({
  open,
  size = 'lg',
  onClose,
  className,
  children,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed z-20 inset-0 overflow-y-auto"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-center justify-center min-h-screen p-3 text-center">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        ></div>
        <div
          className={clsx(
            'inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all',
            size !== 'none' && `max-w-${size}`,
            className
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

export default Modal;
