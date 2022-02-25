import React, { useState } from 'react';

import { Button, Form, Grid, Modal } from './components';
import { DeliveryDetail } from './types';

type Props = {
  open: boolean;
  value: DeliveryDetail | undefined;
  onClose: () => void;
  onUpdate: (deliveryDetail: DeliveryDetail) => void;
};

const DeliveryDetailEdit: React.FC<Props> = ({ open, value, onClose, onUpdate }) => {
  const [deliveryDetail, setDeliveryDetail] = useState<DeliveryDetail>(
    value || {
      productCode: '',
      productName: '',
      quantity: 0,
      costPrice: null,
      fixed: false,
    }
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(deliveryDetail);
    onClose();
  };

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-1/2 overflow-visible">
      <Form onSubmit={submit} className="space-y-2">
        <Modal.Header centered={false} onClose={onClose}>
          出庫処理項目
        </Modal.Header>
        <Modal.Body>
          <Grid cols="1 sm:2" gap="0 sm:3" auto_cols="fr" template_cols="1fr 2fr" className="row-end-2">
            <Form.Label>商品コード</Form.Label>
            <Form.Text placeholder="商品コード" disabled required value={deliveryDetail.productCode} />
            <Form.Label>商品名</Form.Label>
            <Form.Text placeholder="商品名" disabled required value={deliveryDetail.productName} />
            <Form.Label>数量</Form.Label>
            <Form.Number
              placeholder="数量"
              required
              value={String(deliveryDetail.quantity)}
              onChange={(e) => {
                setDeliveryDetail({ ...deliveryDetail, quantity: +e.target.value });
              }}
            />
            <Form.Label>仕入価格</Form.Label>
            <Form.Text
              placeholder="仕入価格"
              required
              value={String(deliveryDetail.costPrice ?? '')}
              onChange={(e) =>
                setDeliveryDetail({ ...deliveryDetail, costPrice: isNaN(+e.target.value) ? null : +e.target.value })
              }
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

export default DeliveryDetailEdit;
