import React, { useState, useEffect } from 'react';
import {
  getFirestore,
  doc,
  collection,
  getDocs,
  query,
  QueryConstraint,
  limit,
  where,
  getDoc,
  collectionGroup,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { format, addMonths, endOfMonth } from 'date-fns';
import Select from 'react-select';
import * as xlsx from 'xlsx';
import { Alert, Button, Card, Form, Table } from './components';
import { useAppContext } from './AppContext';
import { toNumber, toDateString, nameWithCode, arrToPieces } from './tools';
import { Stock, DailyStock, dailyStockPath, Product } from './types';

type Row = (string | number)[];

const db = getFirestore();

const DailyStockList: React.FC = () => {
  const [completed, setCompleted] = useState<boolean>(true);
  const [stockItems, setStockItems] = useState<Map<string, Map<string, number | string>>>(new Map());
  const [shopCode, setShopCode] = useState<string>();
  const [shopOptions, setShopsOptions] = useState<{ label: string; value: string }[]>([]);
  const [targetDate, setTargetDate] = useState<Date>(new Date());
  const [messages, setMessages] = useState<string[]>([]);
  const { currentShop, shops, role, registListner, getProductPrice } = useAppContext();

  useEffect(() => {
    registListner('shops');
  }, []);

  useEffect(() => {
    if (role === 'shop') {
      if (currentShop) {
        setShopsOptions([{ value: currentShop.code, label: nameWithCode(currentShop) }]);
        setShopCode(currentShop.code);
      }
    } else {
      const options = Array.from(shops.entries()).map(([code, shop]) => ({
        value: code,
        label: nameWithCode(shop),
      }));
      options.unshift({ value: '', label: '' });
      setShopsOptions(options);
    }
    setTargetDate(endOfMonth(addMonths(new Date(), -1)));
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

    setCompleted(false);
    const stockItemsData = await querySales();
    if (stockItemsData) setStockItems(stockItemsData);
    setCompleted(true);
  };

  const querySales = async () => {
    const items = new Map<string, Map<string, number | string>>();
    const prices = new Map<string, Map<string, number>>();

    const products = new Map<string, Product>();
    const productsSnapshot = await getDocs(collection(db, 'products'));
    productsSnapshot.forEach((doc) => {
      const product = doc.data() as Product;
      products.set(product.code, product);
    });

    const dailyStockConds: QueryConstraint[] = [];
    if (shopCode) {
      dailyStockConds.push(where('shopCode', '==', shopCode));
    }
    dailyStockConds.push(where('date', '==', format(targetDate, 'yyyyMMdd')));
    const dailyStockQuery = query(collectionGroup(db, 'dailyStocks'), ...dailyStockConds);
    const dailyStockQuerySnapshot = await getDocs(dailyStockQuery);
    const dailyStockPieces: QueryDocumentSnapshot<DocumentData>[][] = arrToPieces(dailyStockQuerySnapshot.docs, 10);
    for (let piece of dailyStockPieces) {
      await Promise.all(
        piece.map(async (dailyStockDoc) => {
          const dailyStock = dailyStockDoc.data() as DailyStock;
          const detailsSnapshot = await getDocs(collection(db, dailyStockPath(dailyStock.shopCode, dailyStock.date)));
          const shopDetails = items.get(dailyStock.shopCode) ?? new Map<string, number | string>();
          const shopPrices = prices.get(dailyStock.shopCode) ?? new Map<string, number>();
          const detailsSnapshotPieces: QueryDocumentSnapshot<DocumentData>[][] = arrToPieces(detailsSnapshot.docs, 50);
          for (let detailsPiece of detailsSnapshotPieces) {
            await Promise.all(
              detailsPiece.map(async (detailDoc) => {
                const detail = detailDoc.data() as Stock;
                const productPrices = shopPrices.get(detail.productCode);
                if (!productPrices) {
                  const pr = await getProductPrice(dailyStock.shopCode, detail.productCode, ['finalCostPrice']);
                  shopPrices.set(detail.productCode, toNumber(pr?.finalCostPrice));
                }

                const product = products.get(detail.productCode);
                if (product) {
                  if (product.stockTax === 10) {
                    shopDetails.set(
                      'stockNormalTotal',
                      toNumber(shopDetails.get('stockNormalTotal')) +
                        toNumber(shopPrices.get(detail.productCode)) * detail.quantity
                    );
                    shopDetails.set(
                      'stockNormalCount',
                      toNumber(shopDetails.get('stockNormalCount')) + detail.quantity
                    );
                  } else if (product.stockTax === 8) {
                    shopDetails.set(
                      'stockReducedTotal',
                      toNumber(shopDetails.get('stockReducedTotal')) +
                        toNumber(shopPrices.get(detail.productCode)) * detail.quantity
                    );
                    shopDetails.set(
                      'stockReducedCount',
                      toNumber(shopDetails.get('stockReducedCount')) + detail.quantity
                    );
                  }
                }
              })
            );
            items.set(dailyStock.shopCode, shopDetails);
            prices.set(dailyStock.shopCode, shopPrices);
          }
        })
      );
    }
    return items;
  };

  const downloadExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompleted(false);
    const dataArray: Row[] = [];
    dataArray.push([
      '店舗コード',
      '店舗名',
      '8%在庫計(税別)',
      '8%消費税',
      '8%在庫計(税込)',
      '10%在庫計(税別)',
      '10%消費税',
      '10%在庫計(税込)',
      '在庫計(税別)',
      '消費税計',
      '在庫計(税込)',
    ]);

    const stockItemsData = await querySales();
    if (stockItemsData && shops) {
      Array.from(stockItemsData.keys())
        .sort()
        .forEach((shopCode, index) => {
          const item = stockItemsData.get(shopCode);
          dataArray.push([
            shopCode,
            `${shops.get(shopCode)?.name}`,
            toNumber(item?.get('stockReducedTotal')),
            Math.floor(toNumber(item?.get('stockReducedTotal')) * 0.08),
            Math.floor(toNumber(item?.get('stockReducedTotal')) * 1.08),
            toNumber(item?.get('stockNormalTotal')),
            Math.floor(toNumber(item?.get('stockNormalTotal')) * 0.1),
            Math.floor(toNumber(item?.get('stockNormalTotal')) * 1.1),
            toNumber(item?.get('stockReducedTotal')) + toNumber(item?.get('stockNormalTotal')),
            Math.floor(toNumber(item?.get('stockReducedTotal')) * 0.08) +
              Math.floor(toNumber(item?.get('stockNormalTotal')) * 0.1),
            Math.floor(toNumber(item?.get('stockReducedTotal')) * 1.08) +
              Math.floor(toNumber(item?.get('stockNormalTotal')) * 1.1),
          ]);
        });
    }

    const sheet = xlsx.utils.aoa_to_sheet(dataArray);
    const wscols = [15, 30, 10, 10, 10, 10, 10, 10, 10, 10, 10].map((value) => ({ wch: value }));
    sheet['!cols'] = wscols;
    const wb = {
      SheetNames: ['在庫集計表'],
      Sheets: { 在庫集計表: sheet },
    };
    const wb_out = xlsx.write(wb, { type: 'binary' });
    var blob = new Blob([s2ab(wb_out)], {
      type: 'application/octet-stream',
    });

    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `在庫集計表.xlsx`;
    link.click();
    setCompleted(true);
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">在庫集計表</h1>
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
            <Form.Date
              value={targetDate ? toDateString(targetDate, 'YYYY-MM-DD') : ''}
              onChange={(e) => {
                setTargetDate(new Date(e.target.value));
              }}
            />
            <Button className="w-48" disabled={!completed} onClick={searchSales}>
              検索
            </Button>
            <Button className="w-48" disabled={!completed} onClick={downloadExcel}>
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
                <Table.Cell className="text-center">店舗コード</Table.Cell>
                <Table.Cell className="text-center">店舗名</Table.Cell>
                <Table.Cell className="text-center">8%在庫計(税別)</Table.Cell>
                <Table.Cell className="text-center">8%消費税</Table.Cell>
                <Table.Cell className="text-center">8%在庫計(税込)</Table.Cell>
                <Table.Cell className="text-center">10%在庫計(税別)</Table.Cell>
                <Table.Cell className="text-center">10%消費税</Table.Cell>
                <Table.Cell className="text-center">10%在庫計(税込)</Table.Cell>
                <Table.Cell className="text-center">在庫計(税別)</Table.Cell>
                <Table.Cell className="text-center">消費税計</Table.Cell>
                <Table.Cell className="text-center">在庫計(税込)</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {Array.from(stockItems.keys())
                .sort()
                .map((shopCode, index) => {
                  const item = stockItems.get(shopCode);
                  return (
                    <Table.Row key={index}>
                      <Table.Cell>{shopCode}</Table.Cell>
                      <Table.Cell>{shops.get(shopCode)?.name}</Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(item?.get('stockReducedTotal'))?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {Math.floor(toNumber(item?.get('stockReducedTotal')) * 0.08)?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {Math.floor(toNumber(item?.get('stockReducedTotal')) * 1.08)?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(item?.get('stockNormalTotal'))?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {Math.floor(toNumber(item?.get('stockNormalTotal')) * 0.1)?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {Math.floor(toNumber(item?.get('stockNormalTotal')) * 1.1)?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {(
                          toNumber(item?.get('stockReducedTotal')) + toNumber(item?.get('stockNormalTotal'))
                        )?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {(
                          Math.floor(toNumber(item?.get('stockReducedTotal')) * 0.08) +
                          Math.floor(toNumber(item?.get('stockNormalTotal')) * 0.1)
                        )?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {(
                          Math.floor(toNumber(item?.get('stockReducedTotal')) * 1.08) +
                          Math.floor(toNumber(item?.get('stockNormalTotal')) * 1.1)
                        )?.toLocaleString()}
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

export default DailyStockList;
