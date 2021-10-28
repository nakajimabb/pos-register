import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';

import { Alert, Button, Form, Grid, Modal } from './components';
import firebaseError from './firebaseError';
import { Product } from './types';

const db = getFirestore();

type Props = {
  open: boolean;
  docId: string | null;
  onClose: () => void;
  onUpdate: (product: Product) => void;
};

const ProductEdit: React.FC<Props> = ({ open, docId, onClose, onUpdate }) => {
  const [product, setProduct] = useState<Product>({
    code: '',
    name: '',
    kana: '',
    abbr: '',
    price: null,
    note: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const f = async () => {
      if (docId) {
        const ref = doc(db, 'products', docId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProduct(snap.data() as Product);
        } else {
          resetProduct();
        }
      } else {
        resetProduct();
      }
      setError('');
    };
    f();
  }, [docId]);

  const resetProduct = () => {
    setProduct({
      code: '',
      name: '',
      kana: '',
      abbr: '',
      price: null,
      note: '',
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (docId) {
        await setDoc(doc(db, 'products', docId), product);
      } else {
        const ref = doc(db, 'products', product.code);
        const snap = await getDoc(ref);
        if (snap.exists()) throw Error('PLUコードが既に存在します。');
        await setDoc(doc(db, 'products', product.code), product);
      }
      onUpdate(product);
      onClose();
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  return (
    <Modal open={open} size="md" onClose={onClose}>
      <Form onSubmit={save} className="space-y-2">
        <Modal.Header centered={false} onClose={onClose}>
          商品編集
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert severity="error" className="my-4">
              {error}
            </Alert>
          )}
          <Grid
            cols="1 sm:2"
            gap="0 sm:3"
            auto_cols="fr"
            className="max-w-xl row-end-2"
          >
            <Form.Label>PLUコード</Form.Label>
            <Form.Text
              placeholder="PLUコード"
              disabled={!!docId}
              required
              value={docId ? docId : product.code}
              onChange={(e) => setProduct({ ...product, code: e.target.value })}
            />
            <Form.Label>商品名称</Form.Label>
            <Form.Text
              placeholder="商品名称"
              value={product.name}
              onChange={(e) => setProduct({ ...product, name: e.target.value })}
            />
            <Form.Label>商品名カナ</Form.Label>
            <Form.Text
              placeholder="商品名カナ"
              value={product.kana}
              onChange={(e) => setProduct({ ...product, kana: e.target.value })}
            />
            <Form.Label>商品名略</Form.Label>
            <Form.Text
              placeholder="商品名略"
              value={product.abbr}
              onChange={(e) => setProduct({ ...product, abbr: e.target.value })}
            />
            <Form.Label>売価税抜</Form.Label>
            <Form.Number
              placeholder="売価税抜"
              value={String(product.price)}
              onChange={(e) =>
                setProduct({ ...product, price: +e.target.value })
              }
            />
            <Form.Label>備考</Form.Label>
            <Form.Text
              placeholder="備考"
              value={product.note}
              onChange={(e) => setProduct({ ...product, note: e.target.value })}
            />
          </Grid>
        </Modal.Body>
        <Modal.Footer className="flex justify-end">
          <Button
            color="secondary"
            variant="outlined"
            className="mr-3"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button color="primary">保存</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default ProductEdit;