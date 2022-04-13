import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import Select from 'react-select';
import {
  doc,
  getDoc,
  getDocs,
  getFirestore,
  collection,
  DocumentSnapshot,
  QuerySnapshot,
  runTransaction,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import { useAppContext } from './AppContext';
import app from './firebase';
import RejectionDetailEdit from './PurchaseDetailEdit';
import { nameWithCode, toDateString, checkDigit } from './tools';
import firebaseError from './firebaseError';
import {
  Product,
  RejectionDetail,
  rejectionPath,
  rejectionDetailPath,
  productCostPricePath,
  ProductCostPrice,
  PurchaseDetail,
  Rejection,
  Stock,
} from './types';

const db = getFirestore();
type Item = RejectionDetail & { removed?: boolean };

type Props = {
  shopCode: string;
  shopName?: string;
  rejectionNumber?: number;
};

const RejectionMain: React.FC<Props> = ({ shopCode, shopName, rejectionNumber = -1 }) => {
  const [currentItem, setCurrentItem] = useState<{
    productCode: string;
    quantity: number | null;
    costPrice: number | null;
  }>({
    productCode: '',
    quantity: null,
    costPrice: null,
  });
  const [rejection, setRejection] = useState<Rejection>({
    shopCode,
    rejectionNumber,
    shopName: shopName ?? '',
    supplierCode: '',
    supplierName: '',
    date: Timestamp.fromDate(new Date()),
    fixed: false,
  });
  const [items, setItems] = useState<Map<string, Item>>(new Map());
  const [supplierOptions, setSuppliersOptions] = useState<{ label: string; value: string }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [targetProductCode, setTargetProductCode] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const { getProductCostPrice, registListner, incrementStock, suppliers } = useAppContext();
  const codeRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const hisotry = useHistory();

  useEffect(() => {
    registListner('suppliers');
  }, []);

  useEffect(() => {
    if (shopCode && rejectionNumber > 0) {
      loadRejectionDetails(shopCode, rejectionNumber);
    }
  }, [shopCode, rejectionNumber]);

  useEffect(() => {
    if (rejectionNumber === -1) {
      setErrors([]);
      if (!rejection.supplierCode) setErrors((prev) => [...prev, '仕入先を指定してください。']);
    }
  }, [rejection.supplierCode, rejectionNumber]);

  useEffect(() => {
    const options = Array.from(suppliers.entries()).map(([code, supplier]) => ({
      value: code,
      label: nameWithCode(supplier),
    }));
    options.unshift({ label: '', value: '' });
    setSuppliersOptions(options);
  }, [suppliers]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const resetCurrentItem = () => {
    setCurrentItem({
      productCode: '',
      quantity: null,
      costPrice: null,
    });
  };

  const resetRejection = () => {
    resetCurrentItem();
    setRejection({
      shopCode,
      rejectionNumber: -1,
      shopName: shopName ?? '',
      supplierCode: '',
      supplierName: '',
      date: Timestamp.fromDate(new Date()),
      fixed: false,
    });
    setItems(new Map());
  };

  const loadRejectionDetails = async (shopCode: string, rejectionNumber: number) => {
    if (shopCode && rejectionNumber > 0) {
      try {
        const rejectPath = rejectionPath(shopCode, rejectionNumber);
        const snap = (await getDoc(doc(db, rejectPath))) as DocumentSnapshot<Rejection>;
        const reject = snap.data();
        if (reject) {
          setRejection(reject);
          const detailPath = rejectionDetailPath(shopCode, rejectionNumber);
          const qSnap = (await getDocs(collection(db, detailPath))) as QuerySnapshot<Item>;
          const newItems = new Map<string, Item>();
          qSnap.docs.forEach((docSnap) => {
            newItems.set(docSnap.id, docSnap.data());
          });
          setItems(newItems);
        }
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const addItem = async (productCode: string, quantity: number | null, costPrice: number | null) => {
    if (productCode && quantity && costPrice) {
      const costPrice = await getProductCostPrice(shopCode, productCode, rejection.supplierCode);
      if (costPrice) {
        const newItems = new Map(items);
        const item = newItems.get(productCode);
        if (item) {
          const qnty = item.removed ? quantity : item.quantity + quantity;
          newItems.set(productCode, {
            ...item,
            removed: false,
            fixed: false,
            quantity: qnty,
          });
        } else {
          newItems.set(productCode, {
            rejectType: costPrice.noReturn ? 'waste' : 'return',
            productCode: productCode,
            productName: costPrice.productName,
            quantity,
            costPrice: costPrice.costPrice,
            fixed: false,
          });
        }
        setItems(newItems);
        resetCurrentItem();
        codeRef.current?.focus();
      } else {
        if (checkDigit(currentItem.productCode)) {
          setErrors((prev) => [...prev, '商品マスタが存在しません。']);
        } else {
          setErrors((prev) => [...prev, '不正なPLUコードです。']);
        }
      }
    }
  };

  const removeItem = (productCode: string) => async (e: React.FormEvent) => {
    const newItems = new Map(items);
    const item = newItems.get(productCode);
    if (item) {
      newItems.set(productCode, { ...item, removed: true, quantity: 0, fixed: false });
      setItems(newItems);
    }
  };

  const loadProduct = async (e: React.KeyboardEvent) => {
    if (currentItem.productCode && e.key === 'Enter') {
      e.preventDefault();
      setErrors([]);
      if (shopCode) {
        if (!rejection.date) setErrors((prev) => [...prev, '日付を指定してください。']);
        if (!rejection.supplierCode) setErrors((prev) => [...prev, '仕入先を指定してください。']);

        let costPrice: number | null = null;
        const snap = (await getDoc(
          doc(db, productCostPricePath(rejection.shopCode, currentItem.productCode, rejection.supplierCode))
        )) as DocumentSnapshot<ProductCostPrice>;
        if (snap.exists()) {
          costPrice = snap.data().costPrice;
        }
        if (costPrice) {
          setCurrentItem((prev) => ({ ...prev, costPrice }));
          quantityRef.current?.focus();
        } else {
          const snapProduct = (await getDoc(doc(db, 'products', currentItem.productCode))) as DocumentSnapshot<Product>;
          const product = snapProduct.data();
          if (product) {
            setCurrentItem((prev) => ({ ...prev, costPrice: product.costPrice }));
            quantityRef.current?.focus();
          } else {
            if (checkDigit(currentItem.productCode)) {
              setErrors((prev) => [...prev, '商品マスタが存在しません。']);
            } else {
              setErrors((prev) => [...prev, '不正なPLUコードです。']);
            }
          }
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const save = async () => {
    try {
      setProcessing(true);
      const reject = { ...rejection, fixed: true };
      await runTransaction(db, async (transaction) => {
        // get existing Data
        const details = new Map<string, RejectionDetail>();
        const notFoundStockCodes = new Set<string>();
        const productCodes = Array.from(items.keys());
        if (reject.rejectionNumber > 0) {
          // 既存詳細データの読み込み
          for await (const productCode of productCodes) {
            const ref2 = doc(db, rejectionDetailPath(reject.shopCode, reject.rejectionNumber, productCode));
            const snap = (await transaction.get(ref2)) as DocumentSnapshot<RejectionDetail>;
            if (snap.exists()) {
              details.set(productCode, snap.data());
            }
          }
        }
        // 既存在庫データの読み込み
        for await (const productCode of productCodes) {
          const stockRef = doc(db, 'shops', reject.shopCode, 'stocks', productCode);
          const stockSnap = (await transaction.get(stockRef)) as DocumentSnapshot<Stock>;
          if (!stockSnap.exists()) {
            notFoundStockCodes.add(productCode);
          }
        }

        // rejection
        if (reject.rejectionNumber <= 0) {
          const functions = getFunctions(app, 'asia-northeast1');
          // deliveries と rejections のドキュメントIDは同一にする
          const result = await httpsCallable(functions, 'getSequence')({ docId: 'rejections' });
          if (Number(result.data) > 0) {
            reject.rejectionNumber = Number(result.data);
            setRejection(reject);
          } else {
            throw Error('不正な仕入番号。');
          }
        }

        const total = getTotal();
        const ref = doc(db, rejectionPath(reject.shopCode, reject.rejectionNumber));
        transaction.set(ref, { ...reject, ...total, updatedAt: serverTimestamp() });

        // 詳細データ保存 => fixしていないデータのみ保存
        const unfixedItems = getUnfixedItems();
        for await (const item of unfixedItems) {
          const detail = details.get(item.productCode);
          const ref2 = doc(db, rejectionDetailPath(reject.shopCode, reject.rejectionNumber, item.productCode));
          // 詳細データ更新
          const history = detail?.history ?? [];
          if (detail && item.quantity !== detail.quantity) history.push(detail.quantity);
          transaction.set(ref2, {
            productCode: item.productCode,
            productName: item.productName,
            quantity: item.quantity,
            costPrice: item.costPrice,
            rejectType: item.rejectType,
            fixed: true,
            history,
          });
          // 在庫更新
          const diff = detail ? detail.quantity - item.quantity : -item.quantity;
          incrementStock(reject.shopCode, item.productCode, item.productName, diff, transaction);
        }
      });
      setProcessing(false);
      alert('保存しました。');
      if (rejectionNumber > 0) {
        hisotry.push('/rejection_new');
      } else {
        resetRejection();
      }
    } catch (error) {
      setProcessing(false);
      console.log({ error });
      alert(firebaseError(error));
    }
  };

  const getTargetItems = () => {
    return Array.from(items.values()).filter((item) => !item.removed);
  };

  const getUnfixedItems = () => {
    return Array.from(items.values()).filter((item) => !item.fixed);
  };

  const existUnfixedItems = () => {
    return Array.from(items.values()).some((item) => !item.fixed);
  };

  const sumItemQuantity = () => {
    return getTargetItems().reduce((acc, item) => acc + item.quantity, 0);
  };

  const getTotal = () => {
    const details = getTargetItems();
    return {
      totalVariety: details.length,
      totalQuantity: details.reduce((acc, item) => acc + item.quantity, 0),
      totalAmount: details.reduce((acc, item) => acc + item.quantity * Number(item.costPrice), 0),
    };
  };

  const total = getTotal();

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">廃棄・返品処理</h1>
        {targetProductCode && (
          <RejectionDetailEdit
            open
            value={items.get(targetProductCode)}
            onClose={() => setTargetProductCode('')}
            onUpdate={(detail: PurchaseDetail) => {
              const detail2 = detail as RejectionDetail;
              const item = items.get(targetProductCode);
              const diff = !item || item.quantity !== detail.quantity || item.costPrice !== detail.costPrice;
              if (diff) {
                const newItems = new Map(items);
                newItems.set(targetProductCode, { ...detail2, fixed: false });
                setItems(newItems);
              }
            }}
          />
        )}
        <Card className="p-5 overflow-visible">
          <Flex className="space-x-2 mb-2">
            <Form.Date
              value={toDateString(rejection.date.toDate(), 'YYYY-MM-DD')}
              disabled={rejection.rejectionNumber > 0}
              onChange={(e) => {
                const date = new Date(e.target.value);
                setRejection((prev) => ({ ...prev, date: Timestamp.fromDate(date) }));
              }}
            />
            <Select
              value={selectValue(rejection.supplierCode, supplierOptions)}
              options={supplierOptions}
              isDisabled={rejection.rejectionNumber > 0}
              onChange={(e) => {
                const supplierCode = String(e?.value);
                setRejection((prev) => ({
                  ...prev,
                  supplierCode,
                  supplierName: suppliers.get(supplierCode)?.name ?? '',
                }));
                codeRef.current?.focus();
              }}
              className="mb-3 sm:mb-0 w-72"
            />
          </Flex>
          {errors.length > 0 && (
            <Alert severity="error" onClose={() => setErrors([])}>
              {errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </Alert>
          )}
          <hr className="m-4" />
          <Flex justify_content="between" className="mb-2">
            <Form className="flex space-x-2" onSubmit={handleSubmit}>
              {!rejection.fixed && (
                <>
                  <Form.Text
                    value={currentItem.productCode}
                    onChange={(e) => setCurrentItem((prev) => ({ ...prev, productCode: String(e.target.value) }))}
                    onKeyPress={loadProduct}
                    placeholder="商品コード"
                    innerRef={codeRef}
                  />
                  <Form.Number
                    value={String(currentItem.quantity)}
                    placeholder="数量"
                    innerRef={quantityRef}
                    min={1}
                    onChange={(e) => setCurrentItem((prev) => ({ ...prev, quantity: +e.target.value }))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addItem(currentItem.productCode, currentItem.quantity, currentItem.costPrice);
                      }
                    }}
                    className="w-36"
                  />
                  <Form.Number
                    value={String(currentItem.costPrice)}
                    placeholder="金額(税抜)"
                    onChange={(e) => setCurrentItem((prev) => ({ ...prev, costPrice: +e.target.value }))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addItem(currentItem.productCode, currentItem.quantity, currentItem.costPrice);
                      }
                    }}
                    className="w-36"
                  />
                  <Button onClick={() => addItem(currentItem.productCode, currentItem.quantity, currentItem.costPrice)}>
                    追加
                  </Button>
                </>
              )}
            </Form>
            {!rejection.fixed && (
              <Button
                className="w-32"
                disabled={!rejection.supplierCode || !existUnfixedItems() || sumItemQuantity() === 0 || processing}
                onClick={() => {
                  if (window.confirm('確定しますか？')) {
                    save();
                  }
                }}
              >
                登録
              </Button>
            )}
            {rejection.fixed && (
              <Button className="w-32" onClick={() => setRejection((prev) => ({ ...prev, fixed: false }))}>
                再編集
              </Button>
            )}
          </Flex>
          <Flex justify_content="between" className="my-2">
            <Flex>
              <div className="bold px-2">
                商品種&nbsp;
                <span className="text-2xl">{total.totalVariety}</span>
              </div>
              <div className="bold px-2">
                商品数&nbsp;
                <span className="text-2xl">{total.totalQuantity}</span>
              </div>
              <div className="bold px-2">
                金額(税抜)&nbsp;
                <span className="text-2xl">{total.totalAmount.toLocaleString()}</span>円
              </div>
            </Flex>
            <div>
              <span className="text-xl">
                {nameWithCode({
                  code: rejection.supplierCode,
                  name: rejection.supplierName,
                })}
              </span>
              行き
            </div>
          </Flex>
          <Table className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell>No</Table.Cell>
                <Table.Cell>商品コード</Table.Cell>
                <Table.Cell>商品名</Table.Cell>
                <Table.Cell>種別</Table.Cell>
                <Table.Cell>数量</Table.Cell>
                <Table.Cell>
                  <small>仕入価格(税抜)</small>
                </Table.Cell>
                <Table.Cell>履歴</Table.Cell>
                <Table.Cell></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {getTargetItems().map(
                (item, i) =>
                  !item.removed && (
                    <Table.Row key={i}>
                      <Table.Cell>{i + 1}</Table.Cell>
                      <Table.Cell>{item.productCode}</Table.Cell>
                      <Table.Cell>{item.productName}</Table.Cell>
                      <Table.Cell>{item.rejectType === 'return' ? '返品' : '廃棄'}</Table.Cell>
                      <Table.Cell>{item.quantity}</Table.Cell>
                      <Table.Cell>{item.costPrice?.toLocaleString()}</Table.Cell>
                      <Table.Cell>
                        {item.history && item.history.length > 0 && [...item.history, item.quantity].join('⇒')}
                      </Table.Cell>
                      <Table.Cell>
                        {!rejection.fixed && (
                          <>
                            <Button
                              variant="icon"
                              size="xs"
                              color="none"
                              className="hover:bg-gray-300 "
                              onClick={() => setTargetProductCode(item.productCode)}
                            >
                              <Icon name="pencil-alt" />
                            </Button>
                            <Button
                              variant="icon"
                              size="xs"
                              color="none"
                              className="hover:bg-gray-300"
                              onClick={removeItem(item.productCode)}
                            >
                              <Icon name="trash" />
                            </Button>
                          </>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  )
              )}
            </Table.Body>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default RejectionMain;
