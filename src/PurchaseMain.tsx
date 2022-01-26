import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  DocumentSnapshot,
  writeBatch,
  QuerySnapshot,
} from 'firebase/firestore';
import { Alert, Button, Card, Form, Icon, Table } from './components';
import { useAppContext } from './AppContext';
import { nameWithCode, toDateString } from './tools';
import firebaseError from './firebaseError';
import {
  Product,
  PurchaseDetail,
  purchasePath,
  purchaseDetailPath,
  productCostPricePath,
  ProductCostPrice,
} from './types';

const db = getFirestore();
type Item = PurchaseDetail & { removed?: boolean };

const PurchaseMain: React.FC = () => {
  const [target, setTarget] = useState<{ supplierCode: string; date: Date }>({
    supplierCode: '',
    date: new Date(),
  });
  const [currentItem, setCurrentItem] = useState<{
    productCode: string;
    quantity: number | null;
    costPrice: number | null;
  }>({
    productCode: '',
    quantity: null,
    costPrice: null,
  });
  const [items, setItems] = useState<Item[]>([]);
  const [supplierOptions, setSuppliersOptions] = useState<{ label: string; value: string }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const { registListner, suppliers, currentShop } = useAppContext();
  const quantityRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registListner('suppliers');
  }, []);

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

  const resetCurrentItem = () => {
    setCurrentItem({
      productCode: '',
      quantity: null,
      costPrice: null,
    });
  };

  const loadPurchaseDetails = async (shopCode: string, supplierCode: string, date: Date) => {
    if (shopCode && supplierCode && date) {
      const path = purchasePath({ shopCode, supplierCode, date }) + '/purchaseDetails';
      const snap = (await getDocs(collection(db, path))) as QuerySnapshot<Item>;
      setItems(snap.docs.map((docSnap) => docSnap.data()));
    }
  };

  const addItem = async () => {
    if (currentItem.productCode && currentItem.quantity && currentItem.costPrice) {
      const ref = doc(db, 'products', currentItem.productCode);
      const snap = (await getDoc(ref)) as DocumentSnapshot<Product>;
      const product = snap.data();
      if (product) {
        const index = items.findIndex((item) => !item.removed && item.productCode === currentItem.productCode);
        if (index >= 0) {
          const newItems = [...items];
          newItems[index].quantity += +currentItem.quantity;
          setItems(newItems);
          resetCurrentItem();
        } else {
          setItems((prev) => [
            ...prev,
            {
              productCode: currentItem.productCode,
              productName: product.name,
              quantity: Number(currentItem.quantity),
              costPrice: Number(currentItem.costPrice),
            },
          ]);
          resetCurrentItem();
        }
        quantityRef.current?.focus();
      }
    }
  };

  const removeItem = (i: number) => async (e: React.FormEvent) => {
    const newItems = [...items];
    newItems[i].removed = true;
    setItems(newItems);
  };

  const blockEnter = async (e: React.KeyboardEvent) => {
    if (e.key == 'Enter') {
      e.preventDefault();
    }
  };

  const loadProduct = async (e: React.KeyboardEvent) => {
    if (currentItem.productCode && e.key == 'Enter') {
      e.preventDefault();
      setErrors([]);
      if (currentShop) {
        if (!target.date) setErrors((prev) => [...prev, '日付を指定してください。']);
        if (!target.supplierCode) setErrors((prev) => [...prev, '仕入先を指定してください。']);
        const snap = (await getDoc(
          doc(
            db,
            productCostPricePath({
              shopCode: currentShop.code,
              productCode: currentItem.productCode,
              supplierCode: target.supplierCode,
            })
          )
        )) as DocumentSnapshot<ProductCostPrice>;
        const productCostPrice = snap.data();
        if (productCostPrice) {
          setCurrentItem((prev) => ({ ...prev, costPrice: productCostPrice.costPrice }));
          quantityRef.current?.focus();
        } else {
          const snapProduct = (await getDoc(doc(db, 'products', currentItem.productCode))) as DocumentSnapshot<Product>;
          const product = snapProduct.data();
          if (product) {
            setCurrentItem((prev) => ({ ...prev, costPrice: product.costPrice }));
            quantityRef.current?.focus();
          } else {
            setErrors((prev) => [...prev, '商品が見つかりません。']);
          }
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentShop && target.date && target.supplierCode) {
      try {
        const batch = writeBatch(db);
        // purchases
        const ref = doc(db, purchasePath({ ...target, shopCode: currentShop.code }));
        batch.set(ref, { shopCode: currentShop.code, supplierCode: target.supplierCode, date: target.date });
        // purchaseDetails
        items
          .filter((item) => item.removed)
          .forEach((item) => {
            const ref2 = doc(
              db,
              purchaseDetailPath({ ...target, shopCode: currentShop.code, productCode: item.productCode })
            );
            batch.delete(ref2);
          });
        items
          .filter((item) => !item.removed)
          .forEach((item) => {
            const ref2 = doc(
              db,
              purchaseDetailPath({ ...target, shopCode: currentShop.code, productCode: item.productCode })
            );
            batch.set(ref2, {
              productCode: item.productCode,
              productName: item.productName,
              quantity: item.quantity,
              costPrice: item.costPrice,
            });
          });
        batch.commit();
        alert('保存しました。');
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">仕入処理</h1>
        <Card className="p-5 overflow-visible">
          <Form className="flex space-x-2 mb-2" onSubmit={save}>
            <Form.Date
              value={toDateString(target.date, 'YYYY-MM-DD')}
              onChange={(e) => {
                const date = new Date(e.target.value);
                setTarget((prev) => ({ ...prev, date }));
                if (currentShop && e.target.value) {
                  loadPurchaseDetails(currentShop.code, target.supplierCode, date);
                }
              }}
            />
            <Select
              value={selectValue(target.supplierCode, supplierOptions)}
              options={supplierOptions}
              onChange={(e) => {
                setTarget((prev) => ({ ...prev, supplierCode: String(e?.value) }));
                if (currentShop && e?.value) {
                  loadPurchaseDetails(currentShop.code, String(e?.value), target.date);
                }
              }}
              className="mb-3 sm:mb-0 w-72"
            />
            <Button className="w-48">登録</Button>
          </Form>
          <hr className="m-4" />
          <Form className="flex space-x-2 mb-2" onSubmit={handleSubmit}>
            <Form.Text
              value={currentItem.productCode}
              onChange={(e) => setCurrentItem((prev) => ({ ...prev, productCode: String(e.target.value) }))}
              onKeyPress={loadProduct}
              placeholder="商品コード"
            />
            <Form.Number
              value={String(currentItem.quantity)}
              placeholder="数量"
              innerRef={quantityRef}
              min={1}
              onChange={(e) => setCurrentItem((prev) => ({ ...prev, quantity: +e.target.value }))}
              onKeyPress={blockEnter}
              className="w-36"
            />
            <Form.Number
              value={String(currentItem.costPrice)}
              placeholder="金額"
              onChange={(e) => setCurrentItem((prev) => ({ ...prev, costPrice: +e.target.value }))}
              onKeyPress={blockEnter}
              className="w-36"
            />
            <Button onClick={addItem}>確定</Button>
          </Form>
          {errors.length > 0 && (
            <Alert severity="error" onClose={() => setErrors([])}>
              {errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </Alert>
          )}
          <Table className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell>No</Table.Cell>
                <Table.Cell>商品コード</Table.Cell>
                <Table.Cell>商品名</Table.Cell>
                <Table.Cell>数量</Table.Cell>
                <Table.Cell>仕入価格</Table.Cell>
                <Table.Cell></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {items.map(
                (item, i) =>
                  !item.removed && (
                    <Table.Row key={i}>
                      <Table.Cell>{i + 1}</Table.Cell>
                      <Table.Cell>{item.productCode}</Table.Cell>
                      <Table.Cell>{item.productName}</Table.Cell>
                      <Table.Cell>{item.quantity}</Table.Cell>
                      <Table.Cell>{item.costPrice}</Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={removeItem(i)}
                        >
                          <Icon name="trash" />
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  )
              )}
            </Table.Body>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default PurchaseMain;
