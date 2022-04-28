import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import Select from 'react-select';
import {
  doc,
  collection,
  DocumentSnapshot,
  getDoc,
  getDocs,
  getFirestore,
  query,
  QuerySnapshot,
  runTransaction,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useReactToPrint } from 'react-to-print';
import clsx from 'clsx';
import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import { useAppContext } from './AppContext';
import app from './firebase';
import InternalOrderDetailEdit from './InternalOrderDetailEdit';
import { toDateString, checkDigit, nameWithCode } from './tools';
import firebaseError from './firebaseError';
import { InternalOrderDetail, internalOrderPath, internalOrderDetailPath, InternalOrder, Stock } from './types';
import './App.css';

const db = getFirestore();
type Item = InternalOrderDetail & { removed?: boolean };

type Props = {
  shopCode: string;
  shopName?: string;
  internalOrderNumber?: number;
};

const InternalOrderMain: React.FC<Props> = ({ shopCode, shopName, internalOrderNumber = -1 }) => {
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string }[]>([]);
  const [inputProductCode, setInputProductCode] = useState<string>('');
  const [inputInternalOrderDetail, setInputInternalOrderDetail] = useState<InternalOrderDetail | undefined>(undefined);
  const [internalOrder, setInternalOrder] = useState<InternalOrder>({
    internalOrderNumber,
    date: Timestamp.fromDate(new Date()),
    shopCode,
    shopName: shopName ?? '',
    srcShopCode: '',
    srcShopName: '',
    fixed: false,
  });
  const [items, setItems] = useState<Map<string, Item>>(new Map());
  const [errors, setErrors] = useState<string[]>([]);
  const [processing, setProcessing] = useState<boolean>(false);
  const { shops, registListner, getProductPrice, currentShop } = useAppContext();
  const codeRef = useRef<HTMLInputElement>(null);
  const hisotry = useHistory();
  const componentRef = useRef(null);
  const pageStyle = `
    @media print {
      @page { size: JIS-B5 portrait; margin: 0; }
    }  
  `;

  useEffect(() => {
    registListner('shops');
  }, []);

  useEffect(() => {
    const options = Array.from(shops.entries())
      .filter(([code, shop]) => code !== currentShop?.code && !shop.hidden && shop.orderable)
      .map(([code, shop]) => ({
        value: code,
        label: nameWithCode(shop),
      }));
    options.unshift({ label: '', value: '' });
    setShopOptions(options);
  }, [shops, currentShop]);

  useEffect(() => {
    setErrors([]);
    if (!internalOrder.srcShopCode) setErrors((prev) => [...prev, '発注先店舗を指定してください。']);
  }, [internalOrder.srcShopCode]);

  useEffect(() => {
    if (shopCode && internalOrderNumber > 0) {
      loadInternalOrderDetails(shopCode, internalOrderNumber);
    }
  }, [shopCode, internalOrderNumber]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const resetInternalOrder = () => {
    setInputProductCode('');
    setInternalOrder({
      internalOrderNumber: -1,
      date: Timestamp.fromDate(new Date()),
      shopCode,
      shopName: shopName ?? '',
      srcShopCode: '',
      srcShopName: '',
      fixed: false,
    });
    setItems(new Map());
  };

  const loadInternalOrderDetails = async (shopCode: string, internalOrderNumber: number) => {
    if (shopCode && internalOrderNumber > 0) {
      try {
        const orderPath = internalOrderPath(shopCode, internalOrderNumber);
        const snap = (await getDoc(doc(db, orderPath))) as DocumentSnapshot<InternalOrder>;
        const order = snap.data();
        if (order) {
          setInternalOrder(order);
          const detailPath = internalOrderDetailPath(shopCode, internalOrderNumber);
          const qSnap = (await getDocs(
            query(collection(db, detailPath), orderBy('productCode'))
          )) as QuerySnapshot<Item>;
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

  const changeTargetItem = async (productCode: string) => {
    if (productCode) {
      const price = await getProductPrice(shopCode, productCode, ['finalCostPrice', 'product']);
      if (price) {
        const item = items.get(productCode);
        if (item) {
          setInputInternalOrderDetail(item);
        } else {
          setInputInternalOrderDetail({
            productCode: productCode,
            productName: price.product?.name ?? '',
            quantity: 0,
            costPrice: price.finalCostPrice ?? null,
          });
        }
        codeRef.current?.focus();
      } else {
        if (checkDigit(productCode)) {
          setErrors((prev) => [...prev, '商品マスタが存在しません。']);
        } else {
          setErrors((prev) => [...prev, '不正なPLUコードです。']);
        }
      }
    }
  };

  const removeItem = (productCode: string) => async (e: React.FormEvent) => {
    const newItems = new Map(items);
    const item = newItems.get(productCode);
    if (item) {
      newItems.set(productCode, { ...item, removed: true, quantity: 0 });
      setItems(newItems);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const save = async () => {
    try {
      setProcessing(true);
      const order = { ...internalOrder, fixed: true };
      await runTransaction(db, async (transaction) => {
        // get existing Data
        const details = new Map<string, InternalOrderDetail>();
        const notFoundStockCodes = new Set<string>();
        const productCodes = Array.from(items.keys());
        if (order.internalOrderNumber > 0) {
          // 既存詳細データの読み込み
          for await (const productCode of productCodes) {
            const ref2 = doc(db, internalOrderDetailPath(order.shopCode, order.internalOrderNumber, productCode));
            const snap = (await transaction.get(ref2)) as DocumentSnapshot<InternalOrderDetail>;
            if (snap.exists()) {
              details.set(productCode, snap.data());
            }
          }
        }

        // internalOrder
        if (order.internalOrderNumber <= 0) {
          const functions = getFunctions(app, 'asia-northeast1');
          // deliveries と internalOrders のドキュメントIDは同一にする
          const result = await httpsCallable(functions, 'getSequence')({ docId: 'internalOrders' });
          if (Number(result.data) > 0) {
            order.internalOrderNumber = Number(result.data);
            setInternalOrder(order);
          } else {
            throw Error('不正な仕入番号。');
          }
        }

        const total = getTotal();
        const ref = doc(db, internalOrderPath(order.shopCode, order.internalOrderNumber));
        transaction.set(ref, { ...order, ...total, updatedAt: serverTimestamp() });

        // 詳細データ保存 => fixしていないデータのみ保存
        const unfixedItems = getTargetItems();
        for (const item of unfixedItems) {
          const detail = details.get(item.productCode);
          const ref2 = doc(db, internalOrderDetailPath(order.shopCode, order.internalOrderNumber, item.productCode));
          // 詳細データ更新
          const value: InternalOrderDetail = {
            productCode: item.productCode,
            productName: item.productName,
            quantity: item.quantity,
            costPrice: item.costPrice,
          };
          transaction.set(ref2, value);
        }
      });
      setProcessing(false);
      alert('保存しました。');
      if (internalOrderNumber > 0) {
        hisotry.push('/internal_order_new');
      } else {
        resetInternalOrder();
      }
    } catch (error) {
      setProcessing(false);
      console.log({ error });
      alert(firebaseError(error));
    }
  };

  const getTargetItems = () => {
    return Array.from(items.values()).filter((item) => !item.removed);
  };

  const sumItemQuantity = () => {
    return getTargetItems().reduce((acc, item) => acc + item.quantity, 0);
  };

  const getTotal = () => {
    const details = getTargetItems();
    return {
      totalVariety: details.filter((detail) => detail.quantity !== 0).length,
      totalQuantity: details.reduce((acc, item) => acc + item.quantity, 0),
      totalAmount: details.reduce((acc, item) => acc + item.quantity * Number(item.costPrice), 0),
    };
  };

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    pageStyle,
  });

  const total = getTotal();
  const template_cols = '3fr 8fr 3fr 2fr 3fr 6fr 6fr 2fr 2fr';
  const className = 'border-b px-2 py-3';
  const className2 = 'font-bold border-b text-center py-3';

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">社内発注処理</h1>
        {inputInternalOrderDetail && (
          <InternalOrderDetailEdit
            open
            shopCode={shopCode}
            value={inputInternalOrderDetail}
            onClose={() => setInputInternalOrderDetail(undefined)}
            onUpdate={(detail: InternalOrderDetail) => {
              const newItems = new Map(items);
              newItems.set(detail.productCode, { ...detail, removed: false });
              setItems(newItems);
              setInputProductCode('');
            }}
          />
        )}
        <Card className="p-5 overflow-visible">
          <Flex className="space-x-2 mb-2">
            <Form.Date
              value={toDateString(internalOrder.date.toDate(), 'YYYY-MM-DD')}
              disabled={internalOrder.internalOrderNumber > 0}
              onChange={(e) => {
                const date = new Date(e.target.value);
                setInternalOrder((prev) => ({ ...prev, date: Timestamp.fromDate(date) }));
              }}
            />
            <Select
              value={selectValue(internalOrder.srcShopCode, shopOptions)}
              options={shopOptions}
              isDisabled={internalOrder.internalOrderNumber > 0}
              onChange={(e) => {
                const srcShopCode = String(e?.value);
                setInternalOrder((prev) => ({ ...prev, srcShopCode, srcShopName: shops.get(srcShopCode)?.name ?? '' }));
                codeRef.current?.focus();
              }}
              className="mb-3 sm:mb-0 w-72"
            />
          </Flex>
          {errors.length > 0 && (
            <Alert severity="error" onClose={() => setErrors([])}>
              {errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </Alert>
          )}
          <hr className="m-4" />
          <Flex justify_content="between" className="mb-2">
            <Form className="flex space-x-2" onSubmit={handleSubmit}>
              {!internalOrder.fixed && (
                <>
                  <Form.Text
                    value={inputProductCode}
                    onChange={(e) => setInputProductCode(String(e.target.value))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        changeTargetItem(inputProductCode);
                      }
                    }}
                    placeholder="商品コード"
                    innerRef={codeRef}
                  />
                  <Button onClick={() => changeTargetItem(inputProductCode)}>追加</Button>
                </>
              )}
            </Form>
            {!internalOrder.fixed && (
              <Button
                className="w-32"
                disabled={sumItemQuantity() === 0 || processing}
                onClick={() => {
                  if (window.confirm('確定しますか？')) {
                    save();
                  }
                }}
              >
                確定
              </Button>
            )}
            {internalOrder.fixed && (
              <Button className="w-32" onClick={() => setInternalOrder((prev) => ({ ...prev, fixed: false }))}>
                再編集
              </Button>
            )}
          </Flex>
          <Flex justify_content="between" className="my-2">
            <Flex>
              <div className="bold px-2">
                商品種&nbsp;
                <span className="text-2xl">{total.totalVariety}</span>
              </div>
              <div className="bold px-2">
                商品数&nbsp;
                <span className="text-2xl">{total.totalQuantity}</span>
              </div>
              <div className="bold px-2">
                金額(税抜)&nbsp;
                <span className="text-2xl">{total.totalAmount.toLocaleString()}</span>円
              </div>
            </Flex>
          </Flex>
          <Table className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell type="th">No</Table.Cell>
                <Table.Cell type="th">商品コード</Table.Cell>
                <Table.Cell type="th">商品名</Table.Cell>
                <Table.Cell type="th">数量</Table.Cell>
                <Table.Cell type="th">
                  <small>仕入価格(税抜)</small>
                </Table.Cell>
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
                    {true && (
                      <>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          // onClick={() => setTargetProductCode(item.productCode)}
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

export default InternalOrderMain;
