import React, { useState, useEffect, useRef } from 'react';
import Select, { SingleValue } from 'react-select';
import { doc, getDoc, getFirestore, DocumentSnapshot } from 'firebase/firestore';
import { Alert, Button, Form, Grid, Modal } from './components';
import { isNum, nameWithCode } from './tools';
import { ProductCostPrice, productCostPricePath, RejectionDetail, Product, WasteReason, wasteReasons } from './types';
import { useAppContext } from './AppContext';

const db = getFirestore();

type Props = {
  open: boolean;
  shopCode: string;
  value: RejectionDetail | undefined;
  onClose: () => void;
  onUpdate: (rejectionDetail: RejectionDetail) => void;
};

const RejectionDetailEdit: React.FC<Props> = ({ open, shopCode, value, onClose, onUpdate }) => {
  const [rejectionDetail, setRejectionDetail] = useState<RejectionDetail>(
    value ?? {
      rejectType: 'return',
      productCode: '',
      productName: '',
      quantity: 1,
      costPrice: null,
      fixed: false,
      submitted: false,
    }
  );
  const [supplierOptions, setSuppliersOptions] = useState<{ label: string; value: string }[]>([]);
  const [alert, setAlert] = useState({ error: '', info: '' });
  const { registListner, suppliers } = useAppContext();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registListner('suppliers');
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const options = Array.from(suppliers.entries()).map(([code, shop]) => ({
      value: code,
      label: nameWithCode(shop),
    }));
    options.unshift({ label: '', value: '' });
    setSuppliersOptions(options);
  }, [suppliers]);

  useEffect(() => {
    setAlert((prev) => ({
      ...prev,
      info: `${rejectionDetail.rejectType === 'waste' ? '廃棄' : '返品'}として処理されます。`,
    }));
  }, [rejectionDetail]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isNum(rejectionDetail.quantity) || rejectionDetail.quantity <= 0) {
      setAlert({ error: '数量は0より大きい値を入力してください。', info: '' });
      return;
    }
    onUpdate(rejectionDetail);
    onClose();
  };

  const pdct = async (productCode: string) => {
    const snap = (await getDoc(doc(db, 'products', productCode))) as DocumentSnapshot<Product>;
    if (snap.exists()) return snap.data();
  };

  const changeSupplier = async (e: SingleValue<{ label: string; value: string }>) => {
    const supplierCode = e?.value || '';
    let costPrice = rejectionDetail.costPrice;
    let rejectType = rejectionDetail.rejectType;
    let product: Product | undefined;
    if (supplierCode) {
      const path = productCostPricePath(shopCode, rejectionDetail.productCode, supplierCode);
      const dsnap = (await getDoc(doc(db, path))) as DocumentSnapshot<ProductCostPrice>;
      const price = dsnap.data();
      if (price && isNum(price.costPrice)) {
        costPrice = price.costPrice;
      } else {
        if (!product) product = await pdct(rejectionDetail.productCode);
        if (product && isNum(product.costPrice)) costPrice = product.costPrice;
      }
      if (price && price.noReturn !== undefined) {
        rejectType = price.noReturn ? 'waste' : 'return';
      } else {
        if (!product) product = await pdct(rejectionDetail.productCode);
        rejectType = product?.noReturn ? 'waste' : 'return';
      }
    }

    setRejectionDetail((prev) => ({
      ...prev,
      rejectType,
      costPrice,
      supplierCode,
      supplierName: suppliers.get(supplierCode)?.name ?? '',
    }));
  };

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-2/3 overflow-visible">
      <Form onSubmit={submit} className="space-y-2">
        <Modal.Header centered={false} onClose={onClose}>
          廃棄・返品編集
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
            <Form.Text placeholder="商品コード" disabled value={rejectionDetail.productCode} />
            <Form.Label>商品名</Form.Label>
            <Form.Text placeholder="商品名" disabled value={rejectionDetail.productName} />
            <Form.Label>数量</Form.Label>
            <Form.Number
              placeholder="数量"
              value={String(rejectionDetail.quantity)}
              innerRef={ref}
              onChange={(e) => setRejectionDetail({ ...rejectionDetail, quantity: +e.target.value })}
            />
            <Form.Label>種別</Form.Label>
            <Form.Select
              value={String(rejectionDetail.rejectType)}
              required
              options={[
                { value: 'return', label: '返品' },
                { value: 'waste', label: '廃棄' },
              ]}
              disabled
            />
            <Form.Label>仕入価格</Form.Label>
            <Form.Number
              placeholder="仕入価格"
              value={String(rejectionDetail.costPrice)}
              onChange={(e) => setRejectionDetail({ ...rejectionDetail, costPrice: +e.target.value })}
            />
            <Form.Label>仕入先</Form.Label>
            <Select
              className="mb-3 sm:mb-0"
              value={selectValue(rejectionDetail.supplierCode ?? '', supplierOptions)}
              options={supplierOptions}
              onChange={changeSupplier}
            />
            <Form.Label>廃棄理由</Form.Label>
            <Form.Select
              value={String(rejectionDetail.wasteReason)}
              required
              options={[{ label: '', value: '' }].concat(
                Object.entries(wasteReasons).map((item) => ({ label: item[1], value: item[0] }))
              )}
              onChange={(e) => {
                setRejectionDetail({ ...rejectionDetail, wasteReason: e.target.value as WasteReason });
              }}
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

export default RejectionDetailEdit;
