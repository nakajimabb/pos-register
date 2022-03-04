import React from 'react';
import { useAppContext } from './AppContext';
import DeliveryMain from './DeliveryMain';

const DeliveryNew: React.FC = () => {
  const { currentShop } = useAppContext();

  return currentShop ? <DeliveryMain shopCode={currentShop.code} /> : null;
};

export default DeliveryNew;
