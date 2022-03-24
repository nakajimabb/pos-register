import React, { useState, useEffect } from 'react';
import {
  getFirestore,
  collectionGroup,
  getDocs,
  query,
  Query,
  QueryConstraint,
  limit,
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
type Status = '' | 'untouched' | 'progress' | 'fixed';

const InventoryList: React.FC = () => {
  const [search, setSearch] = useState<{
    shopCode: string;
    date: Date | null;
    status: Status;
    loaded: boolean;
  }>({
    shopCode: '',
    date: null,
    status: '',
    loaded: false,
  });
  const [target, setTarget] = useState<{ delivery: Inventory; mode: 'modal' | 'print' } | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [inventories, setInventories] = useState<Map<string, Inventory>>(new Map());
  const { registListner, shops } = useAppContext();

  useEffect(() => {
    const date = new Date();
    date.setDate(1);
    setSearch((prev) => ({ ...prev, date }));
  }, []);

  const queryInventories = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      registListner('shops');
      const conds: QueryConstraint[] = [limit(30)];
      if (search.date) conds.push(where('date', '>=', Timestamp.fromDate(search.date)));

      const q = query(collectionGroup(db, 'inventories'), ...conds) as Query<Inventory>;
      const snap = await getDocs(q);
      const items: Map<string, Inventory> = new Map();
      snap.docs.forEach((item) => {
        const invt = item.data();
        items.set(invt.shopCode, invt);
      });
      setInventories(items);
      setSearch((prev) => ({ ...prev, loaded: true }));
    } catch (error) {
      console.log({ error });
      alert(firebaseError(error));
    }
  };

  const sortedShops = () => {
    if (shops && search.loaded) {
      const results = Object.values(shops)
        .filter((shop) => !search.shopCode || shop.code === search.shopCode)
        .filter((shop) => {
          if (!search.status) return true;
          const invt = inventories.get(shop.code);
          if (search.status === 'untouched') {
            return !invt;
          } else if (search.status === 'progress') {
            return invt && !invt.fixedAt;
          } else {
            return invt && invt.fixedAt;
          }
        })
        .sort((shop1, shop2) => {
          if (shop1.code < shop2.code) return -1;
          else if (shop1.code > shop2.code) return 1;
          else return 0;
        });
      return results;
    } else return [];
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">棚卸モニタ</h1>
        <Card className="p-5 overflow-visible">
          {target && (
            <InventoryPrint
              mode={target.mode}
              shopCode={target.delivery.shopCode}
              date={target.delivery.date.toDate()}
              onClose={() => setTarget(null)}
            />
          )}
          <Form className="flex space-x-2 mb-2" onSubmit={queryInventories}>
            <Form.Date
              value={search.date ? toDateString(search.date, 'YYYY-MM-DD') : ''}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : null;
                setSearch((prev) => ({ ...prev, date }));
              }}
            />
            <Form.Select
              className="mb-3 sm:mb-0"
              value={search.status}
              options={[
                { value: '', label: '-- ｽﾃｰﾀｽ --' },
                { value: 'untouched', label: '未着手' },
                { value: 'progress', label: '作業中' },
                { value: 'fixed', label: '確定済' },
              ]}
              onChange={(e) => setSearch((prev) => ({ ...prev, status: String(e.target.value) as Status }))}
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
                <Table.Cell>ｺｰﾄﾞ</Table.Cell>
                <Table.Cell>店舗名</Table.Cell>
                <Table.Cell>棚卸開始</Table.Cell>
                <Table.Cell>棚卸終了</Table.Cell>
                <Table.Cell>金額</Table.Cell>
                <Table.Cell>ｽﾃｰﾀｽ</Table.Cell>
                <Table.Cell></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {sortedShops().map((shop, i) => {
                const item = inventories.get(shop.code);
                return (
                  <Table.Row key={i}>
                    <Table.Cell>{shop.code}</Table.Cell>
                    <Table.Cell>{shop.name}</Table.Cell>
                    {item && (
                      <>
                        <Table.Cell>{toDateString(item.date.toDate(), 'MM/DD hh:mm')}</Table.Cell>
                        <Table.Cell>{item.fixedAt && toDateString(item.fixedAt.toDate(), 'MM/DD hh:mm')}</Table.Cell>
                        <Table.Cell>{item.sum && item.sum[0].amount?.toLocaleString()}</Table.Cell>
                        <Table.Cell>{item && item.fixedAt ? '確定済' : '作業中'}</Table.Cell>
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
                      </>
                    )}
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
