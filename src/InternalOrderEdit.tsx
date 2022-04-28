import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import InternalOrderMain from './InternalOrderMain';

const InternalOrderEdit: React.FC = () => {
  const [target, setTarget] = useState<{ shopCode: string; internalOrderNumber: number }>({
    shopCode: '',
    internalOrderNumber: -1,
  });
  const params = useLocation().search;

  useEffect(() => {
    const query = new URLSearchParams(params);
    const shopCode = query.get('shopCode');
    const internalOrderNumber = query.get('internalOrderNumber');
    if (shopCode && internalOrderNumber) {
      setTarget({ shopCode, internalOrderNumber: +internalOrderNumber });
    }
  }, [params]);

  return target.shopCode && target.internalOrderNumber ? (
    <InternalOrderMain shopCode={target.shopCode} internalOrderNumber={target.internalOrderNumber} />
  ) : null;
};

export default InternalOrderEdit;
