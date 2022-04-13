import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import RejectionMain from './RejectionMain';

const RejectionEdit: React.FC = () => {
  const [target, setTarget] = useState<{ shopCode: string; rejectionNumber: number }>({
    shopCode: '',
    rejectionNumber: -1,
  });
  const params = useLocation().search;

  useEffect(() => {
    const query = new URLSearchParams(params);
    const shopCode = query.get('shopCode');
    const rejectionNumber = query.get('rejectionNumber');
    if (shopCode && rejectionNumber) {
      setTarget({ shopCode, rejectionNumber: +rejectionNumber });
    }
  }, [params]);

  return target.shopCode && target.rejectionNumber ? (
    <RejectionMain shopCode={target.shopCode} rejectionNumber={target.rejectionNumber} />
  ) : null;
};

export default RejectionEdit;
