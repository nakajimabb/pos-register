import React, { useState, useEffect } from 'react';
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
import InternalOrderPrint from './InternalOrderPrint';
import { useAppContext } from './AppContext';
import { nameWithCode, toDateString } from './tools';
import firebaseError from './firebaseError';
import { InternalOrder } from './types';

const db = getFirestore();

const InternalOrderList: React.FC = () => {
  const [search, setSearch] = useState<{ minDate: Date | null; maxDate: Date | null }>({
    minDate: null,
    maxDate: null,
  });
  const [target, setTarget] = useState<{ internalOrder: InternalOrder; mode: 'modal' | 'print' } | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [internalOrders, setInternalOrders] = useState<InternalOrder[]>([]);
  const { currentShop } = useAppContext();

  const queryInternalOrders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentShop) {
      try {
        const conds: QueryConstraint[] = [];

        if (search.minDate) {
          conds.push(where('date', '>=', Timestamp.fromDate(search.minDate)));
        }
        if (search.maxDate) {
          const date = new Date(search.maxDate);
          date.setDate(date.getDate() + 1);
          conds.push(where('date', '<=', Timestamp.fromDate(date)));
        }
        conds.push(orderBy('date', 'desc'));

        const q = query(collection(db, 'shops', currentShop.code, 'internalOrders'), ...conds) as Query<InternalOrder>;
        const snap = await getDocs(q);
        setInternalOrders(snap.docs.map((item) => item.data()));
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">社内発注一覧</h1>
        <Card className="p-5 overflow-visible">
          {target && currentShop && (
            <InternalOrderPrint
              mode={target.mode}
              shopCode={target.internalOrder.shopCode}
              internalOrderNumber={target.internalOrder.internalOrderNumber}
              onClose={() => setTarget(null)}
            />
          )}
          <Form className="flex space-x-2 mb-2" onSubmit={queryInternalOrders}>
            <Form.Date
              value={search.minDate ? toDateString(search.minDate, 'YYYY-MM-DD') : ''}
              onChange={(e) => {
                const minDate = e.target.value ? new Date(e.target.value) : null;
                setSearch((prev) => ({ ...prev, minDate }));
              }}
            />
            <p className="py-2">〜</p>
            <Form.Date
              value={search.maxDate ? toDateString(search.maxDate, 'YYYY-MM-DD') : ''}
              onChange={(e) => {
                const maxDate = e.target.value ? new Date(e.target.value) : null;
                setSearch((prev) => ({ ...prev, maxDate }));
              }}
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
                <Table.Cell>仕入番号</Table.Cell>
                <Table.Cell>発注日</Table.Cell>
                <Table.Cell></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {internalOrders.map((item, i) => {
                const date = toDateString(item.date.toDate(), 'YYYY-MM-DD');
                return (
                  <Table.Row key={i}>
                    <Table.Cell>{item.internalOrderNumber}</Table.Cell>
                    <Table.Cell>{date}</Table.Cell>
                    <Table.Cell>
                      <Link
                        to={`/internal_order_edit?shopCode=${item.shopCode}&internalOrderNumber=${item.internalOrderNumber}`}
                        className="mx-2"
                      >
                        <Button color="light" size="sm">
                          編集
                        </Button>
                      </Link>
                      <Button
                        color="light"
                        size="sm"
                        onClick={() => setTarget({ internalOrder: item, mode: 'modal' })}
                        className="mx-1"
                      >
                        詳細
                      </Button>
                      <Button
                        color="light"
                        size="sm"
                        onClick={() => setTarget({ internalOrder: item, mode: 'print' })}
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

export default InternalOrderList;
