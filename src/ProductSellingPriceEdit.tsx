import React, { useState, useEffect } from 'react';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  getFirestore,
  limit,
  orderBy,
  startAt,
  endAt,
  QueryConstraint,
  query,
} from 'firebase/firestore';
import { SingleValue } from 'react-select';
import AsyncSelect from 'react-select/async';

import { Alert, Button, Form, Grid, Modal } from './components';
import firebaseError from './firebaseError';
import { Product, ProductSellingPrice } from './types';
import { nameWithCode } from './tools';

const db = getFirestore();

type Props = {
  open: boolean;
  shopCode: string;
  productCode: string | null;
  onClose: () => void;
  onUpdate: () => void;
};

const ProductSellingPriceEdit: React.FC<Props> = ({ open, shopCode, productCode, onClose, onUpdate }) => {
  const [productSellingPrice, setProductSellingPrice] = useState<ProductSellingPrice>({
    productCode: productCode ?? '',
    productName: '',
    shopCode,
    sellingPrice: null,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const f = async () => {
      if (productCode && shopCode) {
        const ref = doc(db, 'shops', shopCode, 'productSellingPrices', productCode);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const cost_price = snap.data() as ProductSellingPrice;
          setProductSellingPrice(cost_price);
        } else {
          resetProductSellingPrice();
        }
      } else {
        resetProductSellingPrice();
      }
      setError('');
    };
    f();
  }, [productCode, shopCode]);

  const setProductCode = async (e: SingleValue<{ label: string; value: string }>) => {
    const code = String(e?.value);
    const ref = doc(db, 'products', code);
    const snap = await getDoc(ref);
    const product = snap.data();
    if (product) {
      setProductSellingPrice({
        ...productSellingPrice,
        productCode: code,
        productName: product.name,
        sellingPrice: product.sellingPrice,
      });
    }
  };

  const loadProductions = async (inputText: string) => {
    if (inputText) {
      const conds: QueryConstraint[] = [];
      if (inputText.match(/^\d+$/)) {
        conds.push(orderBy('code'));
      } else {
        conds.push(orderBy('name'));
      }
      conds.push(startAt(inputText));
      conds.push(endAt(inputText + '\uf8ff'));
      conds.push(limit(20));
      const q = query(collection(db, 'products'), ...conds);
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((item) => {
        const product = item.data() as Product;
        return { label: nameWithCode(product), value: item.id };
      });
    } else {
      return [];
    }
  };

  const resetProductSellingPrice = () => {
    setProductSellingPrice({
      shopCode,
      productCode: '',
      productName: '',
      sellingPrice: null,
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (!shopCode) throw Error('店舗コードが指定されていません。');

      if (productCode) {
        await setDoc(doc(db, 'shops', shopCode, 'productSellingPrices', productCode), productSellingPrice);
      } else {
        if (!productSellingPrice.productCode) throw Error('商品が指定されていません。');

        const ref = doc(db, 'shops', shopCode, 'productSellingPrices', productSellingPrice.productCode);
        const snap = await getDoc(ref);
        if (snap.exists()) throw Error('指定された商品は既に登録されています。');

        await setDoc(
          doc(db, 'shops', shopCode, 'productSellingPrices', productSellingPrice.productCode),
          productSellingPrice
        );
      }
      onUpdate();
      onClose();
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-2/3 overflow-visible">
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
          <Grid cols="1 sm:2" gap="0 sm:3" auto_cols="fr" template_cols="1fr 2fr" className="row-end-2">
            <Form.Label>商品名称</Form.Label>
            <AsyncSelect
              className="mb-3 sm:mb-0"
              value={{ label: productSellingPrice.productName, value: productSellingPrice.productCode }}
              isDisabled={!!productCode}
              loadOptions={loadProductions}
              onChange={setProductCode}
            />
            <Form.Label>売価税抜</Form.Label>
            <Form.Number
              placeholder="売価"
              required
              value={String(productSellingPrice.sellingPrice)}
              onChange={(e) =>
                setProductSellingPrice({
                  ...productSellingPrice,
                  sellingPrice: e.target.value ? +e.target.value : null,
                })
              }
            />
          </Grid>
        </Modal.Body>
        <Modal.Footer className="flex justify-end">
          <Button color="secondary" variant="outlined" className="mr-3" onClick={onClose}>
            Cancel
          </Button>
          <Button color="primary">保存</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default ProductSellingPriceEdit;
