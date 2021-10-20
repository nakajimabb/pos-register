import React, { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

import { Alert, Button, Card, Flex, Form } from './components';

const ImportProducts: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const ref = useRef<HTMLInputElement>(null);

  const getExcelData = async (blob: File) => {
    return new Promise<{ headers: (string | Date)[]; data: any[] }>(
      (resolve, reject) => {
        let headers: (string | Date)[] = [];
        const data: any[] = [];
        const reader = new FileReader();
        reader.onload = async (e: any) => {
          try {
            var fileData = reader.result;
            var wb = xlsx.read(fileData, {
              type: 'binary',
              raw: true,
              cellDates: true,
            });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const range_a1 = sheet['!ref'];
            if (range_a1) {
              const range = xlsx.utils.decode_range(range_a1);
              for (let r = range.s.r; r <= range.e.r; r++) {
                const rows: (string | Date)[] = [];
                for (let c = range.s.c; c <= range.e.c; c++) {
                  const p = xlsx.utils.encode_cell({ c, r });
                  const cell = sheet[p];
                  const cell_type = cell?.t;
                  if (cell_type === 'd') {
                    rows.push(cell.v as Date);
                  } else if (cell_type === 'n' && cell.v < 0) {
                    rows.push('-' + cell.w.replace(/[()]/g, ''));
                  } else {
                    rows.push(cell?.w || '');
                  }
                }
                if (r === 0) {
                  headers = rows;
                } else {
                  data.push(rows);
                }
              }
              resolve({ headers, data });
            }
          } catch (error) {
            reject(error);
          }
        };
        reader.readAsBinaryString(blob);
      }
    );
  };

  const importExcel = async (e: React.FormEvent) => {
    setError('');
    e.preventDefault();

    const files = ref?.current?.files;
    const blob = files && files[0];
    if (blob && blob.name) {
      setLoading(true);
      try {
        const { headers: headerNames, data } = await getExcelData(blob);
        const columns = new Map<string, string>([
          ['PLUコード', 'code'],
          ['商品名称', 'name'],
          ['商品名カナ', 'kana'],
          ['商品名略', 'abbr'],
          ['売価税抜', 'price'],
          ['備考', 'note'],
        ]);
        const headers = headerNames.map((name) => columns.get(String(name)));

        const db = getFirestore();

        console.log({ headerNames, headers, data });
        const tasks = data.map(async (row) => {
          try {
            const docData: { [key: string]: any } = {};
            headers.forEach((col, i) => {
              if (col) docData[col] = row[i];
            });
            await setDoc(doc(db, 'products', docData.code), docData);
            return { result: true };
          } catch (error) {
            return { result: false, error };
          }
        });
        const results = await Promise.all(tasks);
        const errors = results
          .filter((res) => !res.result)
          .map((res) => res.error);
        console.log({ count: results.length - errors.length, errors });
        setLoading(false);
      } catch (error) {
        setLoading(false);
        console.log({ error });
        setError('読み込みに失敗しました。');
      }
    }
  };

  return (
    <Flex
      direction="col"
      justify_content="center"
      align_items="center"
      className="h-screen"
    >
      <h1 className="text-xl font-bold mb-2">商品マスタ(共通)取込</h1>
      <Card className="p-5 w-96">
        <Form onSubmit={importExcel} className="p-3">
          <input
            type="file"
            name="ref"
            ref={ref}
            accept=".xlsx"
            disabled={loading}
            required
          />
          <Button className="w-full mt-4">取込実行</Button>
          {error && (
            <Alert severity="error" className="mt-4">
              {error}
            </Alert>
          )}
        </Form>
      </Card>
    </Flex>
  );
};

export default ImportProducts;
