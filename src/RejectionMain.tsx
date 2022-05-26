import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import {
  doc,
  collection,
  DocumentSnapshot,
  getDoc,
  getDocs,
  getFirestore,
  query,
  QuerySnapshot,
  runTransaction,
  orderBy,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useReactToPrint } from 'react-to-print';
import clsx from 'clsx';
import { Alert, Button, Card, Flex, Form, Icon, Grid } from './components';
import { useAppContext } from './AppContext';
import app from './firebase';
import RejectionDetailEdit from './RejectionDetailEdit';
import { toDateString, checkDigit } from './tools';
import firebaseError from './firebaseError';
import { RejectionDetail, rejectionPath, rejectionDetailPath, Rejection, Stock, wasteReasons } from './types';
import './App.css';

const db = getFirestore();
type Item = RejectionDetail & { removed?: boolean };

type Props = {
  shopCode: string;
  shopName?: string;
  rejectionNumber?: number;
};

const RejectionMain: React.FC<Props> = ({ shopCode, shopName, rejectionNumber = -1 }) => {
  const [inputProductCode, setInputProductCode] = useState<string>('');
  const [inputRejectionDetail, setInputRejectionDetail] = useState<RejectionDetail | undefined>(undefined);
  const [rejection, setRejection] = useState<Rejection>({
    shopCode,
    rejectionNumber,
    shopName: shopName ?? '',
    date: Timestamp.fromDate(new Date()),
    fixed: false,
  });
  const [items, setItems] = useState<Map<string, Item>>(new Map());
  const [errors, setErrors] = useState<string[]>([]);
  const [processing, setProcessing] = useState<boolean>(false);
  const { suppliers, registListner, getProductPrice, incrementStock } = useAppContext();
  const codeRef = useRef<HTMLInputElement>(null);
  const hisotry = useHistory();
  const componentRef = useRef(null);
  const pageStyle = `
    @media print {
      @page { size: JIS-B5 portrait; margin: 0; }
    }  
  `;

  useEffect(() => {
    registListner('suppliers');
  }, []);

  useEffect(() => {
    if (shopCode && rejectionNumber > 0) {
      loadRejectionDetails(shopCode, rejectionNumber);
    }
  }, [shopCode, rejectionNumber]);

  const resetRejection = () => {
    setInputProductCode('');
    setRejection({
      shopCode,
      rejectionNumber: -1,
      shopName: shopName ?? '',
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
          const qSnap = (await getDocs(
            query(collection(db, detailPath), orderBy('productCode'))
          )) as QuerySnapshot<Item>;
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

  const changeTargetItem = async (productCode: string) => {
    if (productCode) {
      const price = await getProductPrice(shopCode, productCode, ['finalCostPrice', 'product']);
      if (price) {
        const item = items.get(productCode);
        const rejectType = price.noReturn ? 'waste' : 'return';
        if (item) {
          setInputRejectionDetail({ ...item, rejectType, fixed: false });
        } else {
          setInputRejectionDetail({
            rejectType,
            productCode: productCode,
            productName: price.product?.name ?? '',
            quantity: 1,
            costPrice: price.finalCostPrice ?? null,
            supplierCode: price.supplierCode,
            supplierName: suppliers.get(price.supplierCode ?? '')?.name ?? '',
            fixed: false,
          });
        }
        codeRef.current?.focus();
      } else {
        if (checkDigit(productCode)) {
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
        for (const item of unfixedItems) {
          const detail = details.get(item.productCode);
          const ref2 = doc(db, rejectionDetailPath(reject.shopCode, reject.rejectionNumber, item.productCode));
          // 詳細データ更新
          const history = detail?.history ?? [];
          if (detail && item.quantity !== detail.quantity) history.push(detail.quantity);
          const value: RejectionDetail = {
            productCode: item.productCode,
            productName: item.productName,
            quantity: item.quantity,
            costPrice: item.costPrice,
            rejectType: item.rejectType,
            wasteReason: item.wasteReason,
            fixed: true,
            history,
          };
          if (item.rejectType === 'return') {
            value.supplierCode = item.supplierCode;
            value.supplierName = item.supplierName;
          }
          transaction.set(ref2, value);
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

  const getSortedItems = () => {
    const targetItems = getTargetItems();
    const itemsList: Item[][] = [];
    const supplierItems = new Map<string, Item[]>();
    // 仕入先ごとに返品項目をまとめる
    targetItems
      .filter((item) => item.rejectType === 'return')
      .forEach((item) => {
        const items2 = supplierItems.get(item.supplierCode ?? '') ?? [];
        items2.push(item);
        supplierItems.set(item.supplierCode ?? '', items2);
      });
    Array.from(supplierItems.values()).forEach((item2) => {
      itemsList.push(item2);
    });
    // 廃棄を追加
    itemsList.push(targetItems.filter((item) => item.rejectType === 'waste'));

    return itemsList;
  };

  const getTargetItems = () => {
    return Array.from(items.values()).filter((item) => !item.removed);
  };

  const getUnfixedItems = () => {
    return Array.from(items.values()).filter((item) => !item.fixed);
  };

  const sumItemQuantity = () => {
    return getTargetItems().reduce((acc, item) => acc + item.quantity, 0);
  };

  const getTotal = () => {
    const details = getTargetItems();
    return {
      totalVariety: details.filter((detail) => detail.quantity !== 0).length,
      totalQuantity: details.reduce((acc, item) => acc + item.quantity, 0),
      totalAmount: details.reduce((acc, item) => acc + item.quantity * Number(item.costPrice), 0),
    };
  };

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    pageStyle,
  });

  const total = getTotal();
  const template_cols = '5fr 8fr 4fr 4fr 5fr 8fr 6fr 3fr';
  const className = 'border-b px-1 py-2 print-text-sm';
  const className2 = 'font-bold border-b text-center py-2 print-text-sm';

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">廃棄・返品処理</h1>
        {inputRejectionDetail && (
          <RejectionDetailEdit
            open
            shopCode={shopCode}
            value={inputRejectionDetail}
            onClose={() => setInputRejectionDetail(undefined)}
            onUpdate={(detail: RejectionDetail) => {
              const item = items.get(detail.productCode);
              const diff =
                !item ||
                item.quantity !== detail.quantity ||
                item.costPrice !== detail.costPrice ||
                item.supplierCode !== detail.supplierCode ||
                item.supplierName !== detail.supplierName ||
                item.wasteReason !== detail.wasteReason;
              if (diff) {
                const newItems = new Map(items);
                newItems.set(detail.productCode, { ...detail, fixed: false, removed: false });
                setItems(newItems);
              }
              setInputProductCode('');
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
            <Button className="w-32" disabled={sumItemQuantity() === 0 || processing} onClick={handlePrint}>
              印刷
            </Button>
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
                    value={inputProductCode}
                    onChange={(e) => setInputProductCode(String(e.target.value))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        changeTargetItem(inputProductCode);
                      }
                    }}
                    placeholder="商品コード"
                    innerRef={codeRef}
                  />
                  <Button onClick={() => changeTargetItem(inputProductCode)}>追加</Button>
                </>
              )}
            </Form>
            {!rejection.fixed && (
              <Button
                className="w-32"
                disabled={sumItemQuantity() === 0 || processing}
                onClick={() => {
                  if (window.confirm('確定しますか？')) {
                    save();
                  }
                }}
              >
                確定
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
          </Flex>
          <div ref={componentRef} className="print-p-3">
            {getSortedItems().map((item2, index) => (
              <div key={index} className="w-full page-break-alway">
                <Grid cols="9" gap="0" auto_cols="fr" template_cols={template_cols}>
                  {index === 0 && (
                    <>
                      <div className={className2}>商品コード</div>
                      <div className={className2}>商品名</div>
                      <div className={className2}>種別</div>
                      <div className={className2}>数量</div>
                      <div className={className2}>
                        <small>仕入価格(税抜)</small>
                      </div>
                      <div className={className2}>仕入先</div>
                      <div className={className2}>廃棄理由</div>
                      <div className={className2}></div>
                    </>
                  )}
                  {item2.map((item, i) => {
                    const isReturn = item.rejectType === 'return';
                    const bgColor = isReturn ? 'bg-yellow-100' : 'bg-green-100';
                    return (
                      !item.removed && (
                        <React.Fragment key={i}>
                          <div className={clsx(className, bgColor)}>{item.productCode}</div>
                          <div className={clsx(className, bgColor)}>{item.productName}</div>
                          <div className={clsx(className, bgColor, 'text-center')}>{isReturn ? '返品' : '廃棄'}</div>
                          <div className={clsx(className, bgColor, 'text-right')}>{item.quantity}</div>
                          <div className={clsx(className, bgColor, 'text-right')}>
                            {item.costPrice?.toLocaleString()}
                          </div>
                          <div className={clsx(className, bgColor)}>{isReturn && item.supplierName}</div>
                          <div className={clsx(className, bgColor)}>
                            <small>{item.wasteReason && wasteReasons[item.wasteReason]}</small>
                          </div>
                          <div className={clsx(className, bgColor)}>
                            {!rejection.fixed && (
                              <>
                                <Button
                                  variant="icon"
                                  size="xs"
                                  color="none"
                                  className="hover:bg-gray-300 "
                                  onClick={() => {
                                    setInputRejectionDetail(items.get(item.productCode));
                                  }}
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
                          </div>
                        </React.Fragment>
                      )
                    );
                  })}
                </Grid>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RejectionMain;
