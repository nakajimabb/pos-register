import React, { useState, useRef, useEffect } from 'react';
import { doc, getDoc, setDoc, getFirestore, serverTimestamp } from 'firebase/firestore';

import { Alert, Button, Form, Grid, Modal } from './components';
import firebaseError from './firebaseError';
import { Product, productSellingPricePath, productCostPricePath } from './types';
import { useAppContext } from './AppContext';
import { checkDigit } from './tools';

const db = getFirestore();

const TAX_OPTIONS = [
  { value: '', label: '' },
  { value: '8', label: '8%' },
  { value: '10', label: '10%' },
];

type Props = {
  open: boolean;
  productCode: string;
  shopCode: string;
  supplierCode?: string;
  onClose: () => void;
  onUpdate: (product: Product) => void;
};

const UnregisteredProductEdit: React.FC<Props> = ({ open, productCode, shopCode, supplierCode, onClose, onUpdate }) => {
  const [product, setProduct] = useState<Product>({
    code: productCode,
    name: '',
    kana: '',
    abbr: '',
    hidden: false,
    costPrice: null,
    avgCostPrice: null,
    sellingPrice: null,
    stockTaxClass: null,
    sellingTaxClass: null,
    stockTax: 10,
    sellingTax: 10,
    selfMedication: false,
    supplierRef: null,
    categoryRef: null,
    note: '',
  });
  const [error, setError] = useState('');
  const { suppliers, registListner } = useAppContext();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registListner('suppliers');
    ref.current?.focus();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const ref = doc(db, 'products', product.code);
      const snap = await getDoc(ref);
      if (!checkDigit(product.code)) throw Error('不正なPLUコードです。');
      if (snap.exists()) throw Error('PLUコードが既に存在します。');
      if (product.costPrice !== null && product.costPrice <= 0) {
        throw Error('原価は0より大きい値に設定してください。');
      }
      if (product.sellingPrice !== null && product.sellingPrice <= 0) {
        throw Error('売価は0より大きい値に設定してください。');
      }
      if (product.sellingPrice !== null && product.costPrice !== null && product.sellingPrice <= product.costPrice) {
        throw Error('売価は原価よりも高い価格に設定してください。');
      }
      // 商品マスタ(共通)
      await setDoc(doc(db, 'products', product.code), {
        ...product,
        sellingTaxClass: 'exclusive',
        stockTaxClass: 'exclusive',
        stockTax: product.sellingTax,
        unregistered: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // 店舗売価
      await setDoc(
        doc(db, productSellingPricePath(shopCode, product.code)),
        {
          shopCode,
          productCode: product.code,
          productName: product.name,
          sellingPrice: product.sellingPrice,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      const supCode = supplierCode ?? '0';
      const supplier = suppliers.get(supCode);
      // 店舗原価
      await setDoc(
        doc(db, productCostPricePath(shopCode, product.code, supCode)),
        {
          shopCode,
          productCode: product.code,
          productName: product.name,
          supplierCode: supCode,
          supplierName: supplier?.name ?? '',
          costPrice: product.costPrice,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
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
          未登録商品のため、商品名、売価・原価を設定してください
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
            <Form.Text
              placeholder="商品名"
              required
              value={product.name}
              onChange={(e) => setProduct({ ...product, name: e.target.value })}
            />
            <Form.Label>売価税抜</Form.Label>
            <Form.Number
              placeholder="売価"
              required
              innerRef={ref}
              value={String(product.sellingPrice)}
              onChange={(e) => setProduct({ ...product, sellingPrice: +e.target.value })}
            />
            <Form.Label>売価消費税</Form.Label>
            <Form.Select
              className="mb-3 sm:mb-0"
              value={String(product.sellingTax)}
              required
              options={TAX_OPTIONS}
              onChange={(e) => setProduct({ ...product, sellingTax: e.target.value ? +e.target.value : null })}
            />
            <Form.Label>原価税抜</Form.Label>
            <Form.Number
              placeholder="原価"
              required
              value={String(product.costPrice)}
              onChange={(e) => setProduct({ ...product, costPrice: +e.target.value })}
            />
            <Form.Label></Form.Label>
            <Form.Checkbox
              label="セルフメディケーション"
              checked={product.selfMedication}
              onChange={(e) => setProduct({ ...product, selfMedication: e.target.checked })}
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

export default UnregisteredProductEdit;
