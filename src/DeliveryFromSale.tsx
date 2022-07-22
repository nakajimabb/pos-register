import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  query,
  Query,
  QueryConstraint,
  Timestamp,
  runTransaction,
  collectionGroup,
  where,
  QuerySnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';
import { Alert, Button, Card, Form, Table } from './components';
import { useAppContext } from './AppContext';
import firebaseError from './firebaseError';
import { nameWithCode, toDateString, isNum, OTC_DIVISION } from './tools';
import {
  InternalOrder,
  InternalOrderDetail,
  Sale,
  SaleDetail,
  DeliveryDetail,
  Delivery,
  deliveryPath,
  deliveryDetailPath,
  internalOrderDetailPath,
} from './types';
import DeliveryPrint from './DeliveryPrint';
import InternalOrderPrint from './InternalOrderPrint';

const db = getFirestore();

type InternalOrderItem = InternalOrder & { target?: boolean };

const DeliveryFromSale: React.FC = () => {
  const [search, setSearch] = useState<{ shopCode: string; minDate: Date | null; maxDate: Date | null }>({
    shopCode: '',
    minDate: null,
    maxDate: null,
  });
  const [targetDeliveryNumber, setTargetDeliveryNumber] = useState<number | null>(null);
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string }[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [deliveryDetails, setDeliveryDetails] = useState<Map<string, DeliveryDetail[]>>(new Map());
  const [deliveries, setDeliveries] = useState<Map<string, Delivery[]>>(new Map());
  const [internalOrders, setInternalOrders] = useState<Map<string, InternalOrderItem[]>>(new Map());
  const [internalOrderDetails, setInternalOrderDetails] = useState<Map<number, InternalOrderDetail[]>>(new Map());
  const [orderTarget, setOrderTarget] = useState<InternalOrderItem | null>(null);
  const { registListner, shops, currentShop } = useAppContext();

  useEffect(() => {
    registListner('shops');
  }, []);

  useEffect(() => {
    const options = Array.from(shops.entries())
      .filter(([_, shop]) => !shop.hidden)
      .map(([code, shop]) => ({
        value: code,
        label: nameWithCode(shop),
      }));
    options.unshift({ label: '', value: '' });
    setShopOptions(options);
  }, [shops]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const queryDeliveries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentShop) {
      try {
        const conds: QueryConstraint[] = [];

        if (search.minDate) {
          conds.push(where('createdAt', '>=', search.minDate));
        }
        if (search.maxDate) {
          const date = new Date(search.maxDate);
          date.setDate(date.getDate() + 1);
          conds.push(where('createdAt', '<', date));
        }
        if (search.shopCode) conds.push(where('shopCode', '==', search.shopCode));

        const q = query(collection(db, 'sales'), ...conds) as Query<Sale>;
        const qsnap = await getDocs(q);
        const tasks = qsnap.docs.map(async (dsnap) => {
          const details = new Map<string, Map<string, DeliveryDetail>>();
          try {
            const q2 = query(collection(db, 'sales', dsnap.id, 'saleDetails'), where('division', '==', OTC_DIVISION));
            const qsnapDetail = (await getDocs(q2)) as QuerySnapshot<SaleDetail>;
            const sale = dsnap.data();
            const shopDetails = details.get(sale.shopCode) ?? new Map<string, DeliveryDetail>();
            qsnapDetail.forEach((dsnapDetail) => {
              const saleSetail = dsnapDetail.data();
              const product = saleSetail.product;
              if (product.code) {
                const detail = shopDetails.get(product.code) ?? {
                  productCode: product.code,
                  productName: product.name,
                  quantity: 0,
                  costPrice: product.costPrice,
                  fixed: false,
                };
                if (saleSetail.status === 'Sales') detail.quantity += saleSetail.quantity;
                if (saleSetail.status === 'Return') detail.quantity -= saleSetail.quantity;
                shopDetails.set(product.code, detail);
              }
            });
            details.set(sale.shopCode, shopDetails);
          } catch (error) {
            console.log({ error });
          }
          return details;
        });
        const results = await Promise.all(tasks);
        const details = new Map<string, Map<string, DeliveryDetail>>();
        results.forEach((result) => {
          for (let [shopCode, details2] of Array.from(result.entries())) {
            const shopDetails = details.get(shopCode) ?? new Map<string, DeliveryDetail>();
            for (let [productCode, detail] of Array.from(details2.entries())) {
              const detail2 = shopDetails.get(productCode) ?? { ...detail, quantity: 0 };
              detail2.quantity += detail.quantity;
              shopDetails.set(productCode, detail2);
            }
            details.set(shopCode, shopDetails);
          }
        });
        const items = new Map<string, DeliveryDetail[]>();
        for (let [shopCode, shopDetails] of Array.from(details.entries())) {
          items.set(shopCode, Array.from(shopDetails.values()));
        }
        setDeliveryDetails(items);

        // 既存データを取得
        const path = deliveryPath(currentShop.code);
        const qq = query(collection(db, path), where('date', '>', search.minDate)) as Query<Delivery>;
        const qqsnap = await getDocs(qq);
        const delivs = new Map<string, Delivery[]>();
        qqsnap.docs.forEach((dsnap) => {
          const deliv = dsnap.data();
          const shopDelivs = Array.from(delivs.get(deliv.dstShopCode) ?? []);
          shopDelivs.push(deliv);
          delivs.set(deliv.dstShopCode, shopDelivs);
        });
        setDeliveries(delivs);

        // 社内発注
        const conds2: QueryConstraint[] = [];

        if (search.minDate) {
          conds2.push(where('date', '>=', search.minDate));
        }
        if (search.maxDate) {
          const date = new Date(search.maxDate);
          date.setDate(date.getDate() + 1);
          conds2.push(where('date', '<', date));
        }
        if (search.shopCode) conds2.push(where('shopCode', '==', search.shopCode));

        const q2 = query(collectionGroup(db, 'internalOrders'), ...conds2) as Query<InternalOrder>;
        const qsnap2 = await getDocs(q2);

        const orders = new Map<string, InternalOrderItem[]>();
        qsnap2.docs.forEach((dsnap) => {
          const order = dsnap.data() as InternalOrderItem;
          order.target = order.srcShopCode === currentShop.code;
          const shopOrders = Array.from(orders.get(order.shopCode) ?? []);
          shopOrders.push(order);
          orders.set(order.shopCode, shopOrders);
        });
        setInternalOrders(orders);

        const orderDetails = new Map<number, InternalOrderDetail[]>();
        for (let [shopCode, orderItems] of Array.from(orders.entries())) {
          const internalOrderNumbers = orderItems.map((order) => order.internalOrderNumber);
          const tasks = orderItems.map(async (order) => {
            const path = internalOrderDetailPath(order.shopCode, order.internalOrderNumber);
            const qsnap = (await getDocs(collection(db, path))) as QuerySnapshot<InternalOrderDetail>;
            return qsnap.docs.map((dsnap) => dsnap.data());
          });
          const results = await Promise.all(tasks);
          results.forEach((arr, index) => {
            arr.forEach((detail) => {
              const orderNumber = internalOrderNumbers[index];
              const shopOrderDetails = Array.from(orderDetails.get(orderNumber) ?? []);
              shopOrderDetails.push(detail);
              orderDetails.set(orderNumber, shopOrderDetails);
            });
          });
        }
        setInternalOrderDetails(orderDetails);
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const getTotal = (details: DeliveryDetail[]) => {
    return {
      totalVariety: details.filter((detail) => detail.quantity !== 0).length,
      totalQuantity: details.reduce((acc, item) => acc + item.quantity, 0),
      totalAmount: details.reduce((acc, item) => acc + item.quantity * Number(item.costPrice), 0),
    };
  };

  const createDelivery = (dstShopCode: string) => async () => {
    if (currentShop && search.minDate && search.maxDate && window.confirm('配荷データを作成しますか？')) {
      try {
        const shopCode = currentShop.code;
        const shop = shops.get(dstShopCode);
        const details = deliveryDetails.get(dstShopCode);
        if (shop && details) {
          const functions = getFunctions(app, 'asia-northeast1');
          // deliveries と purchases のドキュメントIDは同一にする
          const result = await httpsCallable(functions, 'getSequence')({ docId: 'purchases' });
          if (!isNum(result.data)) throw Error('出庫番号の取得に失敗しました。');
          const deliveryNumber = Number(result.data);

          const totals = getTotal(details);
          const delivery: Delivery = {
            ...totals,
            deliveryNumber,
            shopCode,
            shopName: currentShop.name,
            dstShopCode,
            dstShopName: shop.name,
            date: Timestamp.fromDate(new Date()),
            fixed: false,
            soldDatedFrom: Timestamp.fromDate(search.minDate),
            soldDatedTo: Timestamp.fromDate(search.maxDate),
          };

          //　社内発注データ取得
          const orders = internalOrders.get(shopCode);
          const orderDetails = new Map<string, InternalOrderDetail>();
          if (orders) {
            const tasks = Array.from(orders.values()).map(async (order) => {
              const path = internalOrderDetailPath(shopCode, order.internalOrderNumber);
              const qsnap = (await getDocs(collection(db, path))) as QuerySnapshot<InternalOrderDetail>;
              return qsnap.docs.map((dsnap) => dsnap.data());
            });
            const results = await Promise.all(tasks);
            results.forEach((arr) => {
              arr.forEach((detail) => {
                const detail2 = orderDetails.get(detail.productCode);
                if (detail2) {
                  orderDetails.set(detail.productCode, { ...detail2, quantity: detail.quantity + detail2.quantity });
                } else {
                  orderDetails.set(detail.productCode, detail);
                }
              });
            });
          }

          await runTransaction(db, async (transaction) => {
            transaction.set(doc(db, deliveryPath(shopCode, deliveryNumber)), {
              ...delivery,
              updatedAt: serverTimestamp(),
            });
            details.forEach((detail) => {
              const orderDetail = orderDetails.get(detail.productCode);
              const orderQuantity = orderDetail?.quantity ?? 0;
              const path = deliveryDetailPath(shopCode, deliveryNumber, detail.productCode);
              transaction.set(doc(db, path), { ...detail, quantity: detail.quantity + orderQuantity });
              orderDetails.set(detail.productCode, { ...detail, quantity: 0 }); // カウント済
            });
            // 社内発注(売上に含まれないもの)
            Array.from(orderDetails.values()).forEach((orderDetail) => {
              if (orderDetail.quantity > 0) {
                const path = deliveryDetailPath(shopCode, deliveryNumber, orderDetail.productCode);
                transaction.set(doc(db, path), { ...orderDetail, fixed: false });
              }
            });
          });

          // 既存データに追加
          const delivs = new Map(deliveries);
          const shopDelivs = Array.from(delivs.get(dstShopCode) ?? []);
          shopDelivs.push(delivery);
          delivs.set(dstShopCode, shopDelivs);
          setDeliveries(delivs);

          alert('出庫データを作成しました。');
        }
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const dateSpan = (fromDate: Timestamp | undefined, toDate: Timestamp | undefined) => {
    if (!fromDate && !toDate) return '';

    return (
      '(' +
      ((fromDate && toDateString(fromDate.toDate(), 'MM-DD')) ?? '') +
      '〜' +
      ((toDate && toDateString(toDate.toDate(), 'MM-DD')) ?? '') +
      ')'
    );
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">配荷データ作成</h1>
        <Card className="p-5 overflow-visible">
          {targetDeliveryNumber && currentShop && (
            <DeliveryPrint
              mode="modal"
              shopCode={currentShop.code}
              deliveryNumber={targetDeliveryNumber}
              onClose={() => setTargetDeliveryNumber(null)}
            />
          )}
          {orderTarget && currentShop && (
            <InternalOrderPrint
              mode="modal"
              shopCode={orderTarget.shopCode}
              internalOrderNumber={orderTarget.internalOrderNumber}
              onClose={() => setOrderTarget(null)}
            />
          )}
          <Form className="flex space-x-2 mb-2" onSubmit={queryDeliveries}>
            <Form.Date
              value={search.minDate ? toDateString(search.minDate, 'YYYY-MM-DD') : ''}
              required
              onChange={(e) => {
                const minDate = e.target.value ? new Date(e.target.value) : null;
                setSearch((prev) => ({ ...prev, minDate }));
              }}
            />
            <p className="py-2">〜</p>
            <Form.Date
              value={search.maxDate ? toDateString(search.maxDate, 'YYYY-MM-DD') : ''}
              required
              onChange={(e) => {
                const maxDate = e.target.value ? new Date(e.target.value) : null;
                setSearch((prev) => ({ ...prev, maxDate }));
              }}
            />
            <Select
              value={selectValue(search.shopCode, shopOptions)}
              options={shopOptions}
              onMenuOpen={() => {
                registListner('shops');
              }}
              onChange={(e) => {
                setSearch((prev) => ({ ...prev, shopCode: String(e?.value) }));
              }}
              className="mb-3 sm:mb-0 w-72"
            />
            <Button className="w-48">検索</Button>
          </Form>
          {messages.length > 0 && (
            <Alert severity="error" onClose={() => setMessages([])}>
              {messages.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </Alert>
          )}
        </Card>
        <Table className="w-full">
          <Table.Head>
            <Table.Row>
              <Table.Cell>送り先店舗</Table.Cell>
              <Table.Cell>商品コード</Table.Cell>
              <Table.Cell>商品名</Table.Cell>
              <Table.Cell>商品数</Table.Cell>
              <Table.Cell>原価(税抜)</Table.Cell>
              <Table.Cell>金額</Table.Cell>
              <Table.Cell></Table.Cell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {Array.from(deliveryDetails.entries()).map(([shopCode, details], i) => {
              const shop = shops.get(shopCode) ?? { code: '', name: '' };
              const delivs = deliveries.get(shopCode) ?? [];
              const orders = internalOrders.get(shopCode) ?? [];
              return (
                <>
                  {details.map((detail, j) => (
                    <Table.Row key={j}>
                      <Table.Cell>{nameWithCode(shop)}</Table.Cell>
                      <Table.Cell>{detail.productCode}</Table.Cell>
                      <Table.Cell>{detail.productName}</Table.Cell>
                      <Table.Cell>{detail.quantity}</Table.Cell>
                      <Table.Cell>{detail.costPrice?.toLocaleString()}</Table.Cell>
                      <Table.Cell>{(detail.quantity * Number(detail.costPrice)).toLocaleString()}</Table.Cell>
                    </Table.Row>
                  ))}
                  {orders.map((order, j) => {
                    const orderDetails = internalOrderDetails.get(order.internalOrderNumber);
                    return (
                      <>
                        <Table.Row key={j}>
                          <Table.Cell>{nameWithCode(shop)}</Table.Cell>
                          <Table.Cell>⇒ {shops.get(order.srcShopCode)?.name}</Table.Cell>
                          <Table.Cell>発注日 {toDateString(order.date.toDate(), 'MM-DD')}</Table.Cell>
                          <Table.Cell></Table.Cell>
                          <Table.Cell></Table.Cell>
                          <Table.Cell></Table.Cell>
                        </Table.Row>
                        {orderDetails &&
                          orderDetails.map((orderDetail, k) => (
                            <Table.Row key={k}>
                              <Table.Cell>{nameWithCode(shop)}</Table.Cell>
                              <Table.Cell>{orderDetail.productCode}</Table.Cell>
                              <Table.Cell>{orderDetail.productName}</Table.Cell>
                              <Table.Cell>{orderDetail.quantity}</Table.Cell>
                              <Table.Cell>{orderDetail.costPrice?.toLocaleString()}</Table.Cell>
                              <Table.Cell>
                                {(orderDetail.quantity * Number(orderDetail.costPrice)).toLocaleString()}
                              </Table.Cell>
                            </Table.Row>
                          ))}
                      </>
                    );
                  })}
                  <Table.Row key={i}>
                    <Table.Cell>{nameWithCode(shop)}</Table.Cell>
                    <Table.Cell></Table.Cell>
                    <Table.Cell></Table.Cell>
                    <Table.Cell></Table.Cell>
                    <Table.Cell className="bold">合計</Table.Cell>
                    <Table.Cell>
                      {(
                        details.reduce((sum, detail) => sum + detail.quantity * Number(detail.costPrice), 0) +
                        orders
                          .map((order) => {
                            const orderDetails = internalOrderDetails.get(order.internalOrderNumber);
                            if (orderDetails) {
                              return orderDetails.reduce(
                                (sum, orderDetail) => sum + orderDetail.quantity * Number(orderDetail.costPrice),
                                0
                              );
                            } else {
                              return 0;
                            }
                          })
                          .reduce((sum, detailSum) => sum + detailSum, 0)
                      ).toLocaleString()}
                    </Table.Cell>
                    <Table.Cell>
                      <Button onClick={createDelivery(shopCode)}>作成</Button>
                    </Table.Cell>
                  </Table.Row>
                  {delivs.map((deliv, j) => {
                    return (
                      <Table.Row key={j}>
                        <Table.Cell>{nameWithCode(shop)}</Table.Cell>
                        <Table.Cell></Table.Cell>
                        <Table.Cell>出庫データ {dateSpan(deliv.soldDatedFrom, deliv.soldDatedTo)}</Table.Cell>
                        <Table.Cell>
                          <Button
                            color="light"
                            size="sm"
                            onClick={() => setTargetDeliveryNumber(deliv.deliveryNumber)}
                            className="mx-1"
                          >
                            詳細
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                  <Table.Row className="bg-gray-200">
                    <Table.Cell colSpan={7}></Table.Cell>
                  </Table.Row>
                </>
              );
            })}
          </Table.Body>
        </Table>
      </div>
    </div>
  );
};

export default DeliveryFromSale;
