import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import { useLocation } from 'react-router-dom';
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
import { Product, DeliveryDetail, deliveryPath, deliveryDetailPath } from './types';

const db = getFirestore();
type Item = DeliveryDetail & { removed?: boolean };

const DeliveryMain: React.FC = () => {
  const [target, setTarget] = useState<{ shopCode: string; date: Date }>({
    shopCode: '',
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
  const [shopOptions, setShopsOptions] = useState<{ label: string; value: string }[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const { registListner, shops, currentShop } = useAppContext();
  const quantityRef = useRef<HTMLInputElement>(null);
  const params = useLocation().search;

  useEffect(() => {
    registListner('shops');
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(params);
    const dateText = query.get('date');
    const dstShopCode = query.get('dstShopCode');
    if (dateText && dstShopCode && currentShop) {
      const date = new Date(dateText);
      setTarget({ date, shopCode: dstShopCode });
      loadDeliveryDetails(currentShop.code, dstShopCode, date);
    }
  }, [currentShop, params]);

  useEffect(() => {
    setMessages([]);
    if (!target.shopCode) setMessages((prev) => [...prev, '送り先を指定してください。']);
  }, [target.shopCode]);

  useEffect(() => {
    if (shops) {
      const options = Object.entries(shops).map(([code, shop]) => ({
        value: code,
        label: nameWithCode(shop),
      }));
      options.unshift({ label: '', value: '' });
      setShopsOptions(options);
    }
  }, [shops]);

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

  const loadDeliveryDetails = async (shopCode: string, dstShopCode: string, date: Date) => {
    if (shopCode && shopCode && date) {
      const path = deliveryPath({ shopCode, dstShopCode, date }) + '/deliveryDetails';
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
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  const loadProduct = async (e: React.KeyboardEvent) => {
    if (currentItem.productCode && e.key === 'Enter') {
      e.preventDefault();
      setErrors([]);
      if (currentShop) {
        if (!target.date) setErrors((prev) => [...prev, '日付を指定してください。']);
        if (!target.shopCode) setErrors((prev) => [...prev, '送り先を指定してください。']);
        const snap = (await getDoc(doc(db, 'products', currentItem.productCode))) as DocumentSnapshot<Product>;
        const product = snap.data();
        if (product) {
          setCurrentItem((prev) => ({ ...prev, costPrice: product.costPrice }));
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
    if (currentShop && target.date && target.shopCode) {
      try {
        const batch = writeBatch(db);
        // deliverys
        const shopName = shops && shops[target.shopCode] ? shops[target.shopCode].name : '';
        const ref = doc(
          db,
          deliveryPath({ shopCode: currentShop.code, date: target.date, dstShopCode: target.shopCode })
        );
        batch.set(ref, {
          shopCode: currentShop.code,
          dstShopCode: target.shopCode,
          dstShopName: shopName,
          date: target.date,
        });
        // deliveryDetails
        items
          .filter((item) => item.removed)
          .forEach((item) => {
            const ref2 = doc(
              db,
              deliveryDetailPath({
                shopCode: currentShop.code,
                date: target.date,
                dstShopCode: target.shopCode,
                productCode: item.productCode,
              })
            );
            batch.delete(ref2);
          });
        items
          .filter((item) => !item.removed)
          .forEach((item) => {
            const ref2 = doc(
              db,
              deliveryDetailPath({
                shopCode: currentShop.code,
                date: target.date,
                dstShopCode: target.shopCode,
                productCode: item.productCode,
              })
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
        <h1 className="text-xl font-bold mb-2">出庫処理</h1>
        <Card className="p-5 overflow-visible">
          <Form className="flex space-x-2 mb-2" onSubmit={save}>
            <Form.Date
              value={toDateString(target.date, 'YYYY-MM-DD')}
              onChange={(e) => {
                const date = new Date(e.target.value);
                setTarget((prev) => ({ ...prev, date }));
                if (currentShop && e.target.value) {
                  loadDeliveryDetails(currentShop.code, target.shopCode, date);
                }
              }}
            />
            <Select
              value={selectValue(target.shopCode, shopOptions)}
              options={shopOptions}
              onChange={(e) => {
                setTarget((prev) => ({ ...prev, shopCode: String(e?.value) }));
                if (currentShop && e?.value) {
                  loadDeliveryDetails(currentShop.code, String(e?.value), target.date);
                }
              }}
              className="mb-3 sm:mb-0 w-72"
            />
            <Button className="w-48">登録</Button>
          </Form>
          {messages.length > 0 && (
            <Alert severity="error" onClose={() => setMessages([])}>
              {messages.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </Alert>
          )}
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

export default DeliveryMain;
