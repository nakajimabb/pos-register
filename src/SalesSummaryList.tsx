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
} from 'firebase/firestore';
import { addDays } from 'date-fns';
import Select from 'react-select';
import * as xlsx from 'xlsx';
import { Alert, Button, Card, Form, Table } from './components';
import { useAppContext } from './AppContext';
import { toNumber, toDateString, nameWithCode, OTC_DIVISION } from './tools';
import firebaseError from './firebaseError';
import { ProductCostPrice, Sale, SaleDetail, Stock, Supplier } from './types';

type Row = (string | number)[];

const db = getFirestore();

const SalesSummaryList: React.FC = () => {
  const [completed, setCompleted] = useState<boolean>(false);
  const [salesItems, setSalesItems] = useState<{ [code: string]: { [code: string]: number | string } }>({});
  const [shopCode, setShopCode] = useState<string>();
  const [shopOptions, setShopsOptions] = useState<{ label: string; value: string }[]>([]);
  const [dateTimeFrom, setDateTimeFrom] = useState<Date>();
  const [dateTimeTo, setDateTimeTo] = useState<Date>();
  const [messages, setMessages] = useState<string[]>([]);
  const { currentShop, shops, role, registListner } = useAppContext();

  useEffect(() => {
    registListner('shops');
  }, []);

  useEffect(() => {
    if (shops) {
      if (role === 'shop') {
        if (currentShop) {
          setShopsOptions([{ value: currentShop.code, label: nameWithCode(currentShop) }]);
        }
      } else {
        const options = Object.entries(shops).map(([code, shop]) => ({
          value: code,
          label: nameWithCode(shop),
        }));
        setShopsOptions(options);
      }
      if (currentShop) {
        setShopCode(currentShop.code);
      }
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

  const querySales = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompleted(false);
    if (shopCode) {
      try {
        const salesItemsData: { [code: string]: { [code: string]: number | string } } = {};
        const conds: QueryConstraint[] = [limit(30)];
        conds.push(where('shopCode', '==', shopCode));
        if (dateTimeFrom) {
          conds.push(where('createdAt', '>=', dateTimeFrom));
        }
        if (dateTimeTo) {
          conds.push(where('createdAt', '<', addDays(dateTimeTo, 1)));
        }
        const q = query(collection(db, 'sales'), ...conds);
        const querySnapshot = await getDocs(q);
        await Promise.all(
          querySnapshot.docs.map(async (saleDoc) => {
            const sale = saleDoc.data() as Sale;
            const registerSign = sale.status === 'Return' ? -1 : 1;
            const detailsSnapshot = await getDocs(collection(db, 'sales', saleDoc.id, 'saleDetails'));
            await Promise.all(
              detailsSnapshot.docs.map(async (detailDoc) => {
                const detail = detailDoc.data() as SaleDetail;
                if (detail.product.code && detail.division === OTC_DIVISION) {
                  if (!Object.keys(salesItemsData).includes(detail.product.code)) {
                    salesItemsData[detail.product.code] = {};
                  }
                  salesItemsData[detail.product.code]['costPrice'] = toNumber(detail.product.costPrice);
                  salesItemsData[detail.product.code]['productName'] = detail.product.name;
                  const costPricesRef = collection(db, 'shops', shopCode, 'productCostPrices');
                  salesItemsData[detail.product.code]['salesCount'] =
                    toNumber(salesItemsData[detail.product.code]['salesCount']) + detail.quantity * registerSign;
                  salesItemsData[detail.product.code]['salesTotal'] =
                    toNumber(salesItemsData[detail.product.code]['salesTotal']) +
                    toNumber(detail.product.sellingPrice) * detail.quantity * registerSign -
                    detail.discount;
                  salesItemsData[detail.product.code]['costTotal'] =
                    toNumber(salesItemsData[detail.product.code]['costTotal']) +
                    toNumber(detail.product.costPrice) * detail.quantity * registerSign;
                  const costPricesSnap = await getDocs(
                    query(costPricesRef, where('productCode', '==', detail.product.code), limit(1))
                  );
                  if (costPricesSnap.size > 0) {
                    const costPrice = costPricesSnap.docs[0].data() as ProductCostPrice;
                    salesItemsData[detail.product.code]['supplierCode'] = costPrice.supplierCode;
                    salesItemsData[detail.product.code]['supplierName'] = costPrice.supplierName;
                  } else {
                    if (detail.product.supplierRef) {
                      const supplierSnap = await getDoc(detail.product.supplierRef);
                      const supplier = supplierSnap.data() as Supplier;
                      salesItemsData[detail.product.code]['supplierCode'] = supplier.code;
                      salesItemsData[detail.product.code]['supplierName'] = supplier.name;
                    }
                  }
                }
              })
            );
          })
        );
        await Promise.all(
          Object.keys(salesItemsData).map(async (productCode) => {
            if (productCode) {
              const stockRef = doc(collection(db, 'shops', shopCode, 'stocks'), productCode);
              const stockDoc = await getDoc(stockRef);
              if (stockDoc.exists()) {
                const stock = stockDoc.data() as Stock;
                salesItemsData[productCode]['stockCount'] = stock.quantity;
              } else {
                salesItemsData[productCode]['stockCount'] = 0;
              }
            }
          })
        );
        setSalesItems(salesItemsData);
        setCompleted(true);
        return salesItemsData;
      } catch (error) {
        console.log({ error });
        setCompleted(true);
        alert(firebaseError(error));
      }
    }
  };

  const downloadExcel = async (e: React.FormEvent) => {
    const salesItemsData = await querySales(e);
    const dataArray: Row[] = [];
    dataArray.push([
      '商品コード',
      '商品名',
      '仕入先コード',
      '仕入先名',
      '売上数',
      '売上税抜',
      '評価原価',
      '原価率',
      '粗利',
      '粗利率',
      '在庫数',
      '在庫金額',
    ]);
    if (salesItemsData) {
      Object.keys(salesItemsData)
        .sort()
        .map((productCode) => {
          dataArray.push([
            productCode,
            salesItemsData[productCode]['productName'],
            salesItemsData[productCode]['supplierCode'],
            salesItemsData[productCode]['supplierName'],
            toNumber(salesItemsData[productCode]['salesCount']),
            toNumber(salesItemsData[productCode]['salesTotal']),
            toNumber(salesItemsData[productCode]['costTotal']),
            toNumber(salesItemsData[productCode]['salesTotal']) > 0
              ? `${(
                  (toNumber(salesItemsData[productCode]['costTotal']) /
                    toNumber(salesItemsData[productCode]['salesTotal'])) *
                  100
                ).toFixed(1)}%`
              : '-',
            toNumber(salesItemsData[productCode]['salesTotal']) - toNumber(salesItemsData[productCode]['costTotal']),
            toNumber(salesItemsData[productCode]['salesTotal']) > 0
              ? `${(
                  ((toNumber(salesItemsData[productCode]['salesTotal']) -
                    toNumber(salesItemsData[productCode]['costTotal'])) /
                    toNumber(salesItemsData[productCode]['salesTotal'])) *
                  100
                ).toFixed(1)}%`
              : '-',
            toNumber(salesItemsData[productCode]['stockCount']),
            toNumber(salesItemsData[productCode]['stockCount']) * toNumber(salesItemsData[productCode]['costPrice']),
          ]);
        });
    }
    const sheet = xlsx.utils.aoa_to_sheet(dataArray);
    const wscols = [15, 30, 15, 15, 10, 10, 10, 10, 10, 10, 10, 10].map((value) => ({ wch: value }));
    sheet['!cols'] = wscols;
    const wb = {
      SheetNames: ['売上帳票'],
      Sheets: { 売上帳票: sheet },
    };
    const wb_out = xlsx.write(wb, { type: 'binary' });
    var blob = new Blob([s2ab(wb_out)], {
      type: 'application/octet-stream',
    });

    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `売上帳票.xlsx`;
    link.click();
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">売上帳票</h1>
        <Card className="p-5 overflow-visible">
          <Form className="flex space-x-2 mb-2" onSubmit={querySales}>
            <Select
              value={selectValue(shopCode, shopOptions)}
              options={shopOptions}
              onChange={(e) => {
                setShopCode(String(e?.value));
              }}
              className="mb-3 sm:mb-0 w-72"
            />
            <Form.Date
              value={dateTimeFrom ? toDateString(dateTimeFrom, 'YYYY-MM-DD') : ''}
              onChange={(e) => {
                setDateTimeFrom(new Date(e.target.value));
              }}
            />
            〜
            <Form.Date
              value={dateTimeTo ? toDateString(dateTimeTo, 'YYYY-MM-DD') : ''}
              onChange={(e) => {
                setDateTimeTo(new Date(e.target.value));
              }}
            />
            <Button className="w-48">検索</Button>
            <Button className="w-48" onClick={downloadExcel}>
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
          <Table className="w-full text-xs">
            <Table.Head>
              <Table.Row>
                <Table.Cell>商品コード</Table.Cell>
                <Table.Cell>商品名</Table.Cell>
                <Table.Cell>仕入先コード</Table.Cell>
                <Table.Cell>仕入先名</Table.Cell>
                <Table.Cell>売上数</Table.Cell>
                <Table.Cell>売上税抜</Table.Cell>
                <Table.Cell>評価原価</Table.Cell>
                <Table.Cell>原価率</Table.Cell>
                <Table.Cell>粗利</Table.Cell>
                <Table.Cell>粗利率</Table.Cell>
                <Table.Cell>在庫数</Table.Cell>
                <Table.Cell>在庫金額</Table.Cell>
                <Table.Cell>在庫回転率</Table.Cell>
                <Table.Cell>ランク</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {Object.keys(salesItems)
                .sort()
                .map((productCode, index) => {
                  return (
                    <Table.Row key={index}>
                      <Table.Cell>{productCode}</Table.Cell>
                      <Table.Cell>{salesItems[productCode]['productName']}</Table.Cell>
                      <Table.Cell>{salesItems[productCode]['supplierCode']}</Table.Cell>
                      <Table.Cell>{salesItems[productCode]['supplierName']}</Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(salesItems[productCode]['salesCount']).toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(salesItems[productCode]['salesTotal']).toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(salesItems[productCode]['costTotal']).toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(salesItems[productCode]['salesTotal']) > 0
                          ? `${(
                              (toNumber(salesItems[productCode]['costTotal']) /
                                toNumber(salesItems[productCode]['salesTotal'])) *
                              100
                            ).toFixed(1)}%`
                          : '-'}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {(
                          toNumber(salesItems[productCode]['salesTotal']) -
                          toNumber(salesItems[productCode]['costTotal'])
                        ).toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(salesItems[productCode]['salesTotal']) > 0
                          ? `${(
                              ((toNumber(salesItems[productCode]['salesTotal']) -
                                toNumber(salesItems[productCode]['costTotal'])) /
                                toNumber(salesItems[productCode]['salesTotal'])) *
                              100
                            ).toFixed(1)}%`
                          : '-'}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {toNumber(salesItems[productCode]['stockCount']).toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {(
                          toNumber(salesItems[productCode]['stockCount']) *
                          toNumber(salesItems[productCode]['costPrice'])
                        ).toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right"></Table.Cell>
                      <Table.Cell></Table.Cell>
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

export default SalesSummaryList;
