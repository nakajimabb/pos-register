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
import { nameWithCode, toDateString } from './tools';
import firebaseError from './firebaseError';
import { Purchase } from './types';

const db = getFirestore();

const PurchaseList: React.FC = () => {
  const [target, setTarget] = useState<{ supplierCode: string; date: Date | null }>({
    supplierCode: '',
    date: null,
  });
  const [supplierOptions, setSuppliersOptions] = useState<{ label: string; value: string }[]>([]);
  const [messages, setMessages] = useState<string[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const { registListner, suppliers, currentShop } = useAppContext();

  useEffect(() => {
    if (suppliers) {
      const options = Object.entries(suppliers).map(([code, supplier]) => ({
        value: code,
        label: nameWithCode(supplier),
      }));
      options.unshift({ label: '', value: '' });
      setSuppliersOptions(options);
    }
  }, [suppliers]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const queryPurchases = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentShop) {
      try {
        const conds: QueryConstraint[] = [limit(30)];

        if (target.date) {
          conds.push(where('date', '==', Timestamp.fromDate(target.date)));
        } else {
          conds.push(orderBy('date', 'desc'));
        }
        if (target.supplierCode) conds.push(where('supplierCode', '==', target.supplierCode));

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
          <Form className="flex space-x-2 mb-2" onSubmit={queryPurchases}>
            <Form.Date
              value={target.date ? toDateString(target.date, 'YYYY-MM-DD') : ''}
              onChange={(e) => {
                setTarget((prev) => ({ ...prev, date: new Date(e.target.value) }));
              }}
            />
            <Select
              value={selectValue(target.supplierCode, supplierOptions)}
              options={supplierOptions}
              onMenuOpen={() => {
                registListner('suppliers');
              }}
              onChange={(e) => {
                setTarget((prev) => ({ ...prev, supplierCode: String(e?.value) }));
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
                    <Table.Cell>{i + 1}</Table.Cell>
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
