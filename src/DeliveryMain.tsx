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
  serverTimestamp,
  runTransaction,
  QuerySnapshot,
  increment,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import { useAppContext } from './AppContext';
import { nameWithCode, toDateString } from './tools';
import app from './firebase';
import firebaseError from './firebaseError';
import { Product, Delivery, DeliveryDetail, deliveryPath, deliveryDetailPath, Stock } from './types';
import DeliveryDetailEdit from './DeliveryDetailEdit';

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
  const [items, setItems] = useState<Map<string, Item>>(new Map());
  const [delivery, setDelivery] = useState<Delivery | undefined>(undefined);
  const [shopOptions, setShopsOptions] = useState<{ label: string; value: string }[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [targetProductCode, setTargetProductCode] = useState<string>('');
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
        const newItems = new Map<string, Item>();
        qSnap.docs.forEach((docSnap) => {
          newItems.set(docSnap.id, docSnap.data());
        });
        setItems(newItems);
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const addItem = async () => {
    if (currentItem.productCode && currentItem.quantity) {
      const ref = doc(db, 'products', currentItem.productCode);
      const snap = (await getDoc(ref)) as DocumentSnapshot<Product>;
      const product = snap.data();
      if (product) {
        const newItems = new Map(items);
        const item = newItems.get(currentItem.productCode);
        if (item) {
          const quantity = item.removed ? currentItem.quantity : item.quantity + currentItem.quantity;
          newItems.set(currentItem.productCode, {
            ...item,
            removed: false,
            fixed: false,
            quantity,
          });
        } else {
          newItems.set(currentItem.productCode, {
            productCode: currentItem.productCode,
            productName: product.name,
            quantity: currentItem.quantity,
            costPrice: product.costPrice,
            fixed: false,
          });
        }
        setItems(newItems);
        resetCurrentItem();
        quantityRef.current?.focus();
      }
    }
  };

  const removeItem = (productCode: string) => async (e: React.FormEvent) => {
    const newItems = new Map(items);
    const item = newItems.get(productCode);
    if (item) {
      newItems.set(productCode, { ...item, removed: true });
      setItems(newItems);
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

  const save = async (fixed: boolean) => {
    if (delivery && shops) {
      try {
        await runTransaction(db, async (transaction) => {
          const date = delivery.date.toDate();
          // get existing Data
          const details = new Map<string, DeliveryDetail>();
          const notFoundStockCodes = new Set<string>();
          const productCodes = Array.from(items.keys());
          for await (const productCode of productCodes) {
            const ref2 = doc(
              db,
              deliveryDetailPath({
                shopCode: delivery.shopCode,
                date,
                dstShopCode: delivery.dstShopCode,
                productCode,
              })
            );
            const snap = (await transaction.get(ref2)) as DocumentSnapshot<DeliveryDetail>;
            if (snap.exists()) {
              details.set(productCode, snap.data());
            }
            const stockRef = doc(db, 'shops', delivery.shopCode, 'stocks', productCode);
            const stockSnap = (await transaction.get(stockRef)) as DocumentSnapshot<Stock>;
            if (!stockSnap.exists()) {
              notFoundStockCodes.add(productCode);
            }
          }

          // deliverys
          const ref = doc(db, deliveryPath({ ...delivery, date }));
          const deliv = { ...delivery, fixed };
          if (deliv.deliveryNumber < 0) {
            const functions = getFunctions(app, 'asia-northeast1');
            const result = await httpsCallable(functions, 'getSequence')({ docId: 'deliveries' });
            deliv.deliveryNumber = Number(result.data);
          }
          transaction.set(ref, deliv);
          // remove DeliveryDetail
          const removedItems = getRemovedItems();

          removedItems.forEach((item) => {
            const ref2 = doc(
              db,
              deliveryDetailPath({
                shopCode: delivery.shopCode,
                date,
                dstShopCode: delivery.dstShopCode,
                productCode: item.productCode,
              })
            );
            const detail = details.get(item.productCode);
            if (detail?.fixed) throw new Error(`確定済データは削除できません。${item.productName}`);
            transaction.delete(ref2);
          });
          // fixしていないデータのみ保存
          const unfixedItems = getUnfixedItems();
          for await (const item of unfixedItems) {
            const detail = details.get(item.productCode);
            const ref2 = doc(
              db,
              deliveryDetailPath({
                shopCode: delivery.shopCode,
                date,
                dstShopCode: delivery.dstShopCode,
                productCode: item.productCode,
              })
            );
            if (item.quantity === 0) {
              transaction.delete(ref2);
            } else {
              transaction.set(ref2, {
                productCode: item.productCode,
                productName: item.productName,
                quantity: item.quantity,
                costPrice: item.costPrice,
                fixed,
              });
            }
            if (fixed) {
              const diff = detail?.fixed ? detail?.quantity - item.quantity : -item.quantity;
              const stockRef = doc(db, 'shops', delivery.shopCode, 'stocks', item.productCode);
              if (notFoundStockCodes.has(item.productCode)) {
                transaction.set(stockRef, {
                  shopCode: delivery.shopCode,
                  productCode: item.productCode,
                  productName: item.productName,
                  quantity: diff,
                  updatedAt: serverTimestamp(),
                });
              } else {
                transaction.update(stockRef, {
                  shopCode: delivery.shopCode,
                  productCode: item.productCode,
                  productName: item.productName,
                  quantity: increment(diff),
                  updatedAt: serverTimestamp(),
                });
              }
            } else {
              if (detail?.fixed) new Error(`確定済データを一時保存状態に戻すことはできません。${item.productName}`);
            }
          }
        });
        loadDeliveryDetails(delivery.shopCode, delivery.dstShopCode, target.date);
        alert('保存しました。');
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const existUnfixedItems = () => {
    return Array.from(items.values()).some((item) => !item.removed && !item.fixed);
  };

  const getUnfixedItems = () => {
    return Array.from(items.values()).filter((item) => !item.removed && !item.fixed);
  };

  const getTargetItems = () => {
    return Array.from(items.values()).filter((item) => !item.removed);
  };

  const sumItemQuantity = () => {
    return getTargetItems().reduce((acc, item) => acc + item.quantity, 0);
  };

  const sumItemCostPrice = () => {
    return getTargetItems().reduce((acc, item) => acc + item.quantity * Number(item.costPrice), 0);
  };

  const getRemovedItems = () => {
    return Array.from(items.values()).filter((item) => item.removed);
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">出庫処理</h1>
        {targetProductCode && (
          <DeliveryDetailEdit
            open
            value={items.get(targetProductCode)}
            onClose={() => setTargetProductCode('')}
            onUpdate={(deliveryDetail: DeliveryDetail) => {
              const newItems = new Map(items);
              const item = newItems.get(currentItem.productCode);
              newItems.set(targetProductCode, deliveryDetail);
              setItems(newItems);
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
              <Button className="w-32" disabled={delivery?.fixed} onClick={() => save(false)}>
                保留
              </Button>
              <Button
                className="w-32"
                disabled={!existUnfixedItems()}
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
          <Flex justify_content="between" className="my-2">
            <Flex>
              <div className="bold px-2">
                商品種&nbsp;
                <span className="text-2xl">{items.size}</span>
              </div>
              <div className="bold px-2">
                商品数&nbsp;
                <span className="text-2xl">{sumItemQuantity()}</span>
              </div>
              <div className="bold px-2">
                金額&nbsp;
                <span className="text-2xl">{sumItemCostPrice().toLocaleString()}</span>円
              </div>
            </Flex>
            <div>
              <span className="text-xl">{shops && target.dstShopCode && nameWithCode(shops[target.dstShopCode])}</span>
              行き
            </div>
          </Flex>
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
              {getTargetItems().map((item, i) => (
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
                          onClick={() => setTargetProductCode(item.productCode)}
                        >
                          <Icon name="pencil-alt" />
                        </Button>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={removeItem(item.productCode)}
                        >
                          <Icon name="trash" />
                        </Button>
                      </>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default DeliveryMain;
