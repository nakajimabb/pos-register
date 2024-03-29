import React, { useState, useEffect, useRef } from 'react';
import {
  getFirestore,
  doc,
  DocumentSnapshot,
  getDoc,
  collection,
  getDocs,
  Timestamp,
  serverTimestamp,
  runTransaction,
  deleteDoc,
  query,
  orderBy,
  limit,
  QuerySnapshot,
  setDoc,
  DocumentReference,
} from 'firebase/firestore';
import { useReactToPrint } from 'react-to-print';
import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import { useAppContext } from './AppContext';
import { isToday, toDateString, checkDigit } from './tools';
import firebaseError from './firebaseError';
import { Product, Inventory, InventoryDetail, inventoryPath, inventoryDetailPath, Stock, stockPath } from './types';
import InventorySum from './InventorySum';
import InventoryDetailEdit from './InventoryDetailEdit';
import UnregisteredProductEdit from './UnregisteredProductEdit';
import clsx from 'clsx';

const db = getFirestore();

type SortType = 'countedAt' | 'stock' | 'quantity' | 'diff';

const InventoryMain: React.FC = () => {
  const [currentItem, setCurrentItem] = useState<{
    productCode: string;
    productName: string;
    quantity: number | null;
  }>({
    productCode: '',
    productName: '',
    quantity: null,
  });
  const [inventoryDetails, setInventoryDetails] = useState<Map<string, InventoryDetail>>(new Map());
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [inventory, setInventory] = useState<Inventory | undefined>(undefined);
  const [errors, setErrors] = useState<string[]>([]);
  const [editTarget, setEditTarget] = useState<InventoryDetail | undefined>(undefined);
  const [processing, setProcessing] = useState<boolean>(false);
  const [sortType, setSortType] = useState<SortType>('countedAt');
  const [openProductEdit, setOpenProductEdit] = useState<boolean>(false);
  const { currentShop, incrementStock, getProductPrice } = useAppContext();
  const codeRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const componentRef = useRef(null);
  const pageStyle = `
    @media print {
      @page { size: JIS-B5 portrait; margin: 0; }
    }  
  `;

  useEffect(() => {
    if (currentShop) {
      loadLastInventory(currentShop.code);
    }
  }, [currentShop]);

  const resetCurrentItem = () => {
    setCurrentItem({
      productCode: '',
      productName: '',
      quantity: null,
    });
  };

  const clearinventory = () => {
    setInventory(undefined);
    setInventoryDetails(new Map());
  };

  const loadLastInventory = async (shopCode: string) => {
    if (shopCode) {
      try {
        const invtPath = inventoryPath(shopCode);
        const snap = (await getDocs(
          query(collection(db, invtPath), orderBy('date', 'desc'), limit(1))
        )) as QuerySnapshot<Inventory>;
        if (snap.docs.length === 1) {
          const invt = snap.docs[0].data();
          if (!invt.fixedAt || isToday(invt.fixedAt.toDate())) {
            setInventory(invt);
            // 在庫データ読込
            const items = new Map<string, InventoryDetail>();
            await readStocks(shopCode, items);
            // 棚卸データ読込
            const detailPath = inventoryDetailPath(shopCode, invt.date.toDate());
            const qSnap = (await getDocs(collection(db, detailPath))) as QuerySnapshot<InventoryDetail>;
            qSnap.docs.forEach((docSnap) => {
              items.set(docSnap.id, docSnap.data());
            });
            setInventoryDetails(items);
          }
        }
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const newInventory = async (shopCode: string, shopName: string, date: Date) => {
    if (shopCode) {
      try {
        const ref = doc(db, inventoryPath(shopCode, date));
        const snap = (await getDoc(ref)) as DocumentSnapshot<Inventory>;
        if (!snap.exists()) {
          const invt = {
            shopCode,
            shopName,
            date: Timestamp.fromDate(date),
            sum: {},
          };
          await setDoc(ref, invt);
          setInventory(invt);
          const items = new Map<string, InventoryDetail>();
          await readStocks(shopCode, items);
          setInventoryDetails(items);
          codeRef.current?.focus();
        } else {
          setErrors((prev) => [...prev, '既ににデータが存在します。']);
        }
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  // 在庫データ読み込み
  const readStocks = async (shopCode: string, items: Map<string, InventoryDetail>) => {
    const snapStock = (await getDocs(collection(db, stockPath(shopCode)))) as QuerySnapshot<Stock>;
    const tasks = snapStock.docs.map(async (docSnap) => {
      const stock = docSnap.data();
      const item = items.get(docSnap.id);
      const productCode = stock.productCode;
      const prices = await getProductPrice(shopCode, productCode, ['finalCostPrice', 'product']);
      const costPrice = prices?.finalCostPrice;
      const stockTax = prices?.product?.stockTax ?? undefined;
      if (item) {
        items.set(docSnap.id, { ...item, costPrice, stockTax, stock: stock.quantity });
      } else {
        items.set(docSnap.id, {
          productCode,
          productName: stock.productName,
          costPrice,
          stockTax,
          quantity: 0,
          stock: stock.quantity,
          countedAt: null,
        });
      }
    });
    await Promise.all(tasks);
  };

  const getProduct = async (productCode: string) => {
    const product = products.get(productCode);
    if (product) {
      return product;
    } else {
      const ref = doc(db, 'products', productCode) as DocumentReference<Product>;
      const snap = await getDoc(ref);
      const prdt = snap.data();
      if (prdt) {
        const newProducts = new Map(products);
        newProducts.set(productCode, prdt);
        setProducts(newProducts);
        return prdt;
      }
    }
  };

  const getStockQuantity = async (shopCode: string, productCode: string) => {
    const snap = (await getDoc(doc(db, stockPath(shopCode, productCode)))) as DocumentSnapshot<Stock>;
    if (snap.exists()) {
      return snap.data().quantity;
    } else {
      return 0;
    }
  };

  const addItem = async (productCode: string, quantity: number | null) => {
    if (inventory && productCode && quantity !== null) {
      saveItem(inventory.shopCode, inventory.date.toDate(), productCode, quantity, 'add');
      resetCurrentItem();
      codeRef.current?.focus();
    }
  };

  const saveItem = async (shopCode: string, date: Date, productCode: string, quantity: number, op: 'add' | 'set') => {
    try {
      const product = await getProduct(productCode);
      const stock = await getStockQuantity(shopCode, productCode);
      if (product) {
        const item = inventoryDetails.get(productCode);
        const qty = op === 'set' ? quantity : (item?.quantity ?? 0) + quantity;
        const prices = await getProductPrice(shopCode, productCode, ['finalCostPrice', 'product']);
        const costPrice = prices?.finalCostPrice;
        const stockTax = prices?.product?.stockTax ?? undefined;
        const newItem = {
          productCode,
          productName: product.name,
          quantity: qty,
          costPrice,
          stockTax,
          stock,
          countedAt: Timestamp.fromDate(new Date()),
        };
        const items = new Map(inventoryDetails);
        items.set(productCode, newItem);
        // save db
        const invt = await updateSum(items);
        const path = inventoryPath(shopCode, date);
        setDoc(doc(db, path), invt);
        const pathDetail = inventoryDetailPath(shopCode, date, productCode);
        setDoc(doc(db, pathDetail), newItem);
        // set state
        setInventoryDetails(items);
      } else {
        throw '商品データが存在しません。';
      }
    } catch (error) {
      console.log({ error });
      setErrors((prev) => [...prev, firebaseError(error)]);
    }
  };

  const loadProduct = async (e: React.KeyboardEvent) => {
    if (currentItem.productCode && e.key === 'Enter') {
      e.preventDefault();
      setErrors([]);
      const snap = (await getDoc(doc(db, 'products', currentItem.productCode))) as DocumentSnapshot<Product>;
      const product = snap.data();
      if (product) {
        setCurrentItem((prev) => ({ ...prev, productName: product.name }));
        quantityRef.current?.focus();
      } else {
        if (checkDigit(currentItem.productCode)) {
          setOpenProductEdit(true);
          setCurrentItem((prev) => ({ ...prev, productName: '' }));
        } else {
          setErrors((prev) => [...prev, '不正なPLUコードです。']);
          setCurrentItem((prev) => ({ ...prev, productName: '' }));
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  // fix: true => 確定、false => 確定取消
  const fixInventory = async (fix: boolean) => {
    if (inventory && inventory.shopCode) {
      try {
        setProcessing(true);
        if (existCountedItems()) {
          const items = getDiffItems();
          await runTransaction(db, async (transaction) => {
            // 在庫更新
            items.forEach((item) => {
              const diff = item.quantity - item.stock;
              incrementStock(inventory.shopCode, item.productCode, item.productName, fix ? diff : -diff, transaction);
            });
            // 棚卸更新
            const ref = doc(db, inventoryPath(inventory.shopCode, inventory.date.toDate()));
            if (fix) {
              transaction.set(ref, { ...inventory, fixedAt: serverTimestamp() }, { merge: true });
            } else {
              delete inventory.fixedAt;
              transaction.set(ref, inventory);
            }
          });
          alert('在庫を更新しました。');
        } else {
          // カウント項目が存在しないとき（間違って開始したときなど）
          const ref = collection(db, inventoryDetailPath(inventory.shopCode, inventory.date.toDate()));
          const details = await getDocs(ref);
          if (details.docs.length > 0) throw Error('既に棚卸データが存在します。');

          const refInvt = doc(db, inventoryPath(inventory.shopCode, inventory.date.toDate()));
          await deleteDoc(refInvt);
          clearinventory();
        }
        loadLastInventory(inventory.shopCode);
        setProcessing(false);
      } catch (error) {
        setProcessing(false);
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const getSortItems = () => {
    let items = Array.from(inventoryDetails.values());
    if (sortType === 'diff') {
      items = items.filter((item) => item.countedAt && Math.abs(item.quantity - item.stock) > 0);
    }
    return items.sort((item1, item2) => {
      let v1: number | null = null;
      let v2: number | null = null;
      const countedAt1 = item1.countedAt;
      const countedAt2 = item2.countedAt;
      if (sortType === 'diff') {
        v1 = countedAt1 ? Math.abs(item1.quantity - item1.stock) : null;
        v2 = countedAt2 ? Math.abs(item1.quantity - item1.stock) : null;
      } else if (sortType === 'countedAt') {
        v1 = countedAt1 ? Number(item1.countedAt?.toDate()) : null;
        v2 = countedAt2 ? Number(item2.countedAt?.toDate()) : null;
      } else {
        v1 = item1[sortType];
        v2 = item2[sortType];
      }
      return comp(v1, v2);
    });
  };

  const comp = (v1: number | null, v2: number | null) => {
    if (v1 !== null && v2 !== null) {
      if (v1 > v2) return -1;
      else if (v1 < v2) return 1;
      else return 0;
    } else if (v1) {
      return -1;
    } else if (v2) {
      return 1;
    } else {
      return 0;
    }
  };

  const existCountedItems = () => {
    return Array.from(inventoryDetails.values()).some((item) => !!item.countedAt);
  };

  const updateSum = async (items: Map<string, InventoryDetail>) => {
    if (inventory) {
      const sum: { [tax: number]: { quantity: number; amount: number } } = { 0: { quantity: 0, amount: 0 } };
      for await (const item of items.values()) {
        if (item.countedAt) {
          const product = await getProduct(item.productCode);
          if (product && product.costPrice) {
            const tax = product.sellingTax;
            if (tax) {
              if (!(tax in sum)) sum[tax] = { quantity: 0, amount: 0 };
              sum[tax].quantity += item.quantity;
              sum[tax].amount += item.quantity * product.costPrice;
            }
            sum[0].quantity += item.quantity;
            sum[0].amount += item.quantity * product.costPrice;
          }
        }
      }
      const invt = { ...inventory, sum };
      setInventory(invt);
      return invt;
    }
  };

  // 差異がある商品の取得
  const getDiffItems = () => {
    return Array.from(inventoryDetails.values()).filter((item) => !!item.countedAt && item.quantity !== item.stock);
  };

  const enableNewInventory = () => {
    if (!inventory) return true;
    if (!inventory.fixedAt) return false;

    let nextDate = inventory.fixedAt.toDate();
    nextDate.setDate(nextDate.getDate() + 1);
    return new Date() > nextDate;
  };

  const updateNewProduct = (product: Product) => {
    setCurrentItem((prev) => ({ ...prev, productCode: product.code, productName: product.name }));
    quantityRef.current?.focus();
  };

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    pageStyle,
  });

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">棚卸処理</h1>
        {editTarget && (
          <InventoryDetailEdit
            open
            value={editTarget}
            onUpdate={(detail: InventoryDetail) => {
              if (inventory) {
                saveItem(inventory.shopCode, inventory.date.toDate(), detail.productCode, detail.quantity, 'set');
              }
            }}
            onClose={() => setEditTarget(undefined)}
          />
        )}
        {openProductEdit && currentShop && (
          <UnregisteredProductEdit
            open
            shopCode={currentShop.code}
            productCode={currentItem.productCode}
            onClose={() => setOpenProductEdit(false)}
            onUpdate={updateNewProduct}
          />
        )}
        <Card className="p-5 overflow-visible">
          <Flex justify_content="between">
            <div className="space-y-3 mb-2">
              <Form.Date value={toDateString(inventory?.date?.toDate() ?? new Date(), 'YYYY-MM-DD')} disabled />
              <Flex className="space-x-2 mb-2">
                <Button
                  className="w-32"
                  disabled={!enableNewInventory() || processing}
                  onClick={() => {
                    if (currentShop && window.confirm('棚卸を開始しますか？')) {
                      newInventory(currentShop.code, currentShop.name, new Date());
                    }
                  }}
                >
                  棚卸開始
                </Button>
                <Button
                  className="w-32"
                  disabled={!inventory || !!inventory.fixedAt || processing}
                  onClick={() => {
                    if (window.confirm('確定しますか？')) {
                      fixInventory(true);
                    }
                  }}
                >
                  棚卸終了
                </Button>
                {inventory && inventory.fixedAt && isToday(inventory.fixedAt.toDate()) && (
                  <Button
                    className="w-32"
                    disabled={processing}
                    onClick={() => {
                      if (window.confirm('確定を取消しますか？')) {
                        fixInventory(false);
                      }
                    }}
                  >
                    確定取消
                  </Button>
                )}
                <Button className="w-32" disabled={!inventory || processing} onClick={handlePrint}>
                  印刷
                </Button>
              </Flex>
            </div>
            {inventory && <InventorySum inventoryDetails={Array.from(inventoryDetails.values())} />}
          </Flex>
          {errors.length > 0 && (
            <Alert severity="error" onClose={() => setErrors([])}>
              {errors.map((err, i) => (
                <p key={i}>{err}</p>
              ))}
            </Alert>
          )}
          <hr className="m-4" />
          {inventory && !inventory.fixedAt && (
            <Flex justify_content="between">
              <Form className="flex space-x-2 mb-2" onSubmit={handleSubmit}>
                <Form.Text
                  value={currentItem.productCode}
                  onChange={(e) =>
                    setCurrentItem((prev) => ({ ...prev, productCode: String(e.target.value), productName: '' }))
                  }
                  onKeyPress={loadProduct}
                  disabled={!inventory || !!inventory.fixedAt}
                  placeholder="商品コード"
                  innerRef={codeRef}
                />
                <Form.Number
                  value={String(currentItem.quantity)}
                  placeholder="数量"
                  innerRef={quantityRef}
                  onChange={(e) => setCurrentItem((prev) => ({ ...prev, quantity: +e.target.value }))}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addItem(currentItem.productCode, currentItem.quantity);
                    }
                  }}
                  disabled={!inventory || !!inventory.fixedAt}
                  className="w-36"
                />
                <Button
                  onClick={() => addItem(currentItem.productCode, currentItem.quantity)}
                  disabled={!inventory || !!inventory.fixedAt}
                >
                  追加
                </Button>
                <p>{currentItem.productName}</p>
              </Form>
              <Form.Select
                className="mb-3 sm:mb-0"
                value={sortType}
                required
                options={[
                  { value: 'countedAt', label: '追加順' },
                  { value: 'stock', label: '理論値順' },
                  { value: 'quantity', label: '実数順' },
                  { value: 'diff', label: '差異のみ' },
                ]}
                onChange={(e) => setSortType(e.target.value as SortType)}
              />
            </Flex>
          )}
          <div ref={componentRef}>
            <Table className="w-full">
              <Table.Head>
                <Table.Row>
                  <Table.Cell type="th">No</Table.Cell>
                  <Table.Cell type="th">商品コード</Table.Cell>
                  <Table.Cell type="th">商品名</Table.Cell>
                  <Table.Cell type="th">原価</Table.Cell>
                  <Table.Cell type="th">消費税</Table.Cell>
                  <Table.Cell type="th">理論値</Table.Cell>
                  <Table.Cell type="th">実数</Table.Cell>
                  <Table.Cell type="th">差異</Table.Cell>
                  <Table.Cell></Table.Cell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {getSortItems().map((item, i) => (
                  <Table.Row
                    key={i}
                    className={clsx(item.countedAt && item.quantity !== item.stock && 'text-red-600 font-bold')}
                  >
                    <Table.Cell>{i + 1}</Table.Cell>
                    <Table.Cell>{item.productCode}</Table.Cell>
                    <Table.Cell>{item.productName}</Table.Cell>
                    <Table.Cell>{item.costPrice}</Table.Cell>
                    <Table.Cell>{item.stockTax ? `${item.stockTax}%` : ''}</Table.Cell>
                    <Table.Cell>{item.stock}</Table.Cell>
                    <Table.Cell>{item.countedAt ? item.quantity : ''}</Table.Cell>
                    <Table.Cell>{item.countedAt ? item.quantity - item.stock : ''}</Table.Cell>
                    <Table.Cell>
                      {inventory && !inventory.fixedAt && (
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300 hidden-print"
                          onClick={() => setEditTarget(item)}
                        >
                          <Icon name="pencil-alt" />
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default InventoryMain;
