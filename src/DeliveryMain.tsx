import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import {
  getFirestore,
  doc,
  DocumentSnapshot,
  getDoc,
  collection,
  getDocs,
  Timestamp,
  runTransaction,
  QuerySnapshot,
  serverTimestamp,
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
const MIN_SUM_COST_PRICE = 5000;

type Props = {
  shopCode: string;
  shopName?: string;
  deliveryNumber?: number;
};

const DeliveryMain: React.FC<Props> = ({ shopCode, shopName, deliveryNumber = -1 }) => {
  const [currentItem, setCurrentItem] = useState<{
    productCode: string;
    quantity: number | null;
  }>({
    productCode: '',
    quantity: null,
  });
  const [items, setItems] = useState<Map<string, Item>>(new Map());
  const [delivery, setDelivery] = useState<Delivery>({
    shopCode,
    deliveryNumber: deliveryNumber ?? -1,
    shopName: shopName ?? '',
    dstShopCode: '',
    dstShopName: '',
    date: Timestamp.fromDate(new Date()),
    fixed: false,
  });
  const [shopOptions, setShopsOptions] = useState<{ label: string; value: string }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [targetProductCode, setTargetProductCode] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [reEdit, setReEdit] = useState<boolean>(false);
  const { registListner, incrementStock, shops, currentShop } = useAppContext();
  const codeRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const dstShop = shops?.get(delivery.dstShopCode);

  useEffect(() => {
    registListner('shops');
  }, []);

  useEffect(() => {
    if (shopCode && deliveryNumber > 0) {
      loadDeliveryDetails(shopCode, +deliveryNumber);
    }
  }, [shopCode, deliveryNumber]);

  useEffect(() => {
    setErrors([]);
    if (!delivery.dstShopCode) setErrors((prev) => [...prev, '???????????????????????????????????????']);
  }, [delivery.dstShopCode]);

  useEffect(() => {
    const options = Array.from(shops.entries())
      .filter(([code, _]) => code !== currentShop?.code)
      .map(([code, shop]) => ({
        value: code,
        label: nameWithCode(shop),
      }));
    options.unshift({ label: '', value: '' });
    setShopsOptions(options);
    setDelivery((prev) => {
      const shopName = shops.get(prev.shopCode)?.name ?? '';
      return { ...prev, shopName };
    });
  }, [shops, currentShop]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const resetCurrentItem = () => {
    setCurrentItem({
      productCode: '',
      quantity: null,
    });
  };

  const loadDeliveryDetails = async (shopCode: string, deliveryNumber: number) => {
    if (shopCode && deliveryNumber > 0) {
      try {
        const delivPath = deliveryPath(shopCode, deliveryNumber);
        const snap = (await getDoc(doc(db, delivPath))) as DocumentSnapshot<Delivery>;
        const deliv = snap.data();
        if (deliv) {
          setDelivery(deliv);
          const detailPath = deliveryDetailPath(shopCode, deliveryNumber);
          const qSnap = (await getDocs(collection(db, detailPath))) as QuerySnapshot<Item>;
          const newItems = new Map<string, Item>();
          qSnap.docs.forEach((docSnap) => {
            newItems.set(docSnap.id, docSnap.data());
          });
          setItems(newItems);
        }
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
        codeRef.current?.focus();
      }
    }
  };

  const removeItem = (productCode: string) => async (e: React.FormEvent) => {
    const newItems = new Map(items);
    const item = newItems.get(productCode);
    if (item) {
      newItems.set(productCode, { ...item, removed: true, quantity: 0, fixed: false });
      setItems(newItems);
    }
  };

  const loadProduct = async (e: React.KeyboardEvent) => {
    if (currentItem.productCode && e.key === 'Enter') {
      e.preventDefault();
      setErrors([]);
      if (shopCode) {
        if (!delivery.date) setErrors((prev) => [...prev, '????????????????????????????????????']);
        if (!delivery.dstShopCode) setErrors((prev) => [...prev, '???????????????????????????????????????']);

        const snap = (await getDoc(doc(db, 'products', currentItem.productCode))) as DocumentSnapshot<Product>;
        const product = snap.data();
        if (product) {
          setCurrentItem((prev) => ({ ...prev, costPrice: product.avgCostPrice ?? product.costPrice }));
          quantityRef.current?.focus();
        } else {
          setErrors((prev) => [...prev, '?????????????????????????????????']);
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const save = async (fixed: boolean) => {
    if (shops) {
      try {
        fixed = fixed || delivery.fixed; // ?????????????????????????????????
        if (sumItemCostPrice() < MIN_SUM_COST_PRICE)
          throw Error(`?????????${MIN_SUM_COST_PRICE}?????????????????????????????????????????????`);

        setProcessing(true);
        const deliv = { ...delivery, fixed };
        await runTransaction(db, async (transaction) => {
          // get existing Data
          const details = new Map<string, DeliveryDetail>();
          const notFoundStockCodes = new Set<string>();
          const productCodes = Array.from(items.keys());
          if (deliv.deliveryNumber > 0) {
            // ????????????????????????????????????
            for await (const productCode of productCodes) {
              const ref2 = doc(db, deliveryDetailPath(deliv.shopCode, deliv.deliveryNumber, productCode));
              const snap = (await transaction.get(ref2)) as DocumentSnapshot<DeliveryDetail>;
              if (snap.exists()) {
                details.set(productCode, snap.data());
              }
            }
          }
          // ????????????????????????????????????
          for await (const productCode of productCodes) {
            const stockRef = doc(db, 'shops', deliv.shopCode, 'stocks', productCode);
            const stockSnap = (await transaction.get(stockRef)) as DocumentSnapshot<Stock>;
            if (!stockSnap.exists()) {
              notFoundStockCodes.add(productCode);
            }
          }

          // deliverys
          if (deliv.deliveryNumber <= 0) {
            const functions = getFunctions(app, 'asia-northeast1');
            // deliveries ??? purchases ?????????????????????ID??????????????????
            const result = await httpsCallable(functions, 'getSequence')({ docId: 'purchases' });
            if (Number(result.data) > 0) {
              deliv.deliveryNumber = Number(result.data);
              setDelivery(deliv);
            } else {
              throw Error('????????????????????????');
            }
          }
          const total = getTotal();
          const ref = doc(db, deliveryPath(deliv.shopCode, deliv.deliveryNumber));
          transaction.set(ref, { ...deliv, ...total, updatedAt: serverTimestamp() });

          // ????????????????????? => fix????????????????????????????????????
          const unfixedItems = getUnfixedItems();
          for (const item of unfixedItems) {
            const detail = details.get(item.productCode);
            const ref2 = doc(db, deliveryDetailPath(deliv.shopCode, deliv.deliveryNumber, item.productCode));
            // ?????????????????????
            const history = detail?.history ?? [];
            if (fixed && detail && item.quantity !== detail.quantity) history.push(detail.quantity);
            transaction.set(ref2, {
              productCode: item.productCode,
              productName: item.productName,
              quantity: item.quantity,
              costPrice: item.costPrice,
              fixed,
              history,
            });
            if (fixed) {
              // ????????????
              const diff = detail?.fixed ? detail.quantity - item.quantity : -item.quantity;
              incrementStock(deliv.shopCode, item.productCode, item.productName, diff, transaction);
            } else {
              if (detail?.fixed) new Error(`???????????????????????????????????????????????????????????????????????????${item.productName}`);
            }
          }
        });
        loadDeliveryDetails(deliv.shopCode, deliv.deliveryNumber);
        setProcessing(false);
        alert('?????????????????????');
      } catch (error) {
        setProcessing(false);
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const getTargetItems = () => {
    return Array.from(items.values()).filter((item) => !item.removed);
  };

  const getUnfixedItems = () => {
    return Array.from(items.values()).filter((item) => !item.fixed);
  };

  const existUnfixedItems = () => {
    return Array.from(items.values()).some((item) => !item.fixed);
  };

  const sumItemQuantity = () => {
    return getTargetItems().reduce((acc, item) => acc + item.quantity, 0);
  };

  const sumItemCostPrice = () => {
    return getTargetItems().reduce((acc, item) => acc + item.quantity * Number(item.costPrice), 0);
  };

  const getTotal = () => {
    const details = getTargetItems();
    return {
      totalVariety: details.filter((detail) => detail.quantity !== 0).length,
      totalQuantity: details.reduce((acc, item) => acc + item.quantity, 0),
      totalAmount: details.reduce((acc, item) => acc + item.quantity * Number(item.costPrice), 0),
    };
  };

  const total = getTotal();

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">????????????</h1>
        {targetProductCode && (
          <DeliveryDetailEdit
            open
            value={items.get(targetProductCode)}
            onClose={() => setTargetProductCode('')}
            onUpdate={(detail: DeliveryDetail) => {
              const item = items.get(targetProductCode);
              const diff = !item || item.quantity !== detail.quantity || item.costPrice !== detail.costPrice;
              if (diff) {
                const newItems = new Map(items);
                newItems.set(targetProductCode, { ...detail, fixed: false });
                setItems(newItems);
              }
            }}
          />
        )}
        <Card className="p-5 overflow-visible">
          <div className="flex space-x-2 mb-2">
            <Form.Date
              value={toDateString(delivery.date.toDate(), 'YYYY-MM-DD')}
              onChange={(e) => {
                const date = new Date(e.target.value);
                setDelivery((prev) => ({ ...prev, date: Timestamp.fromDate(date) }));
              }}
            />
            <Select
              value={selectValue(delivery.dstShopCode, shopOptions)}
              options={shopOptions}
              onChange={(e) => {
                const dstShopCode = String(e?.value);
                if (shops) {
                  const shopName = shops.get(dstShopCode)?.name ?? '';
                  setDelivery((prev) => ({ ...prev, dstShopCode, dstShopName: shopName }));
                }
                codeRef.current?.focus();
              }}
              className="mb-3 sm:mb-0 w-72"
            />
          </div>
          {errors.length > 0 && (
            <Alert severity="error" onClose={() => setErrors([])}>
              {errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </Alert>
          )}
          <hr className="m-4" />
          <Flex justify_content="between">
            <Form className="flex space-x-2 mb-2" onSubmit={handleSubmit}>
              {(!delivery.fixed || reEdit) && (
                <>
                  <Form.Text
                    value={currentItem.productCode}
                    onChange={(e) => setCurrentItem((prev) => ({ ...prev, productCode: String(e.target.value) }))}
                    onKeyPress={loadProduct}
                    placeholder="???????????????"
                    innerRef={codeRef}
                  />
                  <Form.Number
                    value={String(currentItem.quantity)}
                    placeholder="??????"
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
                  <Button onClick={addItem}>??????</Button>
                </>
              )}
            </Form>
            <div className="space-x-2">
              {!delivery.fixed && (
                <Button
                  className="w-32"
                  disabled={!delivery.dstShopCode || sumItemQuantity() === 0 || delivery?.fixed || processing}
                  onClick={() => save(false)}
                >
                  ??????
                </Button>
              )}
              {(!delivery.fixed || reEdit) && (
                <Button
                  className="w-32"
                  disabled={
                    !delivery.dstShopCode ||
                    !existUnfixedItems() ||
                    sumItemCostPrice() < MIN_SUM_COST_PRICE ||
                    processing
                  }
                  onClick={() => {
                    if (window.confirm('?????????????????????')) {
                      save(true);
                    }
                  }}
                >
                  ??????
                </Button>
              )}
              {delivery.fixed && !reEdit && (
                <Button className="w-32" onClick={() => setReEdit(true)}>
                  ?????????
                </Button>
              )}
            </div>
          </Flex>
          <Flex justify_content="between" className="my-2">
            <Flex>
              <div className="bold px-2">
                ?????????&nbsp;
                <span className="text-2xl">{total.totalVariety}</span>
              </div>
              <div className="bold px-2">
                ?????????&nbsp;
                <span className="text-2xl">{total.totalQuantity}</span>
              </div>
              <div className="bold px-2">
                ??????(??????)&nbsp;
                <span className="text-2xl">{total.totalAmount.toLocaleString()}</span>???
              </div>
            </Flex>
            <div>
              <span className="text-xl">{shops && dstShop && nameWithCode(dstShop)}</span>
              ??????
            </div>
          </Flex>
          <Table className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell type="th">No</Table.Cell>
                <Table.Cell type="th">???????????????</Table.Cell>
                <Table.Cell type="th">?????????</Table.Cell>
                <Table.Cell type="th">??????</Table.Cell>
                <Table.Cell type="th">
                  <small>????????????(??????)</small>
                </Table.Cell>
                <Table.Cell type="th">??????</Table.Cell>
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
                  <Table.Cell>{item.costPrice?.toLocaleString()}</Table.Cell>
                  <Table.Cell>
                    {item.history && item.history.length > 0 && [...item.history, item.quantity].join('???')}
                  </Table.Cell>
                  <Table.Cell>
                    {(!delivery.fixed || reEdit) && (
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
