import React, { useState } from 'react';

import { Alert, Button, Form, Grid, Modal } from './components';
import { PurchaseDetail } from './types';

type Props = {
  open: boolean;
  value: PurchaseDetail | undefined;
  onClose: () => void;
  onUpdate: (deliveryDetail: PurchaseDetail) => void;
};

const PurchaseDetailEdit: React.FC<Props> = ({ open, value, onClose, onUpdate }) => {
  const [purchaseDetail, setPurchaseDetail] = useState<PurchaseDetail>(
    value || {
      productCode: '',
      productName: '',
      quantity: 0,
      costPrice: null,
      fixed: false,
    }
  );
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(purchaseDetail);
    onClose();
  };

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-2/3 overflow-visible">
      <Form onSubmit={submit} className="space-y-2">
        <Modal.Header centered={false} onClose={onClose}>
          仕入編集
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert severity="error" className="my-4">
              {error}
            </Alert>
          )}
          <Grid cols="1 sm:2" gap="0 sm:3" auto_cols="fr" template_cols="1fr 3fr" className="row-end-2">
            <Form.Label>商品コード</Form.Label>
            <Form.Text placeholder="商品コード" disabled value={purchaseDetail.productCode} />
            <Form.Label>商品名</Form.Label>
            <Form.Text placeholder="商品名" disabled value={purchaseDetail.productName} />
            <Form.Label>数量</Form.Label>
            <Form.Number
              placeholder="数量"
              value={String(purchaseDetail.quantity)}
              onChange={(e) => setPurchaseDetail({ ...purchaseDetail, quantity: +e.target.value })}
            />
            <Form.Label>仕入価格</Form.Label>
            <Form.Number
              placeholder="仕入価格"
              value={String(purchaseDetail.costPrice)}
              onChange={(e) => setPurchaseDetail({ ...purchaseDetail, costPrice: +e.target.value })}
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

export default PurchaseDetailEdit;
