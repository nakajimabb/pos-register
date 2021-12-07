import React, { useState, useRef } from 'react';
import { getFirestore, doc, setDoc, writeBatch } from 'firebase/firestore';

import { Alert, Button, Card, Flex, Form } from './components';
import { readExcelAsOjects, HeaderInfo } from './readExcel';
import firebaseError from './firebaseError';

const db = getFirestore();

const ImportSuppliers: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const ref = useRef<HTMLInputElement>(null);

  const importExcel = async (e: React.FormEvent) => {
    setMessage('');
    setErrors([]);
    e.preventDefault();

    const files = ref?.current?.files;
    const blob = files && files[0];
    if (blob && blob.name) {
      setLoading(true);
      try {
        const headerInfo: HeaderInfo = [
          { label: '仕入先コード', name: 'code' },
          { label: '仕入先名', name: 'name' },
        ];
        const data = await readExcelAsOjects(blob, headerInfo);
        console.log({ data });

        // db 書き込み
        const BATCH_UNIT = 300;
        const taskSize = Math.ceil(data.length / BATCH_UNIT);
        const sequential = [...Array(taskSize)].map((_, i) => i);
        const tasks = sequential.map(async (_, i) => {
          try {
            const batch = writeBatch(db);
            const sliced = data.slice(i * BATCH_UNIT, (i + 1) * BATCH_UNIT);
            sliced.forEach((item) => {
              delete item.valid;
              const code = String(item.code);
              batch.set(doc(db, 'suppliers', code), item, { merge: true });
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
        if (errors.length > 0) setErrors(errors);

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
      <h1 className="text-xl font-bold mb-2">仕入先マスタ取込</h1>
      <Card className="p-5 w-96">
        <Form onSubmit={importExcel} className="p-3">
          <input type="file" name="ref" ref={ref} accept=".xlsx" disabled={loading} required />
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
        </Form>
      </Card>
    </Flex>
  );
};

export default ImportSuppliers;
