import React from 'react';
import clsx from 'clsx';

type Props = {
  className?: string;
};

const CardHeader: React.FC<Props> = ({ className, children }) => {
  return <h1 className={clsx('px-4 py-2', className)}>{children}</h1>;
};

const CardBody: React.FC<Props> = ({ className, children }) => {
  return <div className={clsx('p-2', className)}>{children}</div>;
};

const CardFooter: React.FC<Props> = ({ className, children }) => {
  return <div className={clsx('p-2', className)}>{children}</div>;
};

type CardProps = {
  className?: string;
};

type CardType = React.FC<CardProps> & {
  Header: typeof CardHeader;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
};

const Card: CardType = ({ className, children }) => {
  return (
    <div
      className={clsx(
        'overflow-hidden rounded bg-white border shadow focus:shadow-outline',
        className
      )}
    >
      {children}
    </div>
  );
};

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
