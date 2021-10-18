import React from 'react';
import { ReactSVG } from 'react-svg';

type Props = {
  name: string;
  variant?: 'outline' | 'solid';
  className?: string;
};

const Icon: React.FC<Props> = ({ name, variant = 'outline', className }) => {
  const path = `/icons/${variant}/${name}.svg`;
  return <ReactSVG src={path} className={className} />;
};

export default Icon;
