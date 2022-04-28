import React, { useState, useEffect } from 'react';
import Select, { SingleValue } from 'react-select';
import { doc, getDoc, getFirestore, DocumentSnapshot } from 'firebase/firestore';
import { Alert, Button, Form, Grid, Modal } from './components';
import { isNum, nameWithCode } from './tools';
import { ProductCostPrice, productCostPricePath, InternalOrderDetail, Product } from './types';
import { useAppContext } from './AppContext';

const db = getFirestore();

type Props = {
  open: boolean;
  shopCode: string;
  value: InternalOrderDetail | undefined;
  onClose: () => void;
  onUpdate: (internalOrderDetail: InternalOrderDetail) => void;
};

const InternalOrderDetailEdit: React.FC<Props> = ({ open, shopCode, value, onClose, onUpdate }) => {
  const [internalOrderDetail, setInternalOrderDetail] = useState<InternalOrderDetail>(
    value ?? {
      productCode: '',
      productName: '',
      quantity: 0,
      costPrice: null,
    }
  );
  const [supplierOptions, setSuppliersOptions] = useState<{ label: string; value: string }[]>([]);
  const [alert, setAlert] = useState({ error: '', info: '' });
  const { registListner, suppliers } = useAppContext();

  useEffect(() => {
    registListner('suppliers');
  }, []);

  useEffect(() => {
    const options = Array.from(suppliers.entries()).map(([code, shop]) => ({
      value: code,
      label: nameWithCode(shop),
    }));
    options.unshift({ label: '', value: '' });
    setSuppliersOptions(options);
  }, [suppliers]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNum(internalOrderDetail.quantity) || internalOrderDetail.quantity <= 0) {
      setAlert({ error: '数量は0より大きい値を入力してください。', info: '' });
      return;
    }
    onUpdate(internalOrderDetail);
    onClose();
  };

  const pdct = async (productCode: string) => {
    const snap = (await getDoc(doc(db, 'products', productCode))) as DocumentSnapshot<Product>;
    if (snap.exists()) return snap.data();
  };

  const changeSupplier = async (e: SingleValue<{ label: string; value: string }>) => {
    const supplierCode = e?.value || '';
    let costPrice = internalOrderDetail.costPrice;
    let product: Product | undefined;
    if (supplierCode) {
      const path = productCostPricePath(shopCode, internalOrderDetail.productCode, supplierCode);
      const dsnap = (await getDoc(doc(db, path))) as DocumentSnapshot<ProductCostPrice>;
      const price = dsnap.data();
      if (price && isNum(price.costPrice)) {
        costPrice = price.costPrice;
      } else {
        if (!product) product = await pdct(internalOrderDetail.productCode);
        if (product && isNum(product.costPrice)) costPrice = product.costPrice;
      }
    }

    setInternalOrderDetail((prev) => ({
      ...prev,
      costPrice,
      supplierCode,
      supplierName: suppliers.get(supplierCode)?.name ?? '',
    }));
  };

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-2/3 overflow-visible">
      <Form onSubmit={submit} className="space-y-2">
        <Modal.Header centered={false} onClose={onClose}>
          社内発注編集
        </Modal.Header>
        <Modal.Body>
          {alert.error && (
            <Alert severity="error" className="my-4" onClose={() => setAlert((prev) => ({ ...prev, error: '' }))}>
              {alert.error}
            </Alert>
          )}
          {alert.info && (
            <Alert severity="info" className="my-4" onClose={() => setAlert((prev) => ({ ...prev, info: '' }))}>
              {alert.info}
            </Alert>
          )}
          <Grid cols="1 sm:2" gap="0 sm:3" auto_cols="fr" template_cols="1fr 3fr" className="row-end-2">
            <Form.Label>商品コード</Form.Label>
            <Form.Text placeholder="商品コード" disabled value={internalOrderDetail.productCode} />
            <Form.Label>商品名</Form.Label>
            <Form.Text placeholder="商品名" disabled value={internalOrderDetail.productName} />
            <Form.Label>数量</Form.Label>
            <Form.Number
              placeholder="数量"
              value={String(internalOrderDetail.quantity)}
              onChange={(e) => setInternalOrderDetail({ ...internalOrderDetail, quantity: +e.target.value })}
            />
            <Form.Label>仕入価格</Form.Label>
            <Form.Number
              placeholder="仕入価格"
              value={String(internalOrderDetail.costPrice)}
              onChange={(e) => setInternalOrderDetail({ ...internalOrderDetail, costPrice: +e.target.value })}
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

export default InternalOrderDetailEdit;
