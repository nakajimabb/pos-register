import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import { useLocation } from 'react-router-dom';
import {
  getFirestore,
  doc,
  DocumentSnapshot,
  getDoc,
  collection,
  getDocs,
  Timestamp,
  writeBatch,
  QuerySnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import { useAppContext } from './AppContext';
import { nameWithCode, toDateString } from './tools';
import app from './firebase';
import firebaseError from './firebaseError';
import { Product, Delivery, DeliveryDetail, deliveryPath, deliveryDetailPath } from './types';
import DeliveryEdit from './DeliveryEdit';

const db = getFirestore();
type Item = DeliveryDetail & { removed?: boolean };

const DeliveryMain: React.FC = () => {
  const [target, setTarget] = useState<{ date: Date; dstShopCode: string }>({
    date: new Date(),
    dstShopCode: '',
  });
  const [currentItem, setCurrentItem] = useState<{
    productCode: string;
    quantity: number | null;
  }>({
    productCode: '',
    quantity: null,
  });
  const [items, setItems] = useState<Item[]>([]);
  const [delivery, setDelivery] = useState<Delivery | undefined>(undefined);
  const [shopOptions, setShopsOptions] = useState<{ label: string; value: string }[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [editTarget, setEditTarget] = useState<number>(-1);
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
      setTarget({ date, dstShopCode });
      loadDeliveryDetails(currentShop.code, dstShopCode, date);
    }
  }, [currentShop, params]);

  useEffect(() => {
    setMessages([]);
    if (!target.dstShopCode) setMessages((prev) => [...prev, '送り先を指定してください。']);
  }, [target.dstShopCode]);

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
    });
  };

  const loadDeliveryDetails = async (shopCode: string, dstShopCode: string, date: Date) => {
    if (shopCode && dstShopCode && date && shops) {
      try {
        const dPath = deliveryPath({ shopCode, dstShopCode, date });
        const snap = (await getDoc(doc(db, dPath))) as DocumentSnapshot<Delivery>;
        const deliv = snap.data();
        setDelivery({
          deliveryNumber: deliv?.deliveryNumber ?? -1,
          shopCode,
          shopName: deliv?.shopName ?? shops[shopCode].name,
          dstShopCode,
          dstShopName: deliv?.dstShopName ?? shops[dstShopCode].name,
          date: Timestamp.fromDate(date),
          fixed: !!deliv?.fixed,
        });

        const detailPath = dPath + '/deliveryDetails';
        const qSnap = (await getDocs(collection(db, detailPath))) as QuerySnapshot<Item>;
        setItems(qSnap.docs.map((docSnap) => docSnap.data()));
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const addItem = async () => {
    console.log({ currentItem });
    if (currentItem.productCode && currentItem.quantity) {
      const ref = doc(db, 'products', currentItem.productCode);
      const snap = (await getDoc(ref)) as DocumentSnapshot<Product>;
      const product = snap.data();
      if (product) {
        const index = items.findIndex((item) => !item.removed && item.productCode === currentItem.productCode);
        if (index >= 0) {
          const newItems = [...items];
          newItems[index].quantity += +currentItem.quantity;
          newItems[index].fixed = false;
          setItems(newItems);
          resetCurrentItem();
        } else {
          setItems((prev) => [
            ...prev,
            {
              productCode: currentItem.productCode,
              productName: product.name,
              quantity: Number(currentItem.quantity),
              costPrice: Number(product.costPrice),
              fixed: false,
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
        if (!target.dstShopCode) setErrors((prev) => [...prev, '送り先を指定してください。']);
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

  const getTargetItem = () => {
    if (0 <= editTarget && editTarget < items.length) {
      return items[editTarget];
    }
  };

  const save = async (fixed: boolean) => {
    if (currentShop && target.date && target.dstShopCode && delivery) {
      try {
        const batch = writeBatch(db);
        // deliverys
        const shopName = shops && shops[target.dstShopCode] ? shops[target.dstShopCode].name : '';
        const ref = doc(
          db,
          deliveryPath({ shopCode: currentShop.code, date: target.date, dstShopCode: target.dstShopCode })
        );
        const deliv = { ...delivery, fixed };
        if (deliv.deliveryNumber < 0) {
          const functions = getFunctions(app, 'asia-northeast1');
          const result = await httpsCallable(functions, 'getSequence')({ docId: 'deliveries' });
          deliv.deliveryNumber = Number(result.data);
        }
        batch.set(ref, deliv);
        items
          .filter((item) => item.removed)
          .forEach((item) => {
            const ref2 = doc(
              db,
              deliveryDetailPath({
                shopCode: currentShop.code,
                date: target.date,
                dstShopCode: target.dstShopCode,
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
                dstShopCode: target.dstShopCode,
                productCode: item.productCode,
              })
            );
            batch.set(ref2, {
              productCode: item.productCode,
              productName: item.productName,
              quantity: item.quantity,
              costPrice: item.costPrice,
              fixed,
            });
          });
        batch.commit();
        loadDeliveryDetails(currentShop.code, target.dstShopCode, target.date);
        alert('保存しました。');
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const existUnfixed = () => {
    return items.filter((item) => !item.removed && !item.fixed).length > 0;
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">出庫処理</h1>
        {editTarget >= 0 && (
          <DeliveryEdit
            open
            value={getTargetItem()}
            onClose={() => setEditTarget(-1)}
            onUpdate={(deliveryDetail: DeliveryDetail) => {
              if (0 <= editTarget && editTarget < items.length) {
                items[editTarget] = deliveryDetail;
                setItems([...items]);
              }
            }}
          />
        )}
        <Card className="p-5 overflow-visible">
          <div className="flex space-x-2 mb-2">
            <Form.Date
              value={toDateString(target.date, 'YYYY-MM-DD')}
              onChange={(e) => {
                const date = new Date(e.target.value);
                setTarget((prev) => ({ ...prev, date }));
                if (currentShop && e.target.value) {
                  loadDeliveryDetails(currentShop.code, target.dstShopCode, date);
                }
              }}
            />
            <Select
              value={selectValue(target.dstShopCode, shopOptions)}
              options={shopOptions}
              onChange={(e) => {
                const dstShopCode = String(e?.value);
                setTarget((prev) => ({ ...prev, dstShopCode }));
                if (currentShop && e?.value) {
                  loadDeliveryDetails(currentShop.code, String(e?.value), target.date);
                }
              }}
              className="mb-3 sm:mb-0 w-72"
            />
          </div>
          {messages.length > 0 && (
            <Alert severity="error" onClose={() => setMessages([])}>
              {messages.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </Alert>
          )}
          <hr className="m-4" />
          <Flex justify_content="between">
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
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                  }
                }}
                className="w-36"
              />
              <Button onClick={addItem}>追加</Button>
            </Form>
            <div className="space-x-2">
              <Button className="w-32" disabled={!existUnfixed()} onClick={() => save(false)}>
                保留
              </Button>
              <Button
                className="w-32"
                disabled={!existUnfixed()}
                onClick={() => {
                  if (window.confirm('確定しますか？')) {
                    save(true);
                  }
                }}
              >
                確定
              </Button>
            </div>
          </Flex>
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
                        {!item.fixed && (
                          <>
                            <Button
                              variant="icon"
                              size="xs"
                              color="none"
                              className="hover:bg-gray-300"
                              onClick={() => setEditTarget(i)}
                            >
                              <Icon name="pencil-alt" />
                            </Button>
                            <Button
                              variant="icon"
                              size="xs"
                              color="none"
                              className="hover:bg-gray-300"
                              onClick={removeItem(i)}
                            >
                              <Icon name="trash" />
                            </Button>
                          </>
                        )}
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
