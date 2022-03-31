import React, { useState, useEffect } from 'react';
import { doc, collection, getDoc, setDoc, addDoc, getFirestore } from 'firebase/firestore';

import { Alert, Button, Form, Grid, Modal } from './components';
import firebaseError from './firebaseError';
import { ProductCategory } from './types';

const db = getFirestore();

type Props = {
  open: boolean;
  docId: string | null;
  productCategories: { id: string; productCategory: ProductCategory }[];
  onClose: () => void;
  onUpdate: (productCategory: ProductCategory) => void;
};

const ProductCategoryEdit: React.FC<Props> = ({ open, docId, productCategories, onClose, onUpdate }) => {
  const [productCategory, setProductCategory] = useState<ProductCategory>({
    parentRef: null,
    name: '',
    level: 1,
  });
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    const f = async () => {
      if (docId) {
        const ref = doc(db, 'productCategories', docId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const category = snap.data() as ProductCategory;
          setProductCategory(category);
          setParentId(category.parentRef ? category.parentRef.id : '');
        } else {
          resetProductCategory();
        }
      } else {
        resetProductCategory();
      }
      setError('');
    };

    const categories = productCategories.filter(
      ({ id, productCategory }) => id !== docId && productCategory.level <= 2
    );
    const options = categories.map(({ id, productCategory }) => ({
      value: id,
      label: '　'.repeat(productCategory.level) + productCategory.name,
    }));
    options.unshift({ label: '', value: '' });
    setCategoryOptions(options);
    f();
  }, [docId, productCategories]);

  const resetProductCategory = () => {
    setProductCategory({
      parentRef: null,
      name: '',
      level: 1,
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const parentRef = parentId ? doc(db, 'productCategories', parentId) : null;
      let level = 1;
      if (parentRef) {
        const parentSnap = await getDoc(parentRef);
        const parentCategory = parentSnap.data();
        if (parentCategory) {
          level = parentCategory.level + 1;
        }
      }
      const category = { ...productCategory, parentRef, level };
      if (docId) {
        await setDoc(doc(db, 'productCategories', docId), category);
      } else {
        await addDoc(collection(db, 'productCategories'), category);
      }
      onUpdate(productCategory);
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
          カテゴリ編集
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert severity="error" className="my-4">
              {error}
            </Alert>
          )}
          <Grid cols="1 sm:2" gap="0 sm:3" auto_cols="fr" className="max-w-xl row-end-2">
            <Form.Label>親カテゴリ</Form.Label>
            <Form.Select options={categoryOptions} value={parentId} onChange={(e) => setParentId(e.target.value)} />
            <Form.Label>カテゴリ名称</Form.Label>
            <Form.Text
              placeholder="カテゴリ名称"
              value={productCategory.name}
              onChange={(e) => setProductCategory({ ...productCategory, name: e.target.value })}
            />
            <Form.Label>階層レベル</Form.Label>
            <Form.Number
              placeholder="階層レベル"
              value={String(productCategory.level)}
              disabled
              onChange={(e) => setProductCategory({ ...productCategory, name: e.target.value })}
            />
          </Grid>
        </Modal.Body>
        <Modal.Footer className="flex justify-end space-x-2">
          <Button color="primary">保存</Button>
          <Button color="secondary" variant="outlined" onClick={onClose}>
            Cancel
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default ProductCategoryEdit;
