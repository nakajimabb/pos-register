import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import DeliveryMain from './DeliveryMain';

const DeliveryEdit: React.FC = () => {
  const [target, setTarget] = useState<{ shopCode: string; deliveryNumber: number }>({
    shopCode: '',
    deliveryNumber: -1,
  });
  const params = useLocation().search;

  useEffect(() => {
    const query = new URLSearchParams(params);
    const shopCode = query.get('shopCode');
    const deliveryNumber = query.get('deliveryNumber');
    if (shopCode && deliveryNumber) {
      setTarget({ shopCode, deliveryNumber: +deliveryNumber });
    }
  }, [params]);

  return target.shopCode && target.deliveryNumber ? (
    <DeliveryMain shopCode={target.shopCode} deliveryNumber={target.deliveryNumber} />
  ) : null;
};

export default DeliveryEdit;
