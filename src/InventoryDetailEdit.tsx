import { Timestamp } from 'firebase/firestore';
import React, { useState } from 'react';

import { Button, Form, Grid, Modal } from './components';
import { InventoryDetail } from './types';

type Props = {
  open: boolean;
  value: InventoryDetail;
  onClose: () => void;
  onUpdate: (inventoryDetail: InventoryDetail) => void;
};

const InventoryDetailEdit: React.FC<Props> = ({ open, value, onClose, onUpdate }) => {
  const [inventoryDetail, setInventoryDetail] = useState<InventoryDetail>(value);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(inventoryDetail);
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
            <Form.Text placeholder="商品コード" disabled required value={inventoryDetail.productCode} />
            <Form.Label>商品名</Form.Label>
            <Form.Text placeholder="商品名" disabled required value={inventoryDetail.productName} />
            <Form.Label>数量</Form.Label>
            <Form.Number
              placeholder="数量"
              required
              value={String(inventoryDetail.quantity)}
              onChange={(e) => {
                setInventoryDetail({ ...inventoryDetail, quantity: +e.target.value });
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

export default InventoryDetailEdit;
