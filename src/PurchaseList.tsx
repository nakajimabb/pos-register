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
import PurchasePrint from './PurchasePrint';
import { useAppContext } from './AppContext';
import { nameWithCode, toDateString } from './tools';
import firebaseError from './firebaseError';
import { Purchase } from './types';

const db = getFirestore();

const PurchaseList: React.FC = () => {
  const [search, setSearch] = useState<{ date: Date | null }>({
    date: null,
  });
  const [target, setTarget] = useState<{ purchase: Purchase; mode: 'modal' | 'print' } | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const { currentShop } = useAppContext();

  const queryPurchases = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentShop) {
      try {
        const conds: QueryConstraint[] = [limit(30)];

        if (search.date) {
          conds.push(where('date', '==', Timestamp.fromDate(search.date)));
        } else {
          conds.push(orderBy('date', 'desc'));
        }

        const q = query(collection(db, 'shops', currentShop.code, 'purchases'), ...conds) as Query<Purchase>;
        const snap = await getDocs(q);
        setPurchases(snap.docs.map((item) => item.data()));
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">仕入一覧</h1>
        <Card className="p-5 overflow-visible">
          {target && currentShop && (
            <PurchasePrint
              mode={target.mode}
              shopCode={target.purchase.shopCode}
              purchaseNumber={target.purchase.purchaseNumber}
              onClose={() => setTarget(null)}
            />
          )}
          <Form className="flex space-x-2 mb-2" onSubmit={queryPurchases}>
            <Form.Date
              value={search.date ? toDateString(search.date, 'YYYY-MM-DD') : ''}
              onChange={(e) => {
                setSearch((prev) => ({ ...prev, date: new Date(e.target.value) }));
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
                <Table.Cell>仕入日</Table.Cell>
                <Table.Cell>仕入先</Table.Cell>
                <Table.Cell></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {purchases.map((item, i) => {
                const date = toDateString(item.date.toDate(), 'YYYY-MM-DD');
                return (
                  <Table.Row key={i}>
                    <Table.Cell>{item.purchaseNumber}</Table.Cell>
                    <Table.Cell>{date}</Table.Cell>
                    <Table.Cell>{item.srcName}</Table.Cell>
                    <Table.Cell>
                      <Link
                        to={`/purchase_edit?shopCode=${item.shopCode}&purchaseNumber=${item.purchaseNumber}`}
                        className="mx-2"
                      >
                        <Button color="light" size="sm">
                          編集
                        </Button>
                      </Link>
                      <Button
                        color="light"
                        size="sm"
                        onClick={() => setTarget({ purchase: item, mode: 'modal' })}
                        className="mx-1"
                      >
                        詳細
                      </Button>
                      <Button
                        color="light"
                        size="sm"
                        onClick={() => setTarget({ purchase: item, mode: 'print' })}
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

export default PurchaseList;
