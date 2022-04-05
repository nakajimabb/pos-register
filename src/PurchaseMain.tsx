import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import Select from 'react-select';
import {
  doc,
  getDoc,
  getDocs,
  getFirestore,
  collection,
  collectionGroup,
  DocumentSnapshot,
  query,
  Query,
  QuerySnapshot,
  runTransaction,
  Timestamp,
  where,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import { useAppContext } from './AppContext';
import app from './firebase';
import PurchaseDetailEdit from './PurchaseDetailEdit';
import UnregisteredProductEdit from './UnregisteredProductEdit';
import { nameWithCode, toDateString, getBarcodeValue, checkDigit } from './tools';
import firebaseError from './firebaseError';
import {
  Product,
  PurchaseDetail,
  purchasePath,
  purchaseDetailPath,
  productCostPricePath,
  ProductCostPrice,
  CLASS_DELIV,
  Purchase,
  Stock,
  Delivery,
  DeliveryDetail,
} from './types';

const db = getFirestore();
type Item = PurchaseDetail & { removed?: boolean };

type Props = {
  shopCode: string;
  shopName?: string;
  purchaseNumber?: number;
};

const PurchaseMain: React.FC<Props> = ({ shopCode, shopName, purchaseNumber = -1 }) => {
  const [currentItem, setCurrentItem] = useState<{
    productCode: string;
    quantity: number | null;
    costPrice: number | null;
  }>({
    productCode: '',
    quantity: null,
    costPrice: null,
  });
  const [purchase, setPurchase] = useState<Purchase>({
    shopCode,
    purchaseNumber,
    shopName: shopName ?? '',
    srcType: 'supplier',
    srcCode: '',
    srcName: '',
    date: Timestamp.fromDate(new Date()),
    fixed: false,
  });
  const [barcode, setBarcode] = useState<string>('');
  const [items, setItems] = useState<Map<string, Item>>(new Map());
  const [supplierOptions, setSuppliersOptions] = useState<{ label: string; value: string }[]>([]);
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [targetProductCode, setTargetProductCode] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const [openProductEdit, setOpenProductEdit] = useState<boolean>(false);
  const { registListner, incrementStock, shops, suppliers } = useAppContext();
  const codeRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const hisotry = useHistory();

  useEffect(() => {
    registListner('shops');
    registListner('suppliers');
  }, []);

  useEffect(() => {
    if (shopCode && purchaseNumber > 0) {
      loadPurchaseDetails(shopCode, purchaseNumber);
    }
  }, [shopCode, purchaseNumber]);

  useEffect(() => {
    if (purchaseNumber === -1) {
      setErrors([]);
      if (!purchase.srcCode) setErrors((prev) => [...prev, '仕入先を指定してください。']);
    }
  }, [purchase.srcCode, purchaseNumber]);

  useEffect(() => {
    const options = Array.from(suppliers.entries()).map(([code, supplier]) => ({
      value: code,
      label: nameWithCode(supplier),
    }));
    options.unshift({ label: '', value: '' });
    setSuppliersOptions(options);
  }, [suppliers]);

  useEffect(() => {
    const options = Array.from(shops.entries()).map(([code, shop]) => ({
      value: code,
      label: nameWithCode(shop),
    }));
    options.unshift({ label: '', value: '' });
    setShopOptions(options);
    setPurchase((prev) => {
      const shopName = shops.get(prev.shopCode)?.name ?? '';
      return { ...prev, shopName };
    });
  }, [shops]);

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

  const resetPurchase = () => {
    resetCurrentItem();
    setPurchase({
      shopCode,
      purchaseNumber: -1,
      shopName: shopName ?? '',
      srcType: 'supplier',
      srcCode: '',
      srcName: '',
      date: Timestamp.fromDate(new Date()),
      fixed: false,
    });
    setItems(new Map());
  };

  const getSupplierCode = () => {
    if (purchase.srcType === 'supplier') {
      return purchase.srcCode;
    }
  };

  const loadPurchaseDetails = async (shopCode: string, purchaseNumber: number) => {
    if (shopCode && purchaseNumber > 0) {
      try {
        const purchPath = purchasePath(shopCode, purchaseNumber);
        const snap = (await getDoc(doc(db, purchPath))) as DocumentSnapshot<Purchase>;
        const purch = snap.data();
        if (purch) {
          setPurchase(purch);
          const detailPath = purchaseDetailPath(shopCode, purchaseNumber);
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
      const ref = doc(db, 'products', productCode);
      const snap = (await getDoc(ref)) as DocumentSnapshot<Product>;
      const product = snap.data();
      if (product) {
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
            productCode: productCode,
            productName: product.name,
            quantity,
            costPrice,
            fixed: false,
          });
        }
        setItems(newItems);
        resetCurrentItem();
        codeRef.current?.focus();
      } else {
        if (checkDigit(currentItem.productCode)) {
          setOpenProductEdit(true);
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
        if (!purchase.date) setErrors((prev) => [...prev, '日付を指定してください。']);
        if (!purchase.srcCode) setErrors((prev) => [...prev, '仕入先を指定してください。']);

        let costPrice: number | null = null;
        if (purchase.srcType === 'supplier') {
          const snap = (await getDoc(
            doc(db, productCostPricePath(purchase.shopCode, currentItem.productCode, purchase.srcCode))
          )) as DocumentSnapshot<ProductCostPrice>;
          if (snap.exists()) {
            costPrice = snap.data().costPrice;
          }
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
              setOpenProductEdit(true);
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
      const purch = { ...purchase, fixed: true };
      await runTransaction(db, async (transaction) => {
        // get existing Data
        const details = new Map<string, PurchaseDetail>();
        const notFoundStockCodes = new Set<string>();
        const productCodes = Array.from(items.keys());
        if (purch.purchaseNumber > 0) {
          // 既存詳細データの読み込み
          for await (const productCode of productCodes) {
            const ref2 = doc(db, purchaseDetailPath(purch.shopCode, purch.purchaseNumber, productCode));
            const snap = (await transaction.get(ref2)) as DocumentSnapshot<PurchaseDetail>;
            if (snap.exists()) {
              details.set(productCode, snap.data());
            }
          }
        }
        // 既存在庫データの読み込み
        for await (const productCode of productCodes) {
          const stockRef = doc(db, 'shops', purch.shopCode, 'stocks', productCode);
          const stockSnap = (await transaction.get(stockRef)) as DocumentSnapshot<Stock>;
          if (!stockSnap.exists()) {
            notFoundStockCodes.add(productCode);
          }
        }

        // purchase
        if (purch.purchaseNumber <= 0) {
          const functions = getFunctions(app, 'asia-northeast1');
          // deliveries と purchases のドキュメントIDは同一にする
          const result = await httpsCallable(functions, 'getSequence')({ docId: 'purchases' });
          if (Number(result.data) > 0) {
            purch.purchaseNumber = Number(result.data);
            setPurchase(purch);
          } else {
            throw Error('不正な仕入番号。');
          }
        }
        const ref = doc(db, purchasePath(purch.shopCode, purch.purchaseNumber));
        transaction.set(ref, purch);

        // 詳細データ保存 => fixしていないデータのみ(削除データ含む)保存
        const unfixedItems = getUnfixedItems();
        for await (const item of unfixedItems) {
          const detail = details.get(item.productCode);
          const ref2 = doc(db, purchaseDetailPath(purch.shopCode, purch.purchaseNumber, item.productCode));
          // 詳細データ更新
          if (item.quantity === 0) {
            transaction.delete(ref2);
          } else {
            transaction.set(ref2, {
              productCode: item.productCode,
              productName: item.productName,
              quantity: item.quantity,
              costPrice: item.costPrice,
              fixed: true,
            });
          }
          // 在庫更新
          const diff = detail ? item.quantity - detail.quantity : item.quantity;
          incrementStock(purch.shopCode, item.productCode, item.productName, diff, transaction);
        }
      });
      setProcessing(false);
      alert('保存しました。');
      if (purchaseNumber > 0) {
        hisotry.push('/purchase_new');
      } else {
        resetPurchase();
      }
    } catch (error) {
      setProcessing(false);
      console.log({ error });
      alert(firebaseError(error));
    }
  };

  const parseBarcode = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const deliveryNumber = Number(barcode.slice(0, 9));
      const q = query(collectionGroup(db, 'deliveries'), where('deliveryNumber', '==', deliveryNumber));
      const snap = await getDocs(q);
      const items = snap.docs.map((item) => item.data());
      console.log({ items });
    }
  };

  const loadDelivery = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (shopCode) {
        try {
          const value = getBarcodeValue(String(barcode), CLASS_DELIV);
          const deliveryNumber = value ? +value : +barcode;
          if (isNaN(deliveryNumber)) {
            throw Error(`不正な出庫番号です。`);
          } else {
            const purchPath = purchasePath(shopCode, deliveryNumber);
            const snapPurch = (await getDoc(doc(db, purchPath))) as DocumentSnapshot<Purchase>;
            if (snapPurch.exists()) {
              if (!window.confirm('データがすでに存在します。再読み込みしますか？')) return;
            }

            const q = query(
              collectionGroup(db, 'deliveries'),
              where('deliveryNumber', '==', deliveryNumber)
            ) as Query<Delivery>;
            const snap = await getDocs(q);
            const deliv = snap.docs.length > 0 ? snap.docs[0].data() : null;
            if (deliv) {
              if (deliv.dstShopCode !== shopCode)
                throw Error(`指定された出庫情報の宛先は${shops.get(shopCode)?.name}に指定されていません。`);
              setPurchase((prev) => ({
                ...prev,
                purchaseNumber: deliveryNumber,
                date: deliv.date,
                srcCode: deliv.shopCode,
                srcName: deliv.shopName,
              }));
              const detailPath = snap.docs[0].ref.path + '/deliveryDetails';
              const qSnap = (await getDocs(collection(db, detailPath))) as QuerySnapshot<DeliveryDetail>;
              const newItems = new Map<string, PurchaseDetail>();
              qSnap.docs.forEach((docSnap) => {
                const item = docSnap.data();
                newItems.set(item.productCode, {
                  productCode: item.productCode,
                  productName: item.productName,
                  costPrice: item.costPrice,
                  quantity: item.quantity,
                  fixed: false,
                });
              });
              setItems(newItems);
              setBarcode('');
            } else {
              setErrors((prev) => [...prev, '指定された出庫番号のデータが存在しません。']);
            }
          }
        } catch (error) {
          console.log({ error });
          alert(firebaseError(error));
        }
      }
    }
  };

  const getSrcName = (srcType: 'supplier' | 'shop', srcCode: string) => {
    if (srcType === 'supplier') {
      return suppliers.get(srcCode)?.name;
    } else {
      return shops.get(srcCode)?.name;
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

  const sumItemCostPrice = () => {
    return getTargetItems().reduce((acc, item) => acc + item.quantity * Number(item.costPrice), 0);
  };

  const updateNewProduct = (product: Product) => {
    setCurrentItem((prev) => ({ ...prev, costPrice: product.costPrice }));
    addItem(product.code, currentItem.quantity, product.costPrice);
    quantityRef.current?.focus();
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">仕入処理</h1>
        {targetProductCode && (
          <PurchaseDetailEdit
            open
            value={items.get(targetProductCode)}
            onClose={() => setTargetProductCode('')}
            onUpdate={(purchaseDetail: PurchaseDetail) => {
              const newItems = new Map(items);
              newItems.set(targetProductCode, purchaseDetail);
              setItems(newItems);
            }}
          />
        )}
        {openProductEdit && (
          <UnregisteredProductEdit
            open
            shopCode={shopCode}
            supplierCode={getSupplierCode()}
            productCode={currentItem.productCode}
            onClose={() => setOpenProductEdit(false)}
            onUpdate={updateNewProduct}
          />
        )}
        <Card className="p-5 overflow-visible">
          <Flex className="space-x-2 mb-2">
            <Flex>
              <Button
                variant={purchase.srcType === 'supplier' ? 'contained' : 'outlined'}
                color={purchase.srcType === 'supplier' ? 'info' : 'light'}
                size="xs"
                disabled={purchase.purchaseNumber > 0}
                className="w-16"
                onClick={() => setPurchase((prev) => ({ ...prev, srcType: 'supplier', srcCode: '' }))}
              >
                社外
              </Button>
              <Button
                variant={purchase.srcType === 'shop' ? 'contained' : 'outlined'}
                color={purchase.srcType === 'shop' ? 'info' : 'light'}
                size="xs"
                disabled={purchase.purchaseNumber > 0}
                className="w-16"
                onClick={() => setPurchase((prev) => ({ ...prev, srcType: 'shop', srcCode: '' }))}
              >
                社内
              </Button>
            </Flex>
            <Form.Date
              value={toDateString(purchase.date.toDate(), 'YYYY-MM-DD')}
              disabled={purchase.purchaseNumber > 0}
              onChange={(e) => {
                const date = new Date(e.target.value);
                setPurchase((prev) => ({ ...prev, date: Timestamp.fromDate(date) }));
              }}
            />
            <Select
              value={selectValue(purchase.srcCode, purchase.srcType === 'supplier' ? supplierOptions : shopOptions)}
              options={purchase.srcType === 'supplier' ? supplierOptions : shopOptions}
              isDisabled={purchase.purchaseNumber > 0}
              onChange={(e) => {
                const srcCode = String(e?.value);
                setPurchase((prev) => ({ ...prev, srcCode, srcName: getSrcName(purchase.srcType, srcCode) ?? '' }));
                codeRef.current?.focus();
              }}
              className="mb-3 sm:mb-0 w-72"
            />
            {purchase.srcType === 'shop' && (
              <Form.Text
                value={barcode}
                onChange={(e) => setBarcode(String(e.target.value))}
                onKeyPress={loadDelivery}
                placeholder="ﾊﾞｰｺｰﾄﾞ読取 or 出庫番号"
                disabled={purchase.purchaseNumber > 0}
              />
            )}
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
                placeholder="金額"
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
            </Form>
            <Button
              className="w-32"
              disabled={!purchase.srcCode || !existUnfixedItems() || sumItemQuantity() === 0 || processing}
              onClick={() => {
                if (window.confirm('確定しますか？')) {
                  save();
                }
              }}
            >
              登録
            </Button>
          </Flex>
          <Flex justify_content="between" className="my-2">
            <Flex>
              <div className="bold px-2">
                商品種&nbsp;
                <span className="text-2xl">{items.size}</span>
              </div>
              <div className="bold px-2">
                商品数&nbsp;
                <span className="text-2xl">{sumItemQuantity()}</span>
              </div>
              <div className="bold px-2">
                金額&nbsp;
                <span className="text-2xl">{sumItemCostPrice().toLocaleString()}</span>円
              </div>
            </Flex>
            <div>
              <span className="text-xl">
                {nameWithCode({ code: purchase.srcCode, name: getSrcName(purchase.srcType, purchase.srcCode) ?? '' })}
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
                <Table.Cell>数量</Table.Cell>
                <Table.Cell>仕入価格</Table.Cell>
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
                      <Table.Cell>{item.quantity}</Table.Cell>
                      <Table.Cell>{item.costPrice}</Table.Cell>
                      <Table.Cell>
                        {!item.fixed && (
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

export default PurchaseMain;
