import React from 'react';
import clsx from 'clsx';

type NavbarProps = {
  fixed?: boolean;
  className?: string;
};

const Navbar: React.FC<NavbarProps> = ({
  fixed = false,
  className,
  children,
}) => {
  return (
    <nav className={clsx('shadow z-20', fixed && 'fixed inset-0', className)}>
      {children}
    </nav>
  );
};

export default Navbar;
