import React, { useState, useEffect } from 'react';

import { Alert, Button, Form, Grid, Modal } from './components';
import { isNum } from './tools';
import { RejectionDetail } from './types';

type Props = {
  open: boolean;
  value: RejectionDetail | undefined;
  onClose: () => void;
  onUpdate: (deliveryDetail: RejectionDetail) => void;
};

const RejectionDetailEdit: React.FC<Props> = ({ open, value, onClose, onUpdate }) => {
  const [rejectionDetail, setRejectionDetail] = useState<RejectionDetail>(
    value ?? {
      rejectType: 'return',
      productCode: '',
      productName: '',
      quantity: 0,
      costPrice: null,
      reason: '',
      fixed: false,
    }
  );
  const [alert, setAlert] = useState({ error: '', info: '' });

  useEffect(() => {
    setAlert((prev) => ({
      ...prev,
      info: `${rejectionDetail.rejectType === 'waste' ? '廃棄' : '返却'}として処理されます。`,
    }));
  }, [rejectionDetail]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNum(rejectionDetail.quantity) || rejectionDetail.quantity <= 0) {
      setAlert({ error: '数量は0より大きい値を入力してください。', info: '' });
      return;
    }
    onUpdate(rejectionDetail);
    onClose();
  };

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-2/3 overflow-visible">
      <Form onSubmit={submit} className="space-y-2">
        <Modal.Header centered={false} onClose={onClose}>
          仕入編集
        </Modal.Header>
        <Modal.Body>
          {alert.error && (
            <Alert severity="error" className="my-4" onClose={() => setAlert((prev) => ({ ...prev, error: '' }))}>
              {alert.error}
            </Alert>
          )}
          {alert.info && (
            <Alert severity="info" className="my-4" onClose={() => setAlert((prev) => ({ ...prev, info: '' }))}>
              {alert.info}
            </Alert>
          )}
          <Grid cols="1 sm:2" gap="0 sm:3" auto_cols="fr" template_cols="1fr 3fr" className="row-end-2">
            <Form.Label>商品コード</Form.Label>
            <Form.Text placeholder="商品コード" disabled value={rejectionDetail.productCode} />
            <Form.Label>商品名</Form.Label>
            <Form.Text placeholder="商品名" disabled value={rejectionDetail.productName} />
            <Form.Label>数量</Form.Label>
            <Form.Number
              placeholder="数量"
              value={String(rejectionDetail.quantity)}
              onChange={(e) => setRejectionDetail({ ...rejectionDetail, quantity: +e.target.value })}
            />
            <Form.Label>種別</Form.Label>
            <Form.Select
              value={String(rejectionDetail.rejectType)}
              required
              options={[
                { value: 'return', label: '返却' },
                { value: 'waste', label: '廃棄' },
              ]}
              disabled
            />
            <Form.Label>仕入価格</Form.Label>
            <Form.Number
              placeholder="仕入価格"
              value={String(rejectionDetail.costPrice)}
              onChange={(e) => setRejectionDetail({ ...rejectionDetail, costPrice: +e.target.value })}
            />
            <Form.Label>理由</Form.Label>
            <Form.TextArea
              value={String(rejectionDetail.reason)}
              onChange={(e) => {
                console.log(e.target.value);
                setRejectionDetail({ ...rejectionDetail, reason: e.target.value });
              }}
            />
          </Grid>
        </Modal.Body>
        <Modal.Footer className="flex justify-end space-x-2">
          <Button color="primary">OK</Button>
          <Button color="secondary" variant="outlined" onClick={onClose}>
            Cancel
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default RejectionDetailEdit;
