import React from 'react';
import { useAppContext } from './AppContext';
import InternalOrderMain from './InternalOrderMain';

const InternalOrderNew: React.FC = () => {
  const { currentShop } = useAppContext();

  return currentShop ? <InternalOrderMain shopCode={currentShop.code} shopName={currentShop.name} /> : null;
};

export default InternalOrderNew;
