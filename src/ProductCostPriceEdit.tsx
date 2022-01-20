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
import Select, { SingleValue } from 'react-select';
import AsyncSelect from 'react-select/async';

import { Alert, Button, Form, Grid, Modal } from './components';
import { useAppContext } from './AppContext';
import firebaseError from './firebaseError';
import { Product, ProductCostPrice, Supplier, getProductCostPricePath } from './types';
import { nameWithCode } from './tools';

const db = getFirestore();

type Props = {
  open: boolean;
  shopCode: string;
  path: string | null;
  onClose: () => void;
  onUpdate: () => void;
};

const ProductCostPriceEdit: React.FC<Props> = ({ open, shopCode, path, onClose, onUpdate }) => {
  const [productCostPrice, setProductCostPrice] = useState<ProductCostPrice>({
    productCode: '',
    productName: '',
    shopCode,
    costPrice: null,
    supplierCode: '',
    supplierName: '',
  });
  const [error, setError] = useState('');
  const [supplierOptions, setSuppliersOptions] = useState<{ label: string; value: string }[]>([]);
  const { registListner, suppliers } = useAppContext();

  useEffect(() => {
    if (open) registListner('suppliers');
  }, [open]);

  useEffect(() => {
    if (suppliers) {
      const options = Object.entries(suppliers).map(([code, supplier]) => ({
        value: code,
        label: nameWithCode(supplier),
      }));
      options.unshift({ label: '', value: '' });
      setSuppliersOptions(options);
    }
  }, [suppliers]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const setSupplier = (e: SingleValue<{ label: string; value: string }>) => {
    const supplierCode = e?.value || '';
    if (supplierCode && suppliers) {
      const supplier = suppliers[supplierCode];
      setProductCostPrice({ ...productCostPrice, supplierCode, supplierName: supplier.name });
    }
  };

  const setProductCode = async (e: SingleValue<{ label: string; value: string }>) => {
    const code = String(e?.value);
    const ref = doc(db, 'products', code);
    const snap = await getDoc(ref);
    const product = snap.data();
    if (product) {
      const snapSupplier = await getDoc(product.supplierRef);
      const supplier = snapSupplier.data() as Supplier;
      setProductCostPrice({
        ...productCostPrice,
        productCode: code,
        productName: product.name,
        costPrice: product.costPrice,
        supplierCode: supplier.code,
        supplierName: supplier.name,
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

  useEffect(() => {
    const f = async () => {
      if (path) {
        const ref = doc(db, path);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const cost_price = snap.data() as ProductCostPrice;
          setProductCostPrice(cost_price);
        } else {
          resetProductCostPrice();
        }
      } else {
        resetProductCostPrice();
      }
      setError('');
    };
    f();
  }, [path]);

  const resetProductCostPrice = () => {
    setProductCostPrice({
      shopCode,
      productCode: '',
      productName: '',
      supplierCode: '',
      supplierName: '',
      costPrice: null,
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (!shopCode) throw Error('店舗コードが指定されていません。');
      if (!productCostPrice.supplierCode) throw Error('仕入先が指定されていません。');

      if (path) {
        await setDoc(doc(db, path), productCostPrice);
      } else {
        if (!productCostPrice.productCode) throw Error('商品が指定されていません。');

        const path = getProductCostPricePath(productCostPrice);
        const ref = doc(db, path);
        const snap = await getDoc(ref);
        if (snap.exists()) throw Error('指定された商品は既に登録されています。');

        await setDoc(doc(db, path), productCostPrice);
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
              value={{ label: productCostPrice.productName, value: productCostPrice.productCode }}
              isDisabled={!!path}
              loadOptions={loadProductions}
              onChange={setProductCode}
            />
            <Form.Label>仕入先</Form.Label>
            <Select
              value={selectValue(productCostPrice.supplierCode, supplierOptions)}
              isDisabled={!!path}
              options={supplierOptions}
              onChange={setSupplier}
              className="mb-3 sm:mb-0"
            />
            <Form.Label>原価税抜</Form.Label>
            <Form.Number
              placeholder="原価"
              required
              value={String(productCostPrice.costPrice)}
              onChange={(e) =>
                setProductCostPrice({ ...productCostPrice, costPrice: e.target.value ? +e.target.value : null })
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

export default ProductCostPriceEdit;
