import React, { useState, useEffect } from 'react';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  getFirestore,
  DocumentReference,
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
import firebaseError from './firebaseError';
import { Product, ProductCostPrice, Supplier } from './types';

const db = getFirestore();

type Props = {
  open: boolean;
  productCode: string | null;
  shopCode: string;
  suppliers: { id: string; supplier: Supplier }[];
  onClose: () => void;
  onUpdate: () => void;
};

const ProductCostPriceEdit: React.FC<Props> = ({ open, productCode, shopCode, suppliers, onClose, onUpdate }) => {
  const [costPrice, setCostPrice] = useState<ProductCostPrice>({
    code: productCode ? productCode : '',
    name: '',
    shopCode,
    costPrice: null,
    supplierRef: null,
  });
  const [error, setError] = useState('');
  const [supplierOptions, setSuppliersOptions] = useState<{ label: string; value: string }[]>([]);

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
    setCostPrice({ ...costPrice, supplierRef: ref as DocumentReference<Supplier> | null });
  };

  const setProductCode = (e: SingleValue<{ label: string; value: string }>) => {
    setCostPrice({ ...costPrice, code: String(e?.value), name: String(e?.label) });
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
      console.log({ conds });
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((item) => {
        const product = item.data() as Product;
        return { label: product.name + '(' + product.code + ')', value: item.id };
      });
    } else {
      return [];
    }
  };

  useEffect(() => {
    const f = async () => {
      if (productCode && shopCode) {
        const ref = doc(db, 'shops', shopCode, 'costPrices', productCode);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const cost_price = snap.data() as ProductCostPrice;
          setCostPrice(cost_price);
        } else {
          resetCostPrice();
        }
      } else {
        resetCostPrice();
      }
      setError('');
    };
    f();
  }, [productCode, shopCode]);

  const resetCostPrice = () => {
    setCostPrice({
      code: '',
      name: '',
      shopCode: '',
      costPrice: null,
      supplierRef: null,
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (costPrice.code && shopCode) {
        await setDoc(doc(db, 'shops', shopCode, 'costPrices', costPrice.code), costPrice);
      }
      onUpdate();
      onClose();
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-2/3">
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
              value={{ label: costPrice.name, value: costPrice.code }}
              isDisabled={!!productCode}
              loadOptions={loadProductions}
              onChange={setProductCode}
            />
            <Form.Label>原価税抜</Form.Label>
            <Form.Number
              placeholder="原価"
              value={String(costPrice.costPrice)}
              onChange={(e) => setCostPrice({ ...costPrice, costPrice: +e.target.value })}
            />
            <Form.Label>仕入先</Form.Label>
            <Select
              className="mb-3 sm:mb-0"
              value={selectValue(costPrice.supplierRef?.id, supplierOptions)}
              options={supplierOptions}
              onChange={setSupplierRef}
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
