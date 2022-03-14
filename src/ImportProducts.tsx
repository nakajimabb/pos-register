import React, { useEffect, useState, useRef } from 'react';
import { getFirestore, doc, getDocs, collection, writeBatch, DocumentReference } from 'firebase/firestore';

import { Alert, Button, Card, Flex, Form } from './components';
import { readExcelAsOjects, HeaderInfo } from './readExcel';
import { useAppContext } from './AppContext';
import firebaseError from './firebaseError';
import { Supplier, ProductCostPrice, productCostPricePath } from './types';
import { checkDigit } from './tools';

const db = getFirestore();

type Props = {
  common: boolean;
};

const ImportProducts: React.FC<Props> = ({ common }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const { registListner, suppliers } = useAppContext();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registListner('suppliers');
  }, []);

  const importExcel = async (e: React.FormEvent) => {
    setMessages([]);
    setErrors([]);
    e.preventDefault();

    const files = ref?.current?.files;
    const blob = files && files[0];
    if (blob && blob.name && suppliers) {
      setLoading(true);
      try {
        // EXCEL 読み込み
        const headerInfo: HeaderInfo = [
          { label: '店舗コード', name: 'shopCode', zeroPadding: 2 },
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
        console.log({ data });

        // 共通データと店舗用データに分割
        const commonData = data.filter((item) => item.shopCode === '00');
        const shopData = data.filter((item) => item.shopCode !== '00');

        // 仕入れ先情報取得
        const suppliersRef = collection(db, 'suppliers');
        const suppliersSnap = await getDocs(suppliersRef);
        const supplierCodes = suppliersSnap.docs.map((item) => item.id);

        // 不明な仕入先コード
        const unknownSupplierCodes: string[] = [];
        data.forEach((item) => {
          const supCode = String(item.supplierCode);
          if (!supplierCodes.includes(supCode) && !unknownSupplierCodes.includes(supCode)) {
            unknownSupplierCodes.push(supCode);
          }
        });
        unknownSupplierCodes.sort((a, b) => +a - +b);

        // 店舗情報取得
        const shopsRef = collection(db, 'shops');
        const shopsSnap = await getDocs(shopsRef);
        const shopCodes = shopsSnap.docs.map((item) => item.id);

        // 不明な店舗コード
        const unknownShopCodes: string[] = [];
        shopData.forEach((item) => {
          const shopCode = String(item.shopCode);
          if (!shopCodes.includes(shopCode) && !unknownShopCodes.includes(shopCode)) {
            unknownShopCodes.push(shopCode);
          }
        });
        unknownShopCodes.sort((a, b) => +a - +b);
        console.log({ unknownShopCodes });

        // 不正なJANコード
        const ngJanCodes = new Set<string>();
        data.forEach((item) => {
          const code = String(item.code);
          if (code.match(/^\d{8}$|^\d{13}$/)) {
            if (!checkDigit(code)) ngJanCodes.add(code);
          }
        });
        console.log({ ngJanCodes: Array.from(ngJanCodes).join(',') });

        // db 書き込み
        const BATCH_UNIT = 300;
        const counter = { products: 0, productCostPrices: 0, productSellingPrices: 0 };
        const errors: {
          products: string[];
          productCostPrices: string[];
          productSellingPrices: string[];
        } = { products: [], productCostPrices: [], productSellingPrices: [] };
        if (common) {
          // 商品マスタ(共通)
          const taskSize = Math.ceil(commonData.length / BATCH_UNIT);
          const sequential = [...Array(taskSize)].map((_, i) => i);
          const tasks = sequential.map(async (_, i) => {
            try {
              let count = 0;
              let error = '';
              const batch = writeBatch(db);
              const sliced = commonData.slice(i * BATCH_UNIT, (i + 1) * BATCH_UNIT);

              sliced.forEach((item) => {
                const code = String(item.code);
                if (item.valid && checkDigit(code)) {
                  let supplierRef: DocumentReference<Supplier> | null = null;
                  // 仕入先情報
                  const supCode = String(item.supplierCode);
                  if (item.supplierCode) {
                    const supCode2 = supplierCodes.includes(supCode) ? supCode : '0'; // 存在しなければ その他(0)
                    supplierRef = doc(db, 'suppliers', supCode2) as DocumentReference<Supplier>;
                  }
                  delete item.shopCode;
                  delete item.valid;
                  delete item.supplierCode;
                  batch.set(doc(db, 'products', code), { ...item, supplierRef }, { merge: true });
                  count += 1;
                }
              });
              await batch.commit();
              return { count, error };
            } catch (error) {
              console.log({ error });
              return { count: 0, error: firebaseError(error) };
            }
          });
          const results = await Promise.all(tasks);
          counter.products = results.reduce((cnt, res) => cnt + res.count, 0);
          errors.products = results.filter((res) => !!res.error).map((res) => res.error);
        } else {
          const taskSize = Math.ceil(shopData.length / BATCH_UNIT);
          const sequential = [...Array(taskSize)].map((_, i) => i);
          // 店舗原価
          const tasks = sequential.map(async (_, i) => {
            try {
              let count = 0;
              let error = '';
              const batch = writeBatch(db);
              const sliced = shopData.slice(i * BATCH_UNIT, (i + 1) * BATCH_UNIT);

              sliced.forEach((item) => {
                const code = String(item.code);
                const shopCode = String(item.shopCode);
                if (item.valid && checkDigit(code) && shopCodes.includes(shopCode)) {
                  let supplierRef: DocumentReference<Supplier> | null = null;
                  // 仕入先情報
                  const supCode = String(item.supplierCode);
                  if (item.supplierCode) {
                    const supCode2 = supplierCodes.includes(supCode) ? supCode : '0'; // 存在しなければ その他(0)
                    supplierRef = doc(db, 'suppliers', supCode2) as DocumentReference<Supplier>;
                  }
                  const supplier = suppliers[String(item.supplierCode)];
                  const productCostPrice: ProductCostPrice = {
                    shopCode,
                    productCode: code,
                    productName: String(item.name),
                    supplierCode: supplier.code ?? '0',
                    supplierName: supplier.name ?? 'その他',
                    costPrice: +item.costPrice,
                  };
                  batch.set(doc(db, productCostPricePath(productCostPrice)), productCostPrice, { merge: true });
                  count += 1;
                }
              });
              await batch.commit();
              return { count, error };
            } catch (error) {
              console.log({ error });
              return { count: 0, error: firebaseError(error) };
            }
          });
          const results = await Promise.all(tasks);
          counter.productCostPrices = results.reduce((cnt, res) => cnt + res.count, 0);
          errors.productCostPrices = results.filter((res) => !!res.error).map((res) => res.error);

          // 店舗売価
          const tasks2 = sequential.map(async (_, i) => {
            try {
              let count = 0;
              let error = '';
              const batch = writeBatch(db);
              const sliced = shopData.slice(i * BATCH_UNIT, (i + 1) * BATCH_UNIT);

              sliced.forEach((item) => {
                const code = String(item.code);
                const shopCode = String(item.shopCode);
                if (item.valid && checkDigit(code) && shopCodes.includes(shopCode)) {
                  batch.set(
                    doc(db, 'shops', shopCode, 'productSellingPrices', code),
                    { shopCode, productCode: code, productName: item.name, sellingPrice: item.sellingPrice },
                    { merge: true }
                  );
                  count += 1;
                }
              });
              await batch.commit();
              return { count, error };
            } catch (error) {
              console.log({ error });
              return { count: 0, error: firebaseError(error) };
            }
          });
          const results2 = await Promise.all(tasks2);
          counter.productSellingPrices = results2.reduce((cnt, res) => cnt + res.count, 0);
          errors.productSellingPrices = results2.filter((res) => !!res.error).map((res) => res.error);
        }

        setMessages([
          'データを読み込みました。',
          `商品マスタ:${counter.products}件`,
          `店舗原価マスタ:${counter.productCostPrices}件`,
          `店舗売価マスタ:${counter.productSellingPrices}件`,
        ]);

        const errs: string[] = [];
        if (unknownShopCodes.length > 0) {
          const codes = Array.from(unknownShopCodes);
          errs.push(`店舗コードが見つかりません: ${codes.join(' ')}`);
        }
        if (ngJanCodes.size > 0) {
          const codes = Array.from(ngJanCodes);
          errs.push(`不正なJANコード: ${codes.join(' ')}`);
        }
        if (unknownSupplierCodes.length > 0) {
          const codes = Array.from(new Set(unknownSupplierCodes));
          errs.push(`仕入先がみつかりません(仕入先コード: ${codes.join(' ')})`);
        }
        if (errors.products.length > 0) errs.push(...errors.products);
        if (errors.productCostPrices.length > 0) errs.push(...errors.productCostPrices);
        if (errors.productSellingPrices.length > 0) errs.push(...errors.productSellingPrices);

        if (errs.length > 0) setErrors(errs);

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
      <h1 className="text-xl font-bold mb-2">商品マスタ({common ? '共通' : '店舗'})取込</h1>
      <Card className="p-5 w-96">
        <Form onSubmit={importExcel} className="p-3">
          <input type="file" name="ref" ref={ref} accept=".xlsx" disabled={loading} required />
          <Button disabled={loading} className="w-full mt-4">
            取込実行
          </Button>
          {messages.length > 0 && (
            <Alert severity="success" className="mt-4">
              {messages.map((msg) => (
                <p>{msg}</p>
              ))}
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
