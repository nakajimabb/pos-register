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
} from 'firebase/firestore';
import { Alert, Button, Card, Form, Table } from './components';
import { useAppContext } from './AppContext';
import DeliveryPrint from './DeliveryPrint';
import firebaseError from './firebaseError';
import { nameWithCode, toDateString } from './tools';
import { Delivery } from './types';

const db = getFirestore();

const DeliveryList: React.FC = () => {
  const [search, setSearch] = useState<{ shopCode: string; date: Date | null }>({
    shopCode: '',
    date: null,
  });
  const [target, setTarget] = useState<{ delivery: Delivery; mode: 'modal' | 'print' } | null>(null);
  const [shopOptions, setSuppliersOptions] = useState<{ label: string; value: string }[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const { registListner, shops, currentShop } = useAppContext();

  useEffect(() => {
    if (shops) {
      const options = Object.entries(shops).map(([code, shop]) => ({
        value: code,
        label: nameWithCode(shop),
      }));
      options.unshift({ label: '', value: '' });
      setSuppliersOptions(options);
    }
  }, [shops]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const queryDeliveries = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentShop) {
      try {
        const conds: QueryConstraint[] = [limit(30)];

        if (search.date) {
          conds.push(where('date', '==', Timestamp.fromDate(search.date)));
        } else {
          conds.push(orderBy('date', 'desc'));
        }
        if (search.shopCode) conds.push(where('dstShopCode', '==', search.shopCode));

        const q = query(collection(db, 'shops', currentShop.code, 'deliveries'), ...conds) as Query<Delivery>;
        const snap = await getDocs(q);
        setDeliveries(snap.docs.map((item) => item.data()));
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">出庫一覧</h1>
        <Card className="p-5 overflow-visible">
          {target && currentShop && (
            <DeliveryPrint
              mode={target.mode}
              shopCode={target.delivery.shopCode}
              deliveryNumber={target.delivery.deliveryNumber}
              onClose={() => setTarget(null)}
            />
          )}
          <Form className="flex space-x-2 mb-2" onSubmit={queryDeliveries}>
            <Form.Date
              value={search.date ? toDateString(search.date, 'YYYY-MM-DD') : ''}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : null;
                setSearch((prev) => ({ ...prev, date }));
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
          <Table className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell>No</Table.Cell>
                <Table.Cell>出庫日</Table.Cell>
                <Table.Cell>送り先</Table.Cell>
                <Table.Cell></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {deliveries.map((item, i) => {
                const date = item.date.toDate();
                const dateStr = toDateString(date, 'YYYY-MM-DD');
                return (
                  <Table.Row key={i}>
                    <Table.Cell>{item.deliveryNumber}</Table.Cell>
                    <Table.Cell>{dateStr}</Table.Cell>
                    <Table.Cell>{item.dstShopName}</Table.Cell>
                    <Table.Cell>
                      <Link
                        to={`/delivery_main?shopCode=${item.shopCode}&deliveryNumber=${item.deliveryNumber}`}
                        className="mx-1"
                      >
                        <Button color="light" size="sm">
                          編集
                        </Button>
                      </Link>
                      <Button
                        color="light"
                        size="sm"
                        onClick={() => setTarget({ delivery: item, mode: 'modal' })}
                        className="mx-1"
                      >
                        詳細
                      </Button>
                      <Button
                        color="light"
                        size="sm"
                        onClick={() => setTarget({ delivery: item, mode: 'print' })}
                        className="mx-1"
                      >
                        印刷
                      </Button>
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

export default DeliveryList;
