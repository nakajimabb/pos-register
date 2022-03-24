import React, { useState } from 'react';
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
import InventoryPrint from './InventoryPrint';
import firebaseError from './firebaseError';
import { toDateString } from './tools';
import { Inventory } from './types';

const db = getFirestore();

const InventoryList: React.FC = () => {
  const [search, setSearch] = useState<{ shopCode: string; minDate: Date | null; maxDate: Date | null }>({
    shopCode: '',
    minDate: null,
    maxDate: null,
  });
  const [target, setTarget] = useState<{ delivery: Inventory; mode: 'modal' | 'print' } | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const { currentShop } = useAppContext();

  const queryInventories = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentShop) {
      try {
        const conds: QueryConstraint[] = [limit(30)];

        if (search.minDate) {
          conds.push(where('date', '>=', Timestamp.fromDate(search.minDate)));
        }
        if (search.maxDate) {
          const date = new Date(search.maxDate);
          date.setDate(date.getDate() + 1);
          conds.push(where('date', '<=', Timestamp.fromDate(date)));
        }
        conds.push(orderBy('date', 'desc'));

        if (search.shopCode) conds.push(where('dstShopCode', '==', search.shopCode));

        const q = query(collection(db, 'shops', currentShop.code, 'inventories'), ...conds) as Query<Inventory>;
        const snap = await getDocs(q);
        setInventories(snap.docs.map((item) => item.data()));
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">棚卸一覧</h1>
        <Card className="p-5 overflow-visible">
          {target && currentShop && (
            <InventoryPrint
              mode={target.mode}
              shopCode={target.delivery.shopCode}
              date={target.delivery.date.toDate()}
              onClose={() => setTarget(null)}
            />
          )}
          <Form className="flex space-x-2 mb-2" onSubmit={queryInventories}>
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
                <Table.Cell>棚卸日</Table.Cell>
                <Table.Cell>作業期間</Table.Cell>
                <Table.Cell>ｽﾃｰﾀｽ</Table.Cell>
                <Table.Cell></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {inventories.map((item, i) => {
                const date = item.date.toDate();
                const dateStr = toDateString(date, 'YYYY-MM-DD');
                return (
                  <Table.Row key={i}>
                    <Table.Cell>{dateStr}</Table.Cell>
                    <Table.Cell>
                      {toDateString(item.date.toDate(), 'MM/DD hh:mm')}〜
                      {item.fixedAt && toDateString(item.fixedAt.toDate(), 'MM/DD hh:mm')}
                    </Table.Cell>
                    <Table.Cell>{!!item.fixedAt ? '確定済' : '作業中'}</Table.Cell>
                    <Table.Cell>
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

export default InventoryList;
