import React, { useState, useEffect } from 'react';
import {
  getFirestore,
  collection,
  collectionGroup,
  getDocs,
  query,
  QueryConstraint,
  where,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { addDays, startOfMonth, endOfMonth, addMonths, format } from 'date-fns';
import Select from 'react-select';
import * as xlsx from 'xlsx';
import { Alert, Button, Card, Form, Table } from './components';
import { useAppContext } from './AppContext';
import { toNumber, toDateString, nameWithCode, arrToPieces, OTC_DIVISION } from './tools';
import firebaseError from './firebaseError';
import {
  Purchase,
  PurchaseDetail,
  Sale,
  SaleDetail,
  purchaseDetailPath,
  Rejection,
  rejectionDetailPath,
  RejectionDetail,
  MonthlyStock,
  monthlyStockPath,
  Stock,
  Delivery,
  deliveryDetailPath,
  DeliveryDetail,
} from './types';

type Row = (string | number)[];

const db = getFirestore();

const SalesDeliveryList: React.FC = () => {
  const [completed, setCompleted] = useState<boolean>(true);
  const [saleDeliveryItems, setSaleDeliveryItems] = useState<Map<string, Map<string, number | string>>>(new Map());
  const [shopCode, setShopCode] = useState<string>();
  const [shopOptions, setShopsOptions] = useState<{ label: string; value: string }[]>([]);
  const [monthFrom, setMonthFrom] = useState<Date>(new Date());
  const [monthTo, setMonthTo] = useState<Date>(new Date());
  const [messages, setMessages] = useState<string[]>([]);
  const { currentShop, shops, role, registListner, getProductPrice } = useAppContext();

  useEffect(() => {
    registListner('shops');
  }, []);

  useEffect(() => {
    if (role === 'shop') {
      if (currentShop) {
        setShopsOptions([{ value: currentShop.code, label: nameWithCode(currentShop) }]);
      }
    } else {
      const options = Array.from(shops.entries()).map(([code, shop]) => ({
        value: code,
        label: nameWithCode(shop),
      }));
      options.unshift({ value: '', label: '' });
      setShopsOptions(options);
    }
  }, [shops, currentShop]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const s2ab = (s: any) => {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
    return buf;
  };

  const searchSales = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessages([]);
    if (monthFrom && monthTo) {
      if (Number.isNaN(monthFrom.getTime()) || Number.isNaN(monthTo.getTime())) {
        setMessages((prev) => prev.concat('年月の範囲を指定してください。'));
        return;
      }
      setCompleted(false);
      const saleDeliveryItemsData = await querySales();
      if (saleDeliveryItemsData) setSaleDeliveryItems(saleDeliveryItemsData);
      setCompleted(true);
    } else {
      setMessages((prev) => prev.concat('年月の範囲を指定してください。'));
    }
  };

  const querySales = async () => {
    try {
      const thisMonth = startOfMonth(new Date());
      const prices = new Map<string, Map<string, number>>();
      const salesConds: QueryConstraint[] = [];
      if (shopCode) {
        salesConds.push(where('shopCode', '==', shopCode));
      }
      salesConds.push(where('createdAt', '>=', startOfMonth(monthFrom)));
      salesConds.push(where('createdAt', '<', addDays(endOfMonth(monthTo), 1)));
      const q = query(collection(db, 'sales'), ...salesConds);
      const querySnapshot = await getDocs(q);
      const items = new Map<string, Map<string, number | string>>();
      const pieces: QueryDocumentSnapshot<DocumentData>[][] = arrToPieces(querySnapshot.docs, 100);
      for (let piece of pieces) {
        await Promise.all(
          piece.map(async (saleDoc) => {
            const sale = saleDoc.data() as Sale;
            const registerSign = sale.status === 'Return' ? -1 : 1;
            const detailsSnapshot = await getDocs(
              query(collection(db, 'sales', saleDoc.id, 'saleDetails'), where('division', '==', OTC_DIVISION))
            );
            const shopDetails = items.get(sale.shopCode) ?? new Map<string, number | string>();
            const shopPrices = prices.get(sale.shopCode) ?? new Map<string, number>();
            await Promise.all(
              detailsSnapshot.docs.map(async (detailDoc) => {
                const detail = detailDoc.data() as SaleDetail;
                if (detail.product.code) {
                  shopDetails.set(
                    'salesCount',
                    toNumber(shopDetails.get('salesCount')) + detail.quantity * registerSign
                  );
                  shopDetails.set(
                    'salesTotal',
                    toNumber(shopDetails.get('salesTotal')) +
                      toNumber(detail.product.sellingPrice) * detail.quantity * registerSign -
                      detail.discount
                  );
                  shopDetails.set(
                    'salesCostTotal',
                    toNumber(shopDetails.get('salesCostTotal')) +
                      toNumber(detail.product.costPrice) * detail.quantity * registerSign
                  );
                  shopDetails.set(
                    'grossProfit',
                    toNumber(shopDetails.get('grossProfit')) +
                      (toNumber(detail.product.sellingPrice) - toNumber(detail.product.costPrice)) *
                        detail.quantity *
                        registerSign -
                      detail.discount
                  );

                  if (format(sale.createdAt.toDate(), 'yyyyMM') === format(thisMonth, 'yyyyMM')) {
                    const productPrices = shopPrices.get(detail.productCode);
                    if (!productPrices) {
                      const pr = await getProductPrice(sale.shopCode, detail.productCode, ['finalCostPrice']);
                      shopPrices.set(detail.productCode, toNumber(pr?.finalCostPrice));
                    }

                    shopDetails.set(
                      'salesCostThisMonthCount',
                      toNumber(shopDetails.get('salesCostThisMonthCount')) + detail.quantity * registerSign
                    );
                    shopDetails.set(
                      'salesCostThisMonthTotal',
                      toNumber(shopDetails.get('salesCostThisMonthTotal')) +
                        toNumber(shopPrices.get(detail.productCode)) * detail.quantity * registerSign -
                        detail.discount
                    );
                  }
                }
              })
            );
            items.set(sale.shopCode, shopDetails);
            prices.set(sale.shopCode, shopPrices);
          })
        );
      }

      const conds: QueryConstraint[] = [];
      if (shopCode) {
        conds.push(where('shopCode', '==', shopCode));
      }
      conds.push(where('date', '>=', startOfMonth(monthFrom)));
      conds.push(where('date', '<', addDays(endOfMonth(monthTo), 1)));
      const purchaseQuery = query(collectionGroup(db, 'purchases'), ...conds);
      const purchaseQuerySnapshot = await getDocs(purchaseQuery);
      const purchasePieces: QueryDocumentSnapshot<DocumentData>[][] = arrToPieces(purchaseQuerySnapshot.docs, 100);
      for (let piece of purchasePieces) {
        await Promise.all(
          piece.map(async (purchaseDoc) => {
            const purchase = purchaseDoc.data() as Purchase;
            const detailsSnapshot = await getDocs(
              collection(db, purchaseDetailPath(purchase.shopCode, purchase.purchaseNumber))
            );
            const shopDetails = items.get(purchase.shopCode) ?? new Map<string, number | string>();
            const shopPrices = prices.get(purchase.shopCode) ?? new Map<string, number>();
            await Promise.all(
              detailsSnapshot.docs.map(async (detailDoc) => {
                const detail = detailDoc.data() as PurchaseDetail;
                shopDetails.set('purchaseCount', toNumber(shopDetails.get('purchaseCount')) + detail.quantity);
                shopDetails.set(
                  'purchaseTotal',
                  toNumber(shopDetails.get('purchaseTotal')) + toNumber(detail.costPrice) * detail.quantity
                );
                if (format(purchase.date.toDate(), 'yyyyMM') === format(thisMonth, 'yyyyMM')) {
                  const productPrices = shopPrices.get(detail.productCode);
                  if (!productPrices) {
                    const pr = await getProductPrice(purchase.shopCode, detail.productCode, ['finalCostPrice']);
                    shopPrices.set(detail.productCode, toNumber(pr?.finalCostPrice));
                  }

                  shopDetails.set(
                    'purchaseThisMonthCount',
                    toNumber(shopDetails.get('purchaseThisMonthCount')) + detail.quantity
                  );
                  shopDetails.set(
                    'purchaseThisMonthTotal',
                    toNumber(shopDetails.get('rejectionThisMonthTotal')) +
                      toNumber(shopPrices.get(detail.productCode)) * detail.quantity
                  );
                }
              })
            );
            items.set(purchase.shopCode, shopDetails);
            prices.set(purchase.shopCode, shopPrices);
          })
        );
      }

      const deliveryQuery = query(collectionGroup(db, 'deliveries'), ...conds);
      const deliveryQuerySnapshot = await getDocs(deliveryQuery);
      const deliveryPieces: QueryDocumentSnapshot<DocumentData>[][] = arrToPieces(deliveryQuerySnapshot.docs, 100);
      for (let piece of deliveryPieces) {
        await Promise.all(
          piece.map(async (deliveryDoc) => {
            const delivery = deliveryDoc.data() as Delivery;
            const detailsSnapshot = await getDocs(
              collection(db, deliveryDetailPath(delivery.shopCode, delivery.deliveryNumber))
            );
            const shopDetails = items.get(delivery.shopCode) ?? new Map<string, number | string>();
            const shopPrices = prices.get(delivery.shopCode) ?? new Map<string, number>();
            await Promise.all(
              detailsSnapshot.docs.map(async (detailDoc) => {
                const detail = detailDoc.data() as DeliveryDetail;
                shopDetails.set('deliveryCount', toNumber(shopDetails.get('deliveryCount')) + detail.quantity);
                shopDetails.set(
                  'deliveryTotal',
                  toNumber(shopDetails.get('deliveryTotal')) + toNumber(detail.costPrice) * detail.quantity
                );
                if (format(delivery.date.toDate(), 'yyyyMM') === format(thisMonth, 'yyyyMM')) {
                  const productPrices = shopPrices.get(detail.productCode);
                  if (!productPrices) {
                    const pr = await getProductPrice(delivery.shopCode, detail.productCode, ['finalCostPrice']);
                    shopPrices.set(detail.productCode, toNumber(pr?.finalCostPrice));
                  }

                  shopDetails.set(
                    'deliveryThisMonthCount',
                    toNumber(shopDetails.get('deliveryThisMonthCount')) + detail.quantity
                  );
                  shopDetails.set(
                    'deliveryThisMonthTotal',
                    toNumber(shopDetails.get('deliveryThisMonthTotal')) +
                      toNumber(shopPrices.get(detail.productCode)) * detail.quantity
                  );
                }
              })
            );
            items.set(delivery.shopCode, shopDetails);
            prices.set(delivery.shopCode, shopPrices);
          })
        );
      }

      const rejectionQuery = query(collectionGroup(db, 'rejections'), ...conds);
      const rejectionQuerySnapshot = await getDocs(rejectionQuery);
      const rejectionPieces: QueryDocumentSnapshot<DocumentData>[][] = arrToPieces(rejectionQuerySnapshot.docs, 100);
      for (let piece of rejectionPieces) {
        await Promise.all(
          piece.map(async (rejectionDoc) => {
            const rejection = rejectionDoc.data() as Rejection;
            const detailsSnapshot = await getDocs(
              collection(db, rejectionDetailPath(rejection.shopCode, rejection.rejectionNumber))
            );
            const shopDetails = items.get(rejection.shopCode) ?? new Map<string, number | string>();
            const shopPrices = prices.get(rejection.shopCode) ?? new Map<string, number>();
            await Promise.all(
              detailsSnapshot.docs.map(async (detailDoc) => {
                const detail = detailDoc.data() as RejectionDetail;
                shopDetails.set('rejectionCount', toNumber(shopDetails.get('rejectionCount')) + detail.quantity);
                shopDetails.set(
                  'rejectionTotal',
                  toNumber(shopDetails.get('rejectionTotal')) + toNumber(detail.costPrice) * detail.quantity
                );
                if (format(rejection.date.toDate(), 'yyyyMM') === format(thisMonth, 'yyyyMM')) {
                  const productPrices = shopPrices.get(detail.productCode);
                  if (!productPrices) {
                    const pr = await getProductPrice(rejection.shopCode, detail.productCode, ['finalCostPrice']);
                    shopPrices.set(detail.productCode, toNumber(pr?.finalCostPrice));
                  }

                  shopDetails.set(
                    'rejectionThisMonthCount',
                    toNumber(shopDetails.get('rejectionThisMonthCount')) + detail.quantity
                  );
                  shopDetails.set(
                    'rejectionThisMonthTotal',
                    toNumber(shopDetails.get('rejectionThisMonthTotal')) +
                      toNumber(shopPrices.get(detail.productCode)) * detail.quantity
                  );
                }
              })
            );
            items.set(rejection.shopCode, shopDetails);
            prices.set(rejection.shopCode, shopPrices);
          })
        );
      }

      const monthlyStockConds: QueryConstraint[] = [];
      if (shopCode) {
        monthlyStockConds.push(where('shopCode', '==', shopCode));
      }
      if (format(monthTo, 'yyyyMM') === format(thisMonth, 'yyyyMM')) {
        monthlyStockConds.push(where('month', '==', format(addMonths(monthTo, -1), 'yyyyMM')));
      } else {
        monthlyStockConds.push(where('month', '==', format(monthTo, 'yyyyMM')));
      }
      const monthlyStockQuery = query(collectionGroup(db, 'monthlyStocks'), ...monthlyStockConds);
      const monthlyStockQuerySnapshot = await getDocs(monthlyStockQuery);
      const monthlyStockPieces: QueryDocumentSnapshot<DocumentData>[][] = arrToPieces(
        monthlyStockQuerySnapshot.docs,
        100
      );
      for (let piece of monthlyStockPieces) {
        await Promise.all(
          piece.map(async (monthlyStockDoc) => {
            const monthlyStock = monthlyStockDoc.data() as MonthlyStock;
            const detailsSnapshot = await getDocs(
              collection(db, monthlyStockPath(monthlyStock.shopCode, monthlyStock.month))
            );
            const shopDetails = items.get(monthlyStock.shopCode) ?? new Map<string, number | string>();
            const shopPrices = prices.get(monthlyStock.shopCode) ?? new Map<string, number>();
            const detailsSnapshotPieces: QueryDocumentSnapshot<DocumentData>[][] = arrToPieces(
              detailsSnapshot.docs,
              100
            );
            for (let detailsPiece of detailsSnapshotPieces) {
              await Promise.all(
                detailsPiece.map(async (detailDoc) => {
                  const detail = detailDoc.data() as Stock;
                  const productPrices = shopPrices.get(detail.productCode);
                  if (!productPrices) {
                    const pr = await getProductPrice(monthlyStock.shopCode, detail.productCode, ['finalCostPrice']);
                    shopPrices.set(detail.productCode, toNumber(pr?.finalCostPrice));
                  }
                  shopDetails.set(
                    'stockTotal',
                    toNumber(shopDetails.get('stockTotal')) +
                      toNumber(shopPrices.get(detail.productCode)) * detail.quantity
                  );
                  shopDetails.set('stockCount', toNumber(shopDetails.get('stockCount')) + detail.quantity);
                })
              );
              items.set(monthlyStock.shopCode, shopDetails);
              prices.set(monthlyStock.shopCode, shopPrices);
            }
          })
        );
      }

      if (format(monthTo, 'yyyyMM') === format(thisMonth, 'yyyyMM')) {
        items.forEach((shopDetails) => {
          shopDetails.set(
            'stockCount',
            toNumber(shopDetails.get('stockCount')) +
              toNumber(shopDetails.get('purchaseThisMonthCount')) -
              toNumber(shopDetails.get('salesCostThisMonthCount')) -
              toNumber(shopDetails.get('deliveryThisMonthCount')) -
              toNumber(shopDetails.get('rejectionThisMonthCount'))
          );
          shopDetails.set(
            'stockTotal',
            toNumber(shopDetails.get('stockTotal')) +
              toNumber(shopDetails.get('purchaseThisMonthTotal')) -
              toNumber(shopDetails.get('salesCostThisMonthTotal')) -
              toNumber(shopDetails.get('deliveryThisMonthTotal')) -
              toNumber(shopDetails.get('rejectionThisMonthTotal'))
          );
        });
      }

      return items;
    } catch (error) {
      console.log({ error });
      alert(firebaseError(error));
    }
  };

  const downloadExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompleted(false);
    const dataArray: Row[] = [];
    dataArray.push([
      '店舗コード',
      '店舗名',
      '売上数量',
      '売上売価金額',
      '粗利',
      '粗利率',
      '仕入数量',
      '仕入原価金額',
      '廃棄数量',
      '廃棄原価金額',
      '最終在庫数量',
      '最終在庫原価金額',
    ]);

    const saleDeliveryItemsData = await querySales();
    if (saleDeliveryItemsData && shops) {
      Array.from(saleDeliveryItemsData.keys())
        .sort()
        .forEach((shopCode, index) => {
          const item = saleDeliveryItemsData.get(shopCode);
          dataArray.push([
            shopCode,
            `${shops.get(shopCode)?.name}`,
            toNumber(item?.get('salesCount')),
            toNumber(item?.get('salesTotal')),
            toNumber(item?.get('grossProfit')),
            toNumber(item?.get('salesTotal')) > 0
              ? parseFloat(((toNumber(item?.get('grossProfit')) / toNumber(item?.get('salesTotal'))) * 100).toFixed(1))
              : 0,
            toNumber(item?.get('purchaseCount')),
            toNumber(item?.get('purchaseTotal')),
            toNumber(item?.get('rejectionCount')),
            toNumber(item?.get('rejectionTotal')),
            toNumber(item?.get('stockCount')),
            toNumber(item?.get('stockTotal')),
          ]);
        });
    }

    const sheet = xlsx.utils.aoa_to_sheet(dataArray);
    const wscols = [15, 30, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10].map((value) => ({ wch: value }));
    sheet['!cols'] = wscols;
    const wb = {
      SheetNames: ['売上仕入対比表'],
      Sheets: { 売上仕入対比表: sheet },
    };
    const wb_out = xlsx.write(wb, { type: 'binary' });
    var blob = new Blob([s2ab(wb_out)], {
      type: 'application/octet-stream',
    });

    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `売上仕入対比表.xlsx`;
    link.click();
    setCompleted(true);
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">売上仕入対比表</h1>
        <Card className="p-5 overflow-visible">
          <Form className="flex space-x-2 mb-2" onSubmit={searchSales}>
            <Select
              value={selectValue(shopCode, shopOptions)}
              options={shopOptions}
              onChange={(e) => {
                setShopCode(String(e?.value));
              }}
              className="mb-3 sm:mb-0 w-72"
            />
            <Form.Month
              value={monthFrom ? toDateString(monthFrom, 'YYYY-MM') : ''}
              onChange={(e) => {
                setMonthFrom(new Date(e.target.value));
              }}
            />
            〜
            <Form.Month
              value={monthTo ? toDateString(monthTo, 'YYYY-MM') : ''}
              onChange={(e) => {
                setMonthTo(new Date(e.target.value));
              }}
            />
            <Button size="xs" className="w-24" disabled={!completed} onClick={searchSales}>
              検索
            </Button>
            <Button className="w-24" disabled={!completed} onClick={downloadExcel}>
              Excel
            </Button>
          </Form>
          {messages.length > 0 && (
            <Alert severity="error" onClose={() => setMessages([])}>
              {messages.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </Alert>
          )}
          <Table border="cell" className="w-full text-xs">
            <Table.Head>
              <Table.Row>
                <Table.Cell className="w-1/12 text-center">店舗コード</Table.Cell>
                <Table.Cell className="w-1/12 text-center">店舗名</Table.Cell>
                <Table.Cell className="w-1/12 text-center">売上数量</Table.Cell>
                <Table.Cell className="w-1/12 text-center">売上売価金額</Table.Cell>
                <Table.Cell className="w-1/12 text-center">粗利</Table.Cell>
                <Table.Cell className="w-1/12 text-center">粗利率</Table.Cell>
                <Table.Cell className="w-1/12 text-center">仕入数量</Table.Cell>
                <Table.Cell className="w-1/12 text-center">仕入原価金額</Table.Cell>
                <Table.Cell className="w-1/12 text-center">廃棄数量</Table.Cell>
                <Table.Cell className="w-1/12 text-center">廃棄原価金額</Table.Cell>
                <Table.Cell className="w-1/12 text-center">最終在庫数量</Table.Cell>
                <Table.Cell className="w-1/12 text-center">最終在庫原価金額</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {Array.from(saleDeliveryItems.keys())
                .sort()
                .map((shopCode, index) => {
                  const item = saleDeliveryItems.get(shopCode);
                  return (
                    <Table.Row key={index}>
                      <Table.Cell>{shopCode}</Table.Cell>
                      <Table.Cell>{shops.get(shopCode)?.name}</Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(item?.get('salesCount'))?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(item?.get('salesTotal'))?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(item?.get('grossProfit'))?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(item?.get('salesTotal')) > 0
                          ? `${((toNumber(item?.get('grossProfit')) / toNumber(item?.get('salesTotal'))) * 100).toFixed(
                              1
                            )}%`
                          : '-'}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(item?.get('purchaseCount'))?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(item?.get('purchaseTotal'))?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(item?.get('rejectionCount'))?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(item?.get('rejectionTotal'))?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(item?.get('stockCount'))?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(item?.get('stockTotal'))?.toLocaleString()}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
            </Table.Body>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default SalesDeliveryList;
