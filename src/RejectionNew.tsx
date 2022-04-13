import React from 'react';
import { useAppContext } from './AppContext';
import RejectionMain from './RejectionMain';

const RejectionNew: React.FC = () => {
  const { currentShop } = useAppContext();

  return currentShop ? <RejectionMain shopCode={currentShop.code} shopName={currentShop.name} /> : null;
};

export default RejectionNew;
