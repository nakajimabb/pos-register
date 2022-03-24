import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, getFirestore, DocumentReference } from 'firebase/firestore';
import Select, { SingleValue } from 'react-select';

import { Alert, Button, Flex, Form, Grid, Modal } from './components';
import firebaseError from './firebaseError';
import { Product, ProductCategory, Supplier, TaxClass } from './types';
import { checkDigit } from './tools';
import clsx from 'clsx';

const db = getFirestore();

const TAX_CLASS_OPTIONS = [
  { value: '', label: '' },
  { value: 'exclusive', label: '外税' },
  { value: 'inclusive', label: '内税' },
  { value: 'free', label: '非課税' },
];

const TAX_OPTIONS = [
  { value: '', label: '' },
  { value: '8', label: '8%' },
  { value: '10', label: '10%' },
];

type Props = {
  open: boolean;
  docId: string | null;
  productCategories: { id: string; productCategory: ProductCategory }[];
  suppliers: { id: string; supplier: Supplier }[];
  onClose: () => void;
  onUpdate: (product: Product) => void;
};

const ProductEdit: React.FC<Props> = ({ open, docId, productCategories, suppliers, onClose, onUpdate }) => {
  const [product, setProduct] = useState<Product>({
    code: '',
    name: '',
    kana: '',
    abbr: '',
    hidden: false,
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
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([]);
  const [supplierOptions, setSuppliersOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    const options = productCategories.map(({ id, productCategory }) => ({
      value: id,
      label: '　'.repeat(productCategory.level) + productCategory.name,
    }));
    options.unshift({ label: '', value: '' });
    setCategoryOptions(options);
  }, [productCategories]);

  useEffect(() => {
    const options = suppliers.map(({ id, supplier }) => ({
      value: id,
      label: `${supplier.name}(${supplier.code})`,
    }));
    options.unshift({ label: '', value: '' });
    setSuppliersOptions(options);
  }, [suppliers]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const setSupplierRef = (e: SingleValue<{ label: string; value: string }>) => {
    const ref = e?.value ? doc(db, 'suppliers', e.value) : null;
    setProduct({ ...product, supplierRef: ref as DocumentReference<Supplier> | null });
  };

  const setCategoryRef = (e: SingleValue<{ label: string; value: string }>) => {
    const ref = e?.value ? doc(db, 'productCategories', e.value) : null;
    setProduct({ ...product, categoryRef: ref as DocumentReference<ProductCategory> | null });
  };

  useEffect(() => {
    const f = async () => {
      if (docId) {
        const ref = doc(db, 'products', docId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const prdct = snap.data() as Product;
          setProduct(prdct);
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
      hidden: false,
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
        if (!checkDigit(product.code)) throw Error('不正なPLUコードです。');
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
              required
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
            <Form.Label>カテゴリ</Form.Label>
            <Select
              className="mb-3 sm:mb-0 select2"
              value={selectValue(product.categoryRef?.id, categoryOptions)}
              options={categoryOptions}
              onChange={setCategoryRef}
            />
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
            <Form.Label>税区分(売価)</Form.Label>
            <Form.Select
              className="mb-3 sm:mb-0"
              value={String(product.sellingTaxClass)}
              required
              options={TAX_CLASS_OPTIONS}
              onChange={(e) => setProduct({ ...product, sellingTaxClass: e.target.value as TaxClass })}
            />
            <Form.Label>税区分(仕入)</Form.Label>
            <Form.Select
              className="mb-3 sm:mb-0"
              value={String(product.stockTaxClass)}
              required
              options={TAX_CLASS_OPTIONS}
              onChange={(e) => setProduct({ ...product, stockTaxClass: e.target.value as TaxClass })}
            />
            <Form.Label>売価消費税</Form.Label>
            <Form.Select
              className="mb-3 sm:mb-0"
              value={String(product.sellingTax)}
              required
              options={TAX_OPTIONS}
              onChange={(e) => setProduct({ ...product, sellingTax: e.target.value ? +e.target.value : null })}
            />
            <Form.Label>仕入消費税</Form.Label>
            <Form.Select
              className="mb-3 sm:mb-0"
              value={String(product.stockTax)}
              required
              options={TAX_OPTIONS}
              onChange={(e) => setProduct({ ...product, stockTax: e.target.value ? +e.target.value : null })}
            />
            <Form.Label></Form.Label>
            <Form.Checkbox
              label="セルフメディケーション"
              checked={product.selfMedication}
              onChange={(e) => setProduct({ ...product, selfMedication: e.target.checked })}
            />
            <Form.Label>仕入先</Form.Label>
            <Select
              className="mb-3 sm:mb-0"
              value={selectValue(product.supplierRef?.id, supplierOptions)}
              options={supplierOptions}
              onChange={setSupplierRef}
            />
            <Form.Label>備考</Form.Label>
            <Form.Text
              placeholder="備考"
              value={product.note}
              onChange={(e) => setProduct({ ...product, note: e.target.value })}
            />
            <Form.Label></Form.Label>
            <Flex className="space-x-2">
              <Form.Checkbox
                label="非稼働"
                checked={product.hidden}
                onChange={(e) => setProduct({ ...product, hidden: e.target.checked })}
              />
              <div className={clsx(product.unregistered && 'text-red-500 font-bold')}>
                <Form.Checkbox
                  label="未登録"
                  checked={product.unregistered}
                  onChange={(e) => setProduct({ ...product, unregistered: e.target.checked })}
                  className="text-gray-300"
                />
              </div>
            </Flex>
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

export default ProductEdit;
