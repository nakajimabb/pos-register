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
type Status = '' | 'progress' | 'fixed';

const InventoryList: React.FC = () => {
  const [search, setSearch] = useState<{
    minDate: Date | null;
    maxDate: Date | null;
    status: Status;
    loaded: boolean;
  }>({
    minDate: null,
    maxDate: null,
    status: '',
    loaded: false,
  });
  const [target, setTarget] = useState<{ delivery: Inventory; mode: 'modal' | 'print' } | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [inventories, setInventories] = useState<Map<string, Inventory[]>>(new Map());
  const { registListner, shops } = useAppContext();

  useEffect(() => {
    const minDate = new Date();
    minDate.setDate(1);
    setSearch((prev) => ({ ...prev, minDate }));
  }, []);

  const existSearch = () => search.minDate || search.maxDate || search.status;

  const queryInventories = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      registListner('shops');
      const conds: QueryConstraint[] = [limit(30)];
      if (search.minDate) {
        conds.push(where('date', '>=', Timestamp.fromDate(search.minDate)));
      }
      if (search.maxDate) {
        const date = new Date(search.maxDate);
        date.setDate(date.getDate() + 1);
        conds.push(where('date', '<=', Timestamp.fromDate(date)));
      }

      const q = query(collectionGroup(db, 'inventories'), ...conds) as Query<Inventory>;
      const snap = await getDocs(q);
      const items: Map<string, Inventory[]> = new Map();
      snap.docs.forEach((item) => {
        const invt = item.data();
        const prev = items.get(invt.shopCode);
        items.set(invt.shopCode, prev ? [...prev, invt] : [invt]);
      });
      setInventories(items);
      setSearch((prev) => ({ ...prev, loaded: true }));
    } catch (error) {
      console.log({ error });
      alert(firebaseError(error));
    }
  };

  const sortedShops = () => {
    if (search.loaded) {
      const targetShops = Array.from(shops.values());
      const results = targetShops
        .filter((shop) => {
          if (!search.status) return true;
          const invts = targetInventory(shop.code);
          return invts && invts.length > 0;
        })
        .sort((shop1, shop2) => {
          if (shop1.code < shop2.code) return -1;
          else if (shop1.code > shop2.code) return 1;
          else return 0;
        });
      return results;
    } else return [];
  };

  const targetInventory = (shopCode: string) => {
    const invts = inventories.get(shopCode);
    if (invts && search.status) {
      if (search.status === 'progress') {
        return invts.filter((invt) => !invt.fixedAt);
      } else {
        return invts.filter((invt) => invt.fixedAt);
      }
    } else {
      return invts;
    }
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
            <Form.Select
              className="mb-3 sm:mb-0"
              value={search.status}
              options={[
                { value: '', label: '-- ｽﾃｰﾀｽ --' },
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
                const invts = targetInventory(shop.code);
                if (invts) {
                  const rowSpan = Math.max(invts.length, 1);
                  return (
                    invts &&
                    invts.map((invt, i) => (
                      <Table.Row key={i}>
                        {i === 0 && <Table.Cell rowSpan={rowSpan}>{shop.code}</Table.Cell>}
                        {i === 0 && <Table.Cell rowSpan={rowSpan}>{shop.name}</Table.Cell>}
                        <Table.Cell>{toDateString(invt?.date?.toDate(), 'MM/DD hh:mm')}</Table.Cell>
                        <Table.Cell>{invt.fixedAt && toDateString(invt.fixedAt.toDate(), 'MM/DD hh:mm')}</Table.Cell>
                        <Table.Cell>{invt.sum && invt.sum[0]?.amount?.toLocaleString()}</Table.Cell>
                        <Table.Cell>{invt && invt.fixedAt ? '確定済' : '作業中'}</Table.Cell>
                        <Table.Cell>
                          <Button
                            color="light"
                            size="sm"
                            onClick={() => setTarget({ delivery: invt, mode: 'modal' })}
                            className="mx-1"
                          >
                            詳細
                          </Button>
                          <Button
                            color="light"
                            size="sm"
                            onClick={() => setTarget({ delivery: invt, mode: 'print' })}
                            className="mx-1"
                          >
                            印刷
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))
                  );
                } else {
                  return (
                    <Table.Row key={i}>
                      <Table.Cell>{shop.code}</Table.Cell>
                      <Table.Cell>{shop.name}</Table.Cell>
                    </Table.Row>
                  );
                }
              })}
            </Table.Body>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default InventoryList;
