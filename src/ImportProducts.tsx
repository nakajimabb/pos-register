import React, { useState, useRef } from 'react';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

import { Alert, Button, Card, Flex, Form } from './components';
import { readExcelAsOjects, HeaderInfo } from './readExcel';
import firebaseError from './firebaseError';

const db = getFirestore();

const ImportProducts: React.FC = () => {
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
          { label: 'PLUコード', name: 'code' },
          { label: '商品名称', name: 'name' },
          { label: '商品かな名称', name: 'kana' },
          { label: '商品設定グループ', name: 'productGroup', converter: { '99': 'general', '3': 'self-med' } },
          { label: '下代（原価）', name: 'costPrice', asNumber: true },
          { label: '売価', name: 'sellingPrice', asNumber: true },
          { label: '稼動フラグ（0:稼動、1:非稼動）', name: 'hidden', converter: { '0': false, '1': true } },
          { label: '仕入先コード', name: 'supplierCode' },
          { label: '備考', name: 'note' },
          { label: '有効', name: 'valid', converter: { '0': false, '1': false, '2': true } },
        ];
        const data = await readExcelAsOjects(blob, headerInfo);

        const tasks = data.map(async (item) => {
          try {
            if (item.code) {
              await setDoc(doc(db, 'products', String(item.code)), item);
              return { result: true };
            } else {
              throw Error(`PLUコードが存在しません: ${item.name}。`);
            }
          } catch (error) {
            return { result: false, error };
          }
        });
        const results = await Promise.all(tasks);
        const errors = results.filter((res) => !res.result).map((res) => firebaseError(res.error));

        const count = results.length - errors.length;
        console.log({ count, errors });
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
      <h1 className="text-xl font-bold mb-2">商品マスタ(共通)取込</h1>
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

export default ImportProducts;
