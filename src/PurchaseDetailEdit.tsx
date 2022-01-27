import React, { useState } from 'react';

import { Alert, Button, Form, Grid, Modal } from './components';
import firebaseError from './firebaseError';
import { PurchaseDetail } from './types';

type Props = {
  open: boolean;
  item: PurchaseDetail;
  onClose: () => void;
  setItem: (item: PurchaseDetail) => void;
};

const PurchaseDetailEdit: React.FC<Props> = ({ open, item, onClose, setItem }) => {
  const [purchaseDetail, setPurchaseDetail] = useState<PurchaseDetail>(item);
  const [error, setError] = useState('');

  const update = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      setItem(purchaseDetail);
      onClose();
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  return (
    <Modal open={open} size="md" onClose={onClose}>
      <Form onSubmit={update} className="space-y-2">
        <Modal.Header centered={false} onClose={onClose}>
          仕入編集
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert severity="error" className="my-4">
              {error}
            </Alert>
          )}
          <Grid cols="1 sm:2" gap="0 sm:3" auto_cols="fr" className="max-w-xl row-end-2">
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
        <Modal.Footer className="flex justify-end">
          <Button color="secondary" variant="outlined" className="mr-3" onClick={onClose}>
            Cancel
          </Button>
          <Button color="primary">OK</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default PurchaseDetailEdit;
