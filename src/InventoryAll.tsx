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
import * as xlsx from 'xlsx';
import { Alert, Button, Card, Form, Table } from './components';
import { useAppContext } from './AppContext';
import InventoryPrint from './InventoryPrint';
import firebaseError from './firebaseError';
import { toDateString } from './tools';
import { Inventory } from './types';

const db = getFirestore();
type Status = '' | 'progress' | 'fixed' | 'untouched';

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
  const [target, setTarget] = useState<{ delivery: Inventory; mode: 'modal' | 'print' | 'excel' } | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [inventories, setInventories] = useState<Map<string, Inventory[]>>(new Map());
  const { registListner, shops } = useAppContext();

  useEffect(() => {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 10);
    minDate.setDate(1);
    setSearch((prev) => ({ ...prev, minDate }));
  }, []);

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
          const invts = targetInventory(shop.code, search.status);
          if (search.status === 'untouched') {
            return !invts || invts.length === 0;
          } else {
            return invts && invts.length > 0;
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

  const targetInventory = (shopCode: string, status: '' | 'progress' | 'fixed' | 'untouched') => {
    const invts = inventories.get(shopCode);
    if (invts && status) {
      if (status === 'progress') {
        return invts.filter((invt) => !invt.fixedAt);
      } else if (status === 'fixed') {
        return invts.filter((invt) => invt.fixedAt);
      }
    } else {
      return invts;
    }
  };

  const s2ab = (s: any) => {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i !== s.length; ++i) view[i] = s.charCodeAt(i) & 0xff;
    return buf;
  };

  const downloadExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataArray: string[][] = [];
    dataArray.push([
      'ｺｰﾄﾞ',
      '店舗名',
      '棚卸開始',
      '棚卸終了',
      'ｽﾃｰﾀｽ',
      '8%商品数',
      '8%金額',
      '10%商品数',
      '10%金額',
      '合計商品数',
      '合計金額',
    ]);

    sortedShops().forEach((shop, i) => {
      const invts = targetInventory(shop.code, search.status);
      if (invts) {
        invts.forEach((invt) => {
          const row: string[] = [];
          row.push(shop.code);
          row.push(shop.name);
          row.push(toDateString(invt?.date?.toDate(), 'MM/DD hh:mm'));
          row.push(invt.fixedAt ? toDateString(invt.fixedAt.toDate(), 'MM/DD hh:mm') : '');
          row.push(invt && invt.fixedAt ? '確定済' : '作業中');
          row.push(String(invt.sum[8]?.quantity ?? ''));
          row.push(String(invt.sum[8]?.amount ?? ''));
          row.push(String(invt.sum[10]?.quantity ?? ''));
          row.push(String(invt.sum[10]?.amount ?? ''));
          row.push(String(invt.sum[0]?.quantity ?? ''));
          row.push(String(invt.sum[0]?.amount ?? ''));
          dataArray.push(row);
        });
      } else {
        const row: string[] = [];
        row.push(shop.code);
        row.push(shop.name);
        row.push('', '', '未着手');
        dataArray.push(row);
      }
    });

    const sheet = xlsx.utils.aoa_to_sheet(dataArray);
    const wb = {
      SheetNames: ['Sheet1'],
      Sheets: { Sheet1: sheet },
    };
    const wb_out = xlsx.write(wb, { type: 'binary' });
    var blob = new Blob([s2ab(wb_out)], {
      type: 'application/octet-stream',
    });

    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `棚卸モニタ.xlsx`;
    link.click();
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
                { value: 'untouched', label: '未着手' },
              ]}
              onChange={(e) => setSearch((prev) => ({ ...prev, status: String(e.target.value) as Status }))}
            />
            <Button className="w-48">検索</Button>
            <Button className="w-48" onClick={downloadExcel}>
              Excel
            </Button>
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
                <Table.Cell>ｽﾃｰﾀｽ</Table.Cell>
                <Table.Cell>8%商品数</Table.Cell>
                <Table.Cell>8%金額</Table.Cell>
                <Table.Cell>10%商品数</Table.Cell>
                <Table.Cell>10%金額</Table.Cell>
                <Table.Cell>合計商品数</Table.Cell>
                <Table.Cell>合計金額</Table.Cell>
                <Table.Cell></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {sortedShops().map((shop, i) => {
                const invts = targetInventory(shop.code, search.status);
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
                        <Table.Cell>{invt && invt.fixedAt ? '確定済' : '作業中'}</Table.Cell>
                        <Table.Cell>{invt.sum[8]?.quantity}</Table.Cell>
                        <Table.Cell>{invt.sum[8]?.amount?.toLocaleString()}</Table.Cell>
                        <Table.Cell>{invt.sum[10]?.quantity}</Table.Cell>
                        <Table.Cell>{invt.sum[10]?.amount?.toLocaleString()}</Table.Cell>
                        <Table.Cell>{invt.sum[0]?.quantity}</Table.Cell>
                        <Table.Cell>{invt.sum[0]?.amount?.toLocaleString()}</Table.Cell>
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
                          <Button
                            color="light"
                            size="sm"
                            onClick={() => setTarget({ delivery: invt, mode: 'excel' })}
                            className="mx-1"
                          >
                            Excel
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
                      <Table.Cell></Table.Cell>
                      <Table.Cell></Table.Cell>
                      <Table.Cell>未着手</Table.Cell>
                      <Table.Cell></Table.Cell>
                      <Table.Cell></Table.Cell>
                      <Table.Cell></Table.Cell>
                      <Table.Cell></Table.Cell>
                      <Table.Cell></Table.Cell>
                      <Table.Cell></Table.Cell>
                      <Table.Cell></Table.Cell>
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
