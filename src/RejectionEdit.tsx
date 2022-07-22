import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from './AppContext';
import RejectionMain from './RejectionMain';

const RejectionEdit: React.FC = () => {
  const [target, setTarget] = useState<{ shopCode: string; rejectionNumber: number; confirmMode: boolean }>({
    shopCode: '',
    rejectionNumber: -1,
    confirmMode: false,
  });
  const { role } = useAppContext();
  const params = useLocation().search;

  useEffect(() => {
    const query = new URLSearchParams(params);
    const shopCode = query.get('shopCode');
    const rejectionNumber = query.get('rejectionNumber');
    const confirmMode = query.get('confirmMode')?.toLowerCase() === 'true' && role === 'manager';
    if (shopCode && rejectionNumber) {
      setTarget({ shopCode, rejectionNumber: +rejectionNumber, confirmMode });
    }
  }, [params]);

  return target.shopCode && target.rejectionNumber ? (
    <RejectionMain
      shopCode={target.shopCode}
      rejectionNumber={target.rejectionNumber}
      confirmMode={target.confirmMode}
    />
  ) : null;
};

export default RejectionEdit;
