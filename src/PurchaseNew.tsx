import React from 'react';
import { useAppContext } from './AppContext';
import PurchaseMain from './PurchaseMain';

const PurchaseNew: React.FC = () => {
  const { currentShop } = useAppContext();

  return currentShop ? <PurchaseMain shopCode={currentShop.code} shopName={currentShop.name} /> : null;
};

export default PurchaseNew;
