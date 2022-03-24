import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

import { Alert, Button, Card, Flex, Form, Table } from './components';
import { readExcelAsOjects, HeaderInfo } from './readExcel';
import firebaseError from './firebaseError';
import { stockPath } from './types';

const db = getFirestore();

const headerInfo: HeaderInfo = [
  { label: '店舗コード', name: 'shopCode', zeroPadding: 2 },
  { label: 'PLUコード', name: 'productCode' },
  { label: '商品名', name: 'productName' },
  { label: '商品名称', name: 'productName' },
  { label: '在庫数量', name: 'quantity' },
  { label: '現在庫', name: 'quantity' },
];

const ImportStock: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState('');
  const [headerDisp, setHeaderDisp] = useState<Map<string, Set<string>>>(new Map());
  const [errors, setErrors] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const disp: Map<string, Set<string>> = new Map();
    headerInfo.forEach(({ label, name }) => {
      const item = disp.get(name);
      if (item) {
        item.add(label);
        disp.set(name, item);
      } else {
        disp.set(name, new Set([label]));
      }
    });
    setHeaderDisp(disp);
  }, []);

  const importExcel = async (e: React.FormEvent) => {
    setMessage('');
    setErrors([]);
    e.preventDefault();

    const files = ref?.current?.files;
    const blob = files && files[0];
    if (blob && blob.name) {
      setLoading(true);
      try {
        const data = await readExcelAsOjects(blob, headerInfo, false);
        // console.log({ data });

        // check products exists
        const checks = Array.from(data).map(async (item, i) => {
          const snap = await getDoc(doc(db, 'products', String(item.productCode)));
          return { productCode: item.productCode, productName: item.productName, exists: snap.exists() };
        });
        const checkResults = await Promise.all(checks);
        const noneProductCodes = checkResults.filter((item) => !item.exists).map((item) => item.productCode);
        const errs = checkResults
          .filter((item) => !item.exists)
          .map((item) => `${item.productName}(${item.productCode})`);
        if (errs.length > 0) {
          setErrors((prev) => [...prev, '● 商品マスタが登録されていません。', ...errs]);
        }

        // db 書き込み
        const BATCH_UNIT = 300;
        const taskSize = Math.ceil(data.length / BATCH_UNIT);
        const sequential = [...Array(taskSize)].map((_, i) => i);
        const tasks = sequential.map(async (_, i) => {
          try {
            const batch = writeBatch(db);
            const sliced = data
              .slice(i * BATCH_UNIT, (i + 1) * BATCH_UNIT)
              .filter((item) => !noneProductCodes.includes(String(item.productCode)));
            sliced.forEach((item) => {
              const quantity = +item.quantity;
              if (isNaN(quantity))
                throw Error(`不正な在庫数。${item.productCode} ${item.productName} ${item.quantity}`);
              const path = stockPath(String(item.shopCode), String(item.productCode));
              batch.set(doc(db, path), { ...item, quantity: +quantity, updatedAt: serverTimestamp() });
            });
            await batch.commit();
            return { count: sliced.length, error: '' };
          } catch (error) {
            return { count: 0, error: firebaseError(error) };
          }
        });

        const results = await Promise.all(tasks);
        const count = results.reduce((cnt, res) => cnt + res.count, 0);
        const errors = results.filter((res) => !!res.error).map((res) => res.error);
        setMessage(`${count}件のデータを読み込みました。`);
        if (errors.length > 0) setErrors((prev) => [...errors]);

        setLoading(false);
      } catch (error) {
        setLoading(false);
        console.log({ error });
        setErrors([firebaseError(error)]);
      }
    }
  };

  return (
    <Flex direction="col" justify_content="center" align_items="center" className="h-screen">
      <h1 className="text-xl font-bold mb-2">在庫数取込</h1>
      <Card className="p-5">
        <Form onSubmit={importExcel} className="p-3">
          <input type="file" name="ref" ref={ref} accept=".xlsx,.xls" disabled={loading} required />
          <Button disabled={loading} className="w-full mt-4">
            取込実行
          </Button>
          {message && (
            <Alert severity="success" className="mt-4">
              {message}
            </Alert>
          )}
          {errors.length > 0 && (
            <Alert severity="error" className="mt-4">
              {errors.map((err) => (
                <p>{err}</p>
              ))}
            </Alert>
          )}
          <h2 className="mt-6">
            認識されるヘッダ<small>(前方一致)</small>
          </h2>
          <Table size="sm">
            <Table.Body>
              {Array.from(headerDisp.entries()).map(([name, item]) => (
                <Table.Row>
                  <Table.Cell>{name}</Table.Cell>
                  <Table.Cell>{Array.from(item).join(' | ')}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Form>
      </Card>
    </Flex>
  );
};

export default ImportStock;
