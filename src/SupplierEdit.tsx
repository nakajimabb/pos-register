import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';

import { Alert, Button, Form, Grid, Modal } from './components';
import firebaseError from './firebaseError';
import { Supplier } from './types';

const db = getFirestore();

type Props = {
  open: boolean;
  docId: string | null;
  onClose: () => void;
  onUpdate: (supplier: Supplier) => void;
};

const SupplierEdit: React.FC<Props> = ({ open, docId, onClose, onUpdate }) => {
  const [supplier, setSupplier] = useState<Supplier>({
    code: '',
    name: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const f = async () => {
      if (docId) {
        const ref = doc(db, 'suppliers', docId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setSupplier(snap.data() as Supplier);
        } else {
          resetSupplier();
        }
      } else {
        resetSupplier();
      }
      setError('');
    };
    f();
  }, [docId]);

  const resetSupplier = () => {
    setSupplier({
      code: '',
      name: '',
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (docId) {
        await setDoc(doc(db, 'suppliers', docId), supplier);
      } else {
        const ref = doc(db, 'suppliers', supplier.code);
        const snap = await getDoc(ref);
        if (snap.exists()) throw Error('仕入先コードが既に存在します。');
        await setDoc(doc(db, 'suppliers', supplier.code), supplier);
      }
      onUpdate(supplier);
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
          仕入先編集
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
            <Form.Label>仕入先コード</Form.Label>
            <Form.Text
              placeholder="仕入先コード"
              disabled={!!docId}
              required
              value={docId ? docId : supplier.code}
              onChange={(e) =>
                setSupplier({ ...supplier, code: e.target.value })
              }
            />
            <Form.Label>仕入先名称</Form.Label>
            <Form.Text
              placeholder="仕入先名称"
              value={supplier.name}
              onChange={(e) =>
                setSupplier({ ...supplier, name: e.target.value })
              }
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

export default SupplierEdit;
