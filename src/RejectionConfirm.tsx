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
  collectionGroup,
  DocumentData,
} from 'firebase/firestore';
import Select from 'react-select';
import { Alert, Button, Card, Form, Table } from './components';
import RejectionPrint from './RejectionPrint';
import { useAppContext } from './AppContext';
import { nameWithCode, toDateString } from './tools';
import firebaseError from './firebaseError';
import { Rejection } from './types';

const db = getFirestore();

const RejectionConfirm: React.FC = () => {
  const [search, setSearch] = useState<{
    status: string;
    shopCode: string;
    minDate: Date | null;
    maxDate: Date | null;
  }>({
    status: 'submitted',
    shopCode: '',
    minDate: null,
    maxDate: null,
  });
  const [target, setTarget] = useState<{ rejection: Rejection; mode: 'modal' | 'print' } | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string }[]>([]);
  const { currentShop, shops, registListner } = useAppContext();

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const statusOptions = [
    { label: '申請中', value: 'submitted' },
    { label: '全て', value: 'all' },
  ];

  const queryRejections = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
        conds.push(where('submitted', '==', true));
        if (search.status == 'submitted') {
          conds.push(where('fixed', '==', false));
        }
        conds.push(orderBy('date', 'desc'));

        let q: Query<DocumentData>;
        if (search.shopCode) {
          q = query(collection(db, 'shops', search.shopCode, 'rejections'), ...conds);
        } else {
          q = query(collectionGroup(db, 'rejections'), ...conds);
        }
        const snap = await getDocs(q);
        setRejections(snap.docs.map((item) => item.data() as Rejection));
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  useEffect(() => {
    registListner('shops');
  }, []);

  useEffect(() => {
    const options = Array.from(shops.entries()).map(([code, shop]) => ({
      value: code,
      label: nameWithCode(shop),
    }));
    options.unshift({ label: '', value: '' });
    setShopOptions(options);
  }, [shops]);

  useEffect(() => {
    queryRejections();
  }, []);

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">廃棄・返品承認</h1>
        <Card className="p-5 overflow-visible">
          {target && currentShop && (
            <RejectionPrint
              mode={target.mode}
              shopCode={target.rejection.shopCode}
              rejectionNumber={target.rejection.rejectionNumber}
              onClose={() => setTarget(null)}
            />
          )}
          <Form className="flex space-x-2 mb-2" onSubmit={queryRejections}>
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
            <Select
              value={selectValue(search.status, statusOptions)}
              options={statusOptions}
              onChange={(e) => {
                setSearch((prev) => ({ ...prev, status: String(e?.value) }));
              }}
              className="mb-3 sm:mb-0 w-36"
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
                <Table.Cell>廃棄番号</Table.Cell>
                <Table.Cell>申請日</Table.Cell>
                <Table.Cell>店舗コード</Table.Cell>
                <Table.Cell>店舗名</Table.Cell>
                <Table.Cell>商品種</Table.Cell>
                <Table.Cell>商品数</Table.Cell>
                <Table.Cell>金額(税抜)</Table.Cell>
                <Table.Cell>ステータス</Table.Cell>
                <Table.Cell></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {rejections.map((item, i) => {
                const date = toDateString(item.date.toDate(), 'YYYY-MM-DD');
                return (
                  <Table.Row key={i}>
                    <Table.Cell>{item.rejectionNumber}</Table.Cell>
                    <Table.Cell>{date}</Table.Cell>
                    <Table.Cell>{item.shopCode}</Table.Cell>
                    <Table.Cell>{item.shopName}</Table.Cell>
                    <Table.Cell>{item.totalVariety}</Table.Cell>
                    <Table.Cell>{item.totalQuantity}</Table.Cell>
                    <Table.Cell>{item.totalAmount?.toLocaleString()}</Table.Cell>
                    <Table.Cell>{item.submitted ? (item.fixed ? '承認済' : '申請中') : ''}</Table.Cell>
                    <Table.Cell>
                      <Link
                        to={`/rejection_edit?shopCode=${item.shopCode}&rejectionNumber=${item.rejectionNumber}&confirmMode=true`}
                        className="mx-2"
                      >
                        <Button color="light" size="sm">
                          編集
                        </Button>
                      </Link>
                      <Button
                        color="light"
                        size="sm"
                        onClick={() => setTarget({ rejection: item, mode: 'modal' })}
                        className="mx-1"
                      >
                        詳細
                      </Button>
                      <Button
                        color="light"
                        size="sm"
                        onClick={() => setTarget({ rejection: item, mode: 'print' })}
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

export default RejectionConfirm;
