import React, { useEffect, useState, useRef } from 'react';
import {
  getFirestore,
  doc,
  getDocs,
  collection,
  writeBatch,
  query,
  QueryConstraint,
  DocumentReference,
  serverTimestamp,
  QuerySnapshot,
  where,
} from 'firebase/firestore';

import { Alert, Button, Card, Flex, Form, Table, Progress } from './components';
import { readExcelAsOjects, HeaderInfo, FieldType } from './readExcel';
import { useAppContext } from './AppContext';
import firebaseError from './firebaseError';
import { Product, Supplier, productSellingPricePath, productCostPricePath } from './types';
import { checkDigit, arrToPieces, isNum } from './tools';

const db = getFirestore();

const headerInfo: HeaderInfo = [
  { label: '店舗コード', name: 'shopCode', zeroPadding: 2 },
  { label: 'PLUコード', name: 'code' },
  { label: '商品名称', name: 'name' },
  { label: '商品かな名称', name: 'kana' },
  {
    label: '商品設定グループ',
    name: 'selfMedication',
    mapping: { '99': false, '3': true },
    comment: '99: 無効, 3: 有効',
  },
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
  { label: '売価消費税パターン', name: 'sellingTax', mapping: { '1': 10, '2': 8 }, comment: '1: 10%, 2: 8%' },
  { label: '仕入消費税パターン', name: 'stockTax', mapping: { '1': 10, '2': 8 }, comment: '1: 10%, 2: 8%' },
  { label: '稼動フラグ（0:稼動、1:非稼動）', name: 'hidden', mapping: { '0': false, '1': true } },
  { label: '仕入先コード', name: 'supplierCode' },
  { label: '備考', name: 'note' },
  { label: '作成日時', name: 'createdAt' },
  { label: '更新日時', name: 'updatedAt' },
];

type HeaderDisp = { labels: string[]; comment: string };

const ImportProducts: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [progress, setProgress] = useState(100);
  const [headerDisp, setHeaderDisp] = useState<Map<string, HeaderDisp>>(new Map());
  const [errors, setErrors] = useState<string[]>([]);
  const [overwrite, setOverwrite] = useState<boolean>(false);
  const { registListner, shops, suppliers } = useAppContext();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registListner('suppliers');
    registListner('shops');
  }, []);

  useEffect(() => {
    const disp: Map<string, HeaderDisp> = new Map();
    headerInfo.forEach(({ label, name, comment }) => {
      const item = disp.get(name);
      if (item) {
        item.labels.push(label);
        item.comment = comment ?? '';
        disp.set(name, item);
      } else {
        disp.set(name, { labels: [label], comment: comment ?? '' });
      }
    });
    setHeaderDisp(disp);
  }, []);

  const importExcel = async (e: React.FormEvent) => {
    setMessages([]);
    setErrors([]);
    e.preventDefault();

    const files = ref?.current?.files;
    const blob = files && files[0];
    if (blob && blob.name) {
      setLoading(true);
      setProgress(0);
      try {
        // EXCEL 読み込み
        const data = await readExcelAsOjects(blob, headerInfo);
        const validData = data.filter((item) => !!item.code);

        const unknownSupplierCodes = new Set<string>(); // 不明な仕入先コード
        const unknownShopCodes = new Set<string>(); // 不明な店舗コード
        const ngJanCodes = new Set<string>(); // 不正なJANコード

        const productCodes = new Set(validData.map((item) => String(item.code)));
        const products = await readProducts(productCodes);

        // db 書き込み
        const headCode = '00'; // 本部コード
        const BATCH_UNIT = 300;
        const pieces: { [key: string]: FieldType }[][] = arrToPieces(validData, BATCH_UNIT);
        const tasks = pieces.map(async (pdcts) => {
          const errors: string[] = [];
          const counter = { addProducts: 0, updateProducts: 0, setSellingPrices: 0, setCostPrices: 0 };
          try {
            // 商品マスタ（共通）保存
            const batch1 = writeBatch(db);
            pdcts.forEach((item) => {
              const pdct = { ...item }; // copy
              const productCode = String(pdct.code);
              // 商品マスタが存在しないか、上書きモードでかつ店舗コードが本部(00)またはブランクのときのみ保存する
              if (!products.has(productCode) || (overwrite && (!productCode || productCode === headCode))) {
                const suppCode = String(pdct.supplierCode ?? '');
                const existSupplier = suppCode && suppliers.has(suppCode);
                if (!existSupplier) unknownSupplierCodes.add(suppCode);
                const supplierCode = existSupplier ? suppCode : '0';
                const supplierRef = doc(db, 'suppliers', supplierCode) as DocumentReference<Supplier>;
                // 保存しないフィールドを削除
                headerInfo.forEach((info) => {
                  if (pdct[info.name] === undefined) delete pdct[info.name];
                });
                delete pdct.shopCode;
                delete pdct.supplierCode;

                // 保存
                const ref = doc(db, 'products', productCode);
                const product = products.get(String(pdct.code));
                const updatedAt = pdct.updatedAt instanceof Date ? pdct.updatedAt : serverTimestamp();
                // 移動平均原価
                if ((!product || !product.avgCostPrice) && isNum(pdct.costPrice)) {
                  pdct.avgCostPrice = Number(pdct.costPrice);
                }
                if (product) {
                  delete pdct.createdAt;
                  batch1.set(ref, { ...pdct, supplierRef, updatedAt }, { merge: true });
                  counter.updateProducts++;
                } else {
                  if (checkDigit(productCode)) {
                    const createdAt = pdct.createdAt instanceof Date ? pdct.createdAt : serverTimestamp();
                    batch1.set(
                      ref,
                      {
                        ...pdct,
                        supplierRef,
                        unregistered: false, // 未登録フラグの設定は無効
                        createdAt,
                        updatedAt,
                      },
                      { merge: true }
                    );
                    counter.addProducts++;
                  } else {
                    ngJanCodes.add(productCode);
                  }
                }
              }
            });
            await batch1.commit();
            setProgress((prev) => prev + Math.floor(100.0 / (3 * pieces.length))); // 進捗更新
            console.log('batch1 executed');

            // 店舗売価
            const batch2 = writeBatch(db);
            pdcts.forEach((item) => {
              const pdct = { ...item }; // copy
              const productCode = String(pdct.code);
              // 店舗チェック
              const shopCode = String(pdct.shopCode ?? '');
              const existShop = shopCode && shops.has(shopCode);
              if (!existShop) unknownShopCodes.add(shopCode);
              // 保存
              if (existShop && checkDigit(productCode) && isNum(pdct.sellingPrice)) {
                const productName =
                  overwrite && (!productCode || productCode === headCode)
                    ? String(pdct.name)
                    : products.get(productCode)?.name ?? String(pdct.name);
                const updatedAt = pdct.updatedAt instanceof Date ? pdct.updatedAt : serverTimestamp();
                const path = productSellingPricePath(shopCode, productCode);
                batch2.set(doc(db, path), {
                  shopCode,
                  productCode,
                  productName,
                  sellingPrice: Number(pdct.sellingPrice),
                  updatedAt,
                });
                counter.setSellingPrices++;
              }
            });
            await batch2.commit();
            setProgress((prev) => prev + Math.floor(100.0 / (3 * pieces.length))); // 進捗更新
            console.log('batch2 executed');

            // 店舗原価
            const batch3 = writeBatch(db);
            pdcts.forEach((item) => {
              const pdct = { ...item }; // copy
              const productCode = String(pdct.code);
              // 店舗チェック
              const shopCode = String(pdct.shopCode ?? '');
              const existShop = shopCode && shops.has(shopCode);
              if (!existShop) unknownShopCodes.add(shopCode);
              // 仕入先チェック
              const suppCode = String(pdct.supplierCode ?? '');
              const existSupplier = suppCode && suppliers.has(suppCode);
              if (!existSupplier) unknownSupplierCodes.add(suppCode);
              const supplierCode = existSupplier ? suppCode : '0';
              const supplierName = suppliers.get(supplierCode)?.name ?? '';

              if (existShop && checkDigit(productCode) && isNum(pdct.costPrice)) {
                const productName =
                  overwrite && (!productCode || productCode === headCode)
                    ? String(pdct.name)
                    : products.get(productCode)?.name ?? String(pdct.name);
                const path = productCostPricePath(shopCode, productCode, supplierCode);
                const updatedAt = pdct.updatedAt instanceof Date ? pdct.updatedAt : serverTimestamp();
                batch3.set(doc(db, path), {
                  shopCode,
                  productCode,
                  productName,
                  supplierCode,
                  supplierName,
                  costPrice: Number(pdct.costPrice),
                  updatedAt,
                });
                counter.setCostPrices++;
              }
            });
            await batch3.commit();
            console.log('batch3 executed');

            setProgress((prev) => prev + Math.floor(100.0 / (3 * pieces.length))); // 進捗更新
          } catch (error) {
            console.log({ error });
            errors.push(firebaseError(error));
          }
          return { counter, errors };
        });
        const results = await Promise.all(tasks);

        // 結果の集計
        const errors: string[] = [];
        const counter = { addProducts: 0, updateProducts: 0, setSellingPrices: 0, setCostPrices: 0 };
        results.forEach((result) => {
          const cntr = result.counter;
          counter.addProducts += cntr.addProducts;
          counter.updateProducts += cntr.updateProducts;
          counter.setSellingPrices += cntr.setSellingPrices;
          counter.setCostPrices += cntr.setCostPrices;
          errors.push(...result.errors);
        });
        console.log({ errors, counter });

        if (errors.length > 0) setErrors((prev) => [...prev, ...errors]);
        if (unknownShopCodes.size > 0) {
          const codes = Array.from(unknownShopCodes).filter((code) => code && code != headCode);
          if (codes.length > 0) setErrors((prev) => [...prev, `不明な店舗コード: ${codes.join(', ')}`]);
        }
        if (ngJanCodes.size > 0) {
          const codes = Array.from(ngJanCodes);
          setErrors((prev) => [...prev, `不正なJANコード: ${codes.join(', ')}`]);
        }
        if (unknownSupplierCodes.size > 0) {
          const codes = Array.from(new Set(unknownSupplierCodes)).filter((code) => !!code);
          setErrors((prev) => [...prev, '不明な仕入先は「その他(0)」で登録しました。']);
          if (codes.length > 0) setErrors((prev) => [...prev, `不明な仕入先コード: ${codes.join(', ')}`]);
        }

        setMessages([
          'データを読み込みました。',
          `商品マスタ追加: ${counter.addProducts}件`,
          `商品マスタ更新: ${counter.updateProducts}件`,
          `店舗売価更新: ${counter.setSellingPrices}件`,
          `店舗原価更新: ${counter.setCostPrices}件`,
        ]);

        setLoading(false);
      } catch (error) {
        setLoading(false);
        console.log({ error });
        setErrors([firebaseError(error)]);
      }
    }
  };

  const readProducts = async (productCodes: Set<string>) => {
    const pieces: string[][] = arrToPieces(Array.from(productCodes), 10);
    const products = new Map<string, Product>();
    if (productCodes.size < 1000) {
      // 取得件数が1000未満の時は、10個づつ取得して結合
      await Promise.all(
        pieces.map(async (codes) => {
          const conds: QueryConstraint[] = [where('code', 'in', codes)];
          const q = query(collection(db, 'products'), ...conds);
          const snap = (await getDocs(q)) as QuerySnapshot<Product>;
          snap.docs.forEach((item) => {
            const product = item.data();
            products.set(product.code, product);
          });
        })
      );
    } else {
      // 取得件数が1000以上の時は、すべて取得
      const snap = (await getDocs(collection(db, 'products'))) as QuerySnapshot<Product>;
      snap.docs.forEach((item) => {
        const product = item.data();
        products.set(product.code, product);
      });
    }
    return products;
  };

  return (
    <Flex direction="col" justify_content="center" align_items="center" className="pt-12">
      <h1 className="text-xl font-bold mb-2 mt-4">商品マスタ取込</h1>
      <Card className="p-5">
        <Form onSubmit={importExcel} className="p-3">
          <div className="mb-2">
            <input type="file" name="ref" ref={ref} accept=".xlsx" disabled={loading} required />
          </div>
          <div>
            <Form.Checkbox
              label="既存の商品マスタを上書きする"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            <p>
              <small>
                ※ 商品マスタの上書きは店舗コードがブランク、または本部(00)のときのみ実行。
                <br />
                商品マスタが存在しないときは新規作成し、未登録フラグを設定する。
                <br />
                店舗売価・店舗原価は無条件に上書き。
              </small>
            </p>
          </div>
          <Button disabled={loading} className="w-full mt-4">
            取込実行
          </Button>
          {messages.length > 0 && (
            <Alert severity="success" className="mt-4">
              {messages.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </Alert>
          )}
          {errors.length > 0 && (
            <Alert severity="error" className="mt-4">
              {errors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </Alert>
          )}
          <h2 className="mt-6">
            認識されるヘッダ<small>(完全一致)</small>
          </h2>
          <Table size="sm">
            <Table.Head>
              <Table.Row>
                <Table.Cell className="font-bold">ヘッダ名称</Table.Cell>
                <Table.Cell className="font-bold">備考</Table.Cell>
                <Table.Cell className="font-bold">ｺｰﾄﾞ値</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {Array.from(headerDisp.entries()).map(([name, item], i) => (
                <Table.Row key={i}>
                  <Table.Cell>{Array.from(item.labels).join(' | ')}</Table.Cell>
                  <Table.Cell>{item.comment}</Table.Cell>
                  <Table.Cell>{name}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
          {loading && <Progress value={Math.floor(progress <= 100 ? progress : 100)} />}
        </Form>
      </Card>
    </Flex>
  );
};

export default ImportProducts;
