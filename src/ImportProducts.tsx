import React, { useState, useRef } from 'react';
import { getFirestore, doc, getDocs, collection, writeBatch, DocumentReference } from 'firebase/firestore';

import { Alert, Button, Card, Flex, Form } from './components';
import { readExcelAsOjects, HeaderInfo } from './readExcel';
import firebaseError from './firebaseError';
import { Supplier } from './types';

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
        // EXCEL 読み込み
        const headerInfo: HeaderInfo = [
          { label: 'PLUコード', name: 'code' },
          { label: '商品名称', name: 'name' },
          { label: '商品かな名称', name: 'kana' },
          { label: '商品設定グループ', name: 'selfMedication', mapping: { '99': false, '3': true } },
          { label: '下代（原価）', name: 'costPrice', asNumber: true },
          { label: '売価', name: 'sellingPrice', asNumber: true },
          {
            label: '売価消費税タイプ（0：外税、1：内税、2：非課税）',
            name: 'sellingTaxClass',
            mapping: { '0': 'exclusive', '1': 'inclusive', '2': 'free' },
          },
          {
            label: '仕入消費税タイプ（0：外税、1：内税、2：非課税）',
            name: 'stockTaxClass',
            mapping: { '0': 'exclusive', '1': 'inclusive', '2': 'free' },
          },
          { label: '売価消費税パターン', name: 'sellingTax', mapping: { '1': 10, '2': 8 } },
          { label: '仕入消費税パターン', name: 'stockTax', mapping: { '1': 10, '2': 8 } },
          { label: '稼動フラグ（0:稼動、1:非稼動）', name: 'hidden', mapping: { '0': false, '1': true } },
          { label: '仕入先コード', name: 'supplierCode' },
          { label: '備考', name: 'note' },
          { label: '有効', name: 'valid', mapping: { '0': false, '1': false, '2': true } },
        ];
        const data = await readExcelAsOjects(blob, headerInfo);

        // 仕入れ先情報取得
        const suppliersRef = collection(db, 'suppliers');
        const suppliersSnap = await getDocs(suppliersRef);
        const supplierCodes = suppliersSnap.docs.map((item) => item.id);

        // 不明な仕入先コード
        const unknownSupplierCodes: string[] = [];
        data.forEach((item) => {
          const supCode = String(item.supplierCode);
          if (!supplierCodes.includes(supCode)) unknownSupplierCodes.push(supCode);
        });
        unknownSupplierCodes.sort((a, b) => +a - +b);

        // db 書き込み
        const BATCH_UNIT = 300;
        const taskSize = Math.ceil(data.length / BATCH_UNIT);
        const sequential = [...Array(taskSize)].map((_, i) => i);
        const tasks = sequential.map(async (_, i) => {
          try {
            let count = 0;
            let error = '';
            const batch = writeBatch(db);
            const sliced = data.slice(i * BATCH_UNIT, (i + 1) * BATCH_UNIT);

            sliced.forEach((item) => {
              if (item.valid) {
                const code = String(item.code);
                let supplierRef: DocumentReference<Supplier> | null = null;
                // 仕入先情報
                const supCode = String(item.supplierCode);
                if (item.supplierCode) {
                  const supCode2 = supplierCodes.includes(supCode) ? supCode : '0'; // 存在しなければ その他(0)
                  supplierRef = doc(db, 'suppliers', supCode2) as DocumentReference<Supplier>;
                }
                delete item.valid;
                delete item.supplierCode;
                batch.set(doc(db, 'products', code), { ...item, supplierRef }, { merge: true });
                count += 1;
              }
            });
            await batch.commit();
            return { count, error };
          } catch (error) {
            return { count: 0, error: firebaseError(error) };
          }
        });
        const results = await Promise.all(tasks);
        const count = results.reduce((cnt, res) => cnt + res.count, 0);
        const errors = results.filter((res) => !!res.error).map((res) => res.error);

        if (unknownSupplierCodes.length > 0) {
          const codes = Array.from(new Set(unknownSupplierCodes));
          errors.push(`仕入先がみつかりません(仕入先コード: ${codes.join(' ')})`);
        }

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
