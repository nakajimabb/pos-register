import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { Link } from 'react-router-dom';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  Query,
  QueryConstraint,
  limit,
  orderBy,
  Timestamp,
  where,
  QuerySnapshot,
} from 'firebase/firestore';
import { Alert, Button, Card, Form, Table } from './components';
import { useAppContext } from './AppContext';
import firebaseError from './firebaseError';
import { nameWithCode, toDateString, OTC_DIVISION } from './tools';
import { Sale, SaleDetail, DeliveryDetail } from './types';

const db = getFirestore();

const DeliveryFromSale: React.FC = () => {
  const [search, setSearch] = useState<{ shopCode: string; minDate: Date | null; maxDate: Date | null }>({
    shopCode: '',
    minDate: null,
    maxDate: null,
  });
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string }[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [deliveryDetails, setDeliveryDetails] = useState<Map<string, DeliveryDetail[]>>(new Map());
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

  const createDeliveries = async (e: React.FormEvent) => {
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
        console.log({ results, items, search });
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">配荷データ作成</h1>
        <Card className="p-5 overflow-visible">
          <Form className="flex space-x-2 mb-2" onSubmit={createDeliveries}>
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
            <Button className="w-48">作成</Button>
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
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {Array.from(deliveryDetails.entries()).map(([shopCode, details], i) => {
              const shop = shops.get(shopCode) ?? { code: '', name: '' };
              return (
                <>
                  {details.map((detail) => (
                    <Table.Row key={i}>
                      <Table.Cell>{nameWithCode(shop)}</Table.Cell>
                      <Table.Cell>{detail.productCode}</Table.Cell>
                      <Table.Cell>{detail.productName}</Table.Cell>
                      <Table.Cell>{detail.quantity}</Table.Cell>
                      <Table.Cell>{detail.costPrice?.toLocaleString()}</Table.Cell>
                      <Table.Cell>{(detail.quantity * Number(detail.costPrice)).toLocaleString()}</Table.Cell>
                    </Table.Row>
                  ))}
                  <Table.Row key={i}>
                    <Table.Cell></Table.Cell>
                    <Table.Cell></Table.Cell>
                    <Table.Cell></Table.Cell>
                    <Table.Cell></Table.Cell>
                    <Table.Cell className="bold">合計</Table.Cell>
                    <Table.Cell>
                      {details
                        .reduce((sum, detail) => sum + detail.quantity * Number(detail.costPrice), 0)
                        .toLocaleString()}
                    </Table.Cell>
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
