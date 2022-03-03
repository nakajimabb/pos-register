import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PurchaseMain from './PurchaseMain';

const PurchaseEdit: React.FC = () => {
  const [target, setTarget] = useState<{ shopCode: string; purchaseNumber: number }>({
    shopCode: '',
    purchaseNumber: -1,
  });
  const params = useLocation().search;

  useEffect(() => {
    const query = new URLSearchParams(params);
    const shopCode = query.get('shopCode');
    const purchaseNumber = query.get('purchaseNumber');
    if (shopCode && purchaseNumber) {
      setTarget({ shopCode, purchaseNumber: +purchaseNumber });
    }
  }, [params]);

  return target.shopCode && target.purchaseNumber ? (
    <PurchaseMain shopCode={target.shopCode} purchaseNumber={target.purchaseNumber} />
  ) : null;
};

export default PurchaseEdit;
