import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, query, QueryConstraint, where, doc, getDoc } from 'firebase/firestore';
import { addDays, format, startOfMonth, endOfMonth, differenceInMonths } from 'date-fns';
import Select from 'react-select';
import { Alert, Button, Card, Form, Table } from './components';
import { useAppContext } from './AppContext';
import RegisterSearch from './RegisterSearch';
import { toNumber, toDateString, nameWithCode, OTC_DIVISION } from './tools';
import firebaseError from './firebaseError';
import {
  Delivery,
  DeliveryDetail,
  Rejection,
  RejectionDetail,
  Purchase,
  PurchaseDetail,
  Product,
  Sale,
  SaleDetail,
  purchaseDetailPath,
  deliveryDetailPath,
  rejectionDetailPath,
  monthlyStockPath,
  Stock,
} from './types';

const db = getFirestore();

const ItemTrendList: React.FC = () => {
  const [completed, setCompleted] = useState<boolean>(true);
  const [itemTrends, setItemTrends] = useState<{ [code: string]: { [code: string]: number | string } }>({});
  const [openSearch, setOpenSearch] = useState<boolean>(false);
  const [productCode, setProductCode] = useState<string>('');
  const [prices, setPrices] = useState<{
    finalCostPrice?: number | undefined;
    sellingPrice?: number | undefined;
    noReturn?: boolean | undefined;
    product?: Product | undefined;
    supplierCode?: string | undefined;
  }>();
  const [shopCode, setShopCode] = useState<string>();
  const [shopOptions, setShopsOptions] = useState<{ label: string; value: string }[]>([]);
  const [dateFrom, setDateFrom] = useState<Date>(new Date());
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [messages, setMessages] = useState<string[]>([]);
  const { currentShop, shops, role, registListner, getProductPrice } = useAppContext();

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const searchItemTrends = async () => {
    if (shopCode && checkDateRange()) {
      setCompleted(false);
      const itemTrendsData = await queryItemTrends();
      if (itemTrendsData) setItemTrends(itemTrendsData);
      setCompleted(true);
    }
  };

  const checkDateRange = () => {
    if (dateFrom && dateTo) {
      const diffDay = differenceInMonths(dateFrom, dateTo);
      if (diffDay > 6) {
        setMessages((prev) => prev.concat('月の範囲を6ヶ月以内に指定してください。'));
      } else {
        return true;
      }
    } else {
      setMessages((prev) => prev.concat('月の範囲を指定してください(6ヶ月以内)。'));
    }
    return false;
  };

  const queryItemTrends = async () => {
    if (shopCode && dateFrom) {
      try {
        const itemTrendsData: { [code: string]: { [code: string]: number | string } } = {};
        const conds: QueryConstraint[] = [];
        if (dateFrom) {
          conds.push(where('date', '>=', startOfMonth(dateFrom)));
        }
        if (dateTo) {
          conds.push(where('date', '<', addDays(endOfMonth(dateTo), 1)));
        }
        const purchaseQuery = query(collection(db, 'shops', shopCode, 'purchases'), ...conds);
        const purchaseQuerySnapshot = await getDocs(purchaseQuery);
        await Promise.all(
          purchaseQuerySnapshot.docs.map(async (purchaseDoc) => {
            const purchase = purchaseDoc.data() as Purchase;
            const detailsSnapshot = await getDocs(
              collection(db, purchaseDetailPath(shopCode, purchase.purchaseNumber))
            );
            const purchaseDateString = format(purchase.date.toDate(), 'yyyy/MM/dd');
            await Promise.all(
              detailsSnapshot.docs.map(async (detailDoc) => {
                const detail = detailDoc.data() as PurchaseDetail;
                if (detail.productCode === productCode) {
                  if (!Object.keys(itemTrendsData).includes(purchaseDateString)) {
                    itemTrendsData[purchaseDateString] = {};
                  }
                  itemTrendsData[purchaseDateString]['purchaseCount'] =
                    toNumber(itemTrendsData[purchaseDateString]['purchaseCount']) + detail.quantity;
                  itemTrendsData[purchaseDateString]['purchaseCostTotal'] =
                    toNumber(itemTrendsData[purchaseDateString]['purchaseCostTotal']) +
                    toNumber(detail.costPrice) * detail.quantity;
                }
              })
            );
          })
        );

        const deliveryQuery = query(collection(db, 'shops', shopCode, 'deliveries'), ...conds);
        const deliveryQuerySnapshot = await getDocs(deliveryQuery);
        await Promise.all(
          deliveryQuerySnapshot.docs.map(async (deliveryDoc) => {
            const delivery = deliveryDoc.data() as Delivery;
            const detailsSnapshot = await getDocs(
              collection(db, deliveryDetailPath(shopCode, delivery.deliveryNumber))
            );
            const deliveryDateString = format(delivery.date.toDate(), 'yyyy/MM/dd');
            await Promise.all(
              detailsSnapshot.docs.map(async (detailDoc) => {
                const detail = detailDoc.data() as DeliveryDetail;
                if (detail.productCode === productCode) {
                  if (!Object.keys(itemTrendsData).includes(deliveryDateString)) {
                    itemTrendsData[deliveryDateString] = {};
                  }
                  itemTrendsData[deliveryDateString]['deliveryCount'] =
                    toNumber(itemTrendsData[deliveryDateString]['deliveryCount']) + detail.quantity;
                  itemTrendsData[deliveryDateString]['deliveryCostTotal'] =
                    toNumber(itemTrendsData[deliveryDateString]['deliveryCostTotal']) +
                    toNumber(detail.costPrice) * detail.quantity;
                }
              })
            );
          })
        );

        const rejectionQuery = query(collection(db, 'shops', shopCode, 'rejections'), ...conds);
        const rejectionQuerySnapshot = await getDocs(rejectionQuery);
        await Promise.all(
          rejectionQuerySnapshot.docs.map(async (rejectionDoc) => {
            const rejection = rejectionDoc.data() as Rejection;
            const detailsSnapshot = await getDocs(
              collection(db, rejectionDetailPath(shopCode, rejection.rejectionNumber))
            );
            const rejectionDateString = format(rejection.date.toDate(), 'yyyy/MM/dd');
            await Promise.all(
              detailsSnapshot.docs.map(async (detailDoc) => {
                const detail = detailDoc.data() as RejectionDetail;
                if (detail.productCode === productCode) {
                  if (!Object.keys(itemTrendsData).includes(rejectionDateString)) {
                    itemTrendsData[rejectionDateString] = {};
                  }
                  itemTrendsData[rejectionDateString]['rejectionCount'] =
                    toNumber(itemTrendsData[rejectionDateString]['rejectionCount']) + detail.quantity;
                  itemTrendsData[rejectionDateString]['rejectionCostTotal'] =
                    toNumber(itemTrendsData[rejectionDateString]['rejectionCostTotal']) +
                    toNumber(detail.costPrice) * detail.quantity;
                }
              })
            );
          })
        );

        const salesConds: QueryConstraint[] = [];
        salesConds.push(where('shopCode', '==', shopCode));
        if (dateFrom) {
          salesConds.push(where('createdAt', '>=', dateFrom));
        }
        if (dateTo) {
          salesConds.push(where('createdAt', '<', addDays(dateTo, 1)));
        }
        const salesQuery = query(collection(db, 'sales'), ...salesConds);
        const salesQuerySnapshot = await getDocs(salesQuery);

        await Promise.all(
          salesQuerySnapshot.docs.map(async (saleDoc) => {
            const sale = saleDoc.data() as Sale;
            const registerSign = sale.status === 'Return' ? -1 : 1;
            const detailsSnapshot = await getDocs(collection(db, 'sales', saleDoc.id, 'saleDetails'));
            const saleDateString = format(sale.createdAt.toDate(), 'yyyy/MM/dd');
            await Promise.all(
              detailsSnapshot.docs.map(async (detailDoc) => {
                const detail = detailDoc.data() as SaleDetail;
                if (detail.product.code && detail.division === OTC_DIVISION) {
                  if (detail.product.code === productCode) {
                    if (!Object.keys(itemTrendsData).includes(saleDateString)) {
                      itemTrendsData[saleDateString] = {};
                    }
                    itemTrendsData[saleDateString]['salesCount'] =
                      toNumber(itemTrendsData[saleDateString]['salesCount']) + detail.quantity * registerSign;
                    itemTrendsData[saleDateString]['salesTotal'] =
                      toNumber(itemTrendsData[saleDateString]['salesTotal']) +
                      toNumber(detail.product.sellingPrice) * detail.quantity * registerSign -
                      detail.discount;
                  }
                }
              })
            );
          })
        );

        const monthlyStockSnap = await getDoc(
          doc(db, monthlyStockPath(shopCode, format(dateFrom, 'yyyyMM'), productCode))
        );
        let monthlyStockQuantity = 0;
        if (monthlyStockSnap.exists()) {
          const monthlyStock = monthlyStockSnap.data() as Stock;
          monthlyStockQuantity = monthlyStock.quantity;
        }

        Object.keys(itemTrendsData)
          .sort()
          .forEach((dateString, index, dateStringArray) => {
            const prevStockCount =
              index == 0 ? monthlyStockQuantity : toNumber(itemTrendsData[dateStringArray[index - 1]]['stockCount']);
            itemTrendsData[dateString]['stockCount'] =
              prevStockCount +
              toNumber(itemTrendsData[dateString]['purchaseCount']) -
              toNumber(itemTrendsData[dateString]['salesCount']) -
              toNumber(itemTrendsData[dateString]['deliveryCount']) -
              toNumber(itemTrendsData[dateString]['rejectionCount']);
            itemTrendsData[dateString]['stockCostTotal'] =
              toNumber(itemTrendsData[dateString]['stockCount']) * toNumber(prices?.finalCostPrice);
          });

        return itemTrendsData;
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const findProduct = async (code: string) => {
    try {
      if (shopCode) {
        const pricesData = await getProductPrice(shopCode, code, ['finalCostPrice', 'sellingPrice', 'product']);
        if (pricesData) {
          setPrices(pricesData);
        } else {
          console.log('no such product');
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

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
    if (currentShop) {
      setShopCode(currentShop.code);
    }
  }, [shops, currentShop]);

  useEffect(() => {
    searchItemTrends();
  }, [prices]);

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">商品動向</h1>
        <RegisterSearch
          open={openSearch}
          setProductCode={setProductCode}
          findProduct={findProduct}
          onClose={() => {
            setOpenSearch(false);
            document.getElementById('productCode')?.focus();
          }}
        ></RegisterSearch>
        <Card className="p-5 overflow-visible">
          <div className="flex space-x-2 mb-2">
            <Select
              value={selectValue(shopCode, shopOptions)}
              options={shopOptions}
              onChange={(e) => {
                setShopCode(String(e?.value));
              }}
              className="mb-3 sm:mb-0 w-72"
            />
            <Form.Month
              value={dateFrom ? toDateString(dateFrom, 'YYYY-MM') : ''}
              onChange={(e) => {
                setDateFrom(new Date(e.target.value));
              }}
            />
            〜
            <Form.Month
              value={dateTo ? toDateString(dateTo, 'YYYY-MM') : ''}
              onChange={(e) => {
                setDateTo(new Date(e.target.value));
              }}
            />
            <Form.Text
              id="productCode"
              placeholder="商品コード"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value.trim())}
            />
            <Button color="light" size="xs" onClick={() => setOpenSearch(true)}>
              商品検索
            </Button>
            <Button
              size="xs"
              className="w-24"
              disabled={!completed || !productCode || !shopCode}
              onClick={searchItemTrends}
            >
              検索
            </Button>
          </div>
          {messages.length > 0 && (
            <Alert severity="error" onClose={() => setMessages([])}>
              {messages.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </Alert>
          )}
          {prices && (
            <Table border={'cell'} className="w-2/3 my-4 text-sm">
              <Table.Body>
                <Table.Row>
                  <Table.Cell className="w-24 bg-blue-100">商品名称</Table.Cell>
                  <Table.Cell>{prices?.product?.name}</Table.Cell>
                  <Table.Cell className="w-24 bg-blue-100">売価税抜</Table.Cell>
                  <Table.Cell>{String(prices?.sellingPrice)}</Table.Cell>
                  <Table.Cell className="w-24 bg-blue-100">原価税抜</Table.Cell>
                  <Table.Cell>{String(prices?.finalCostPrice)}</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
          )}
          {completed && prices ? (
            <Table border={'cell'} className="w-full text-sm">
              <Table.Head>
                <Table.Row>
                  <Table.Cell></Table.Cell>
                  <Table.Cell colSpan={2} className="text-center font-bold">
                    仕入
                  </Table.Cell>
                  <Table.Cell colSpan={2} className="text-center font-bold">
                    販売(税抜)
                  </Table.Cell>
                  <Table.Cell colSpan={2} className="text-center font-bold">
                    出庫
                  </Table.Cell>
                  <Table.Cell colSpan={2} className="text-center font-bold">
                    廃棄
                  </Table.Cell>
                  <Table.Cell colSpan={2} className="text-center font-bold">
                    在庫
                  </Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell className="w-2/12 text-center font-bold">日付</Table.Cell>
                  <Table.Cell className="w-1/12 text-center font-bold">数量</Table.Cell>
                  <Table.Cell className="w-1/12 text-center font-bold">金額</Table.Cell>
                  <Table.Cell className="w-1/12 text-center font-bold">数量</Table.Cell>
                  <Table.Cell className="w-1/12 text-center font-bold">金額</Table.Cell>
                  <Table.Cell className="w-1/12 text-center font-bold">数量</Table.Cell>
                  <Table.Cell className="w-1/12 text-center font-bold">金額</Table.Cell>
                  <Table.Cell className="w-1/12 text-center font-bold">数量</Table.Cell>
                  <Table.Cell className="w-1/12 text-center font-bold">金額</Table.Cell>
                  <Table.Cell className="w-1/12 text-center font-bold">数量</Table.Cell>
                  <Table.Cell className="w-1/12 text-center font-bold">金額</Table.Cell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {Object.keys(itemTrends)
                  .sort()
                  .map((date, index) => {
                    return (
                      <Table.Row key={index}>
                        <Table.Cell>{date}</Table.Cell>
                        <Table.Cell className="text-right">
                          {toNumber(itemTrends[date]['purchaseCount']).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {toNumber(itemTrends[date]['purchaseCostTotal']).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {toNumber(itemTrends[date]['salesCount']).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {toNumber(itemTrends[date]['salesTotal']).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {toNumber(itemTrends[date]['deliveryCount']).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {toNumber(itemTrends[date]['deliveryCostTotal']).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {toNumber(itemTrends[date]['rejectionCount']).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {toNumber(itemTrends[date]['rejectionCostTotal']).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {toNumber(itemTrends[date]['stockCount']).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {toNumber(itemTrends[date]['stockCostTotal']).toLocaleString()}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
              </Table.Body>
            </Table>
          ) : (
            prices && <p className="text-sm">読み込み中...</p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ItemTrendList;
