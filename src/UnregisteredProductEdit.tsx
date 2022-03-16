import React, { useState } from 'react';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';

import { Alert, Button, Form, Grid, Modal } from './components';
import firebaseError from './firebaseError';
import { Product } from './types';
import { checkDigit } from './tools';

const db = getFirestore();

type Props = {
  open: boolean;
  productCode: string;
  onClose: () => void;
  onUpdate: (product: Product) => void;
};

const UnregisteredProductEdit: React.FC<Props> = ({ open, productCode, onClose, onUpdate }) => {
  const [product, setProduct] = useState<Product>({
    code: productCode,
    name: '未登録商品',
    kana: '',
    abbr: '',
    hidden: true,
    costPrice: null,
    sellingPrice: null,
    stockTaxClass: null,
    sellingTaxClass: null,
    stockTax: null,
    sellingTax: null,
    selfMedication: false,
    supplierRef: null,
    categoryRef: null,
    note: '',
  });
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const ref = doc(db, 'products', product.code);
      const snap = await getDoc(ref);
      if (!checkDigit(product.code)) throw Error('不正なPLUコードです。');
      if (snap.exists()) throw Error('PLUコードが既に存在します。');

      await setDoc(doc(db, 'products', product.code), product);
      onUpdate(product);
      onClose();
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-1/2 overflow-visible">
      <Form onSubmit={save} className="space-y-2">
        <Modal.Header centered={false} onClose={onClose}>
          未登録商品
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert severity="error" onClose={() => setError('')} className="mb-2">
              {error}
            </Alert>
          )}
          <Grid cols="1 sm:2" gap="0 sm:3" auto_cols="fr" template_cols="1fr 2fr" className="row-end-2">
            <Form.Label>商品コード</Form.Label>
            <Form.Text placeholder="商品コード" disabled required value={product.code} />
            <Form.Label>商品名</Form.Label>
            <Form.Text placeholder="商品名" disabled required value={product.name} />
            <Form.Label>売価税抜</Form.Label>
            <Form.Number
              placeholder="売価"
              required
              value={String(product.sellingPrice)}
              onChange={(e) => setProduct({ ...product, sellingPrice: +e.target.value })}
            />
            <Form.Label>原価税抜</Form.Label>
            <Form.Number
              placeholder="原価"
              required
              value={String(product.costPrice)}
              onChange={(e) => setProduct({ ...product, costPrice: +e.target.value })}
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

export default UnregisteredProductEdit;
