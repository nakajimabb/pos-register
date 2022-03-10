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
  deleteDoc,
  query,
  orderBy,
  limit,
  QuerySnapshot,
  increment,
  setDoc,
} from 'firebase/firestore';
import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import { useAppContext } from './AppContext';
import { isToday, toDateString } from './tools';
import firebaseError from './firebaseError';
import { Product, Inventory, InventoryDetail, inventoryPath, inventoryDetailPath, Stock, stockPath } from './types';
import InventoryDetailEdit from './InventoryDetailEdit';

const db = getFirestore();

const InventoryMain: React.FC = () => {
  const [currentItem, setCurrentItem] = useState<{
    productCode: string;
    quantity: number | null;
  }>({
    productCode: '',
    quantity: null,
  });
  const [inventoryDetails, setInventoryDetails] = useState<Map<string, InventoryDetail>>(new Map());
  const [inventory, setInventory] = useState<Inventory | undefined>(undefined);
  const [targetDate, setTargetDate] = useState<Date>(new Date());
  const [errors, setErrors] = useState<string[]>([]);
  const [targetProductCode, setTargetProductCode] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);
  const { currentShop } = useAppContext();
  const quantityRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentShop) {
      loadLastInventory(currentShop.code);
    }
  }, [currentShop]);

  const resetCurrentItem = () => {
    setCurrentItem({
      productCode: '',
      quantity: null,
    });
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
            const items = new Map<string, InventoryDetail>();
            const detailPath = inventoryDetailPath(shopCode, invt.date.toDate());
            const qSnap = (await getDocs(collection(db, detailPath))) as QuerySnapshot<InventoryDetail>;
            qSnap.docs.forEach((docSnap) => {
              items.set(docSnap.id, docSnap.data());
            });
            await readStocks(shopCode, items);
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
            fixedAt: null,
          };
          await setDoc(ref, invt);
          setInventory(invt);
          const items = new Map<string, InventoryDetail>();
          await readStocks(shopCode, items);
          setInventoryDetails(items);
        } else {
          setErrors((prev) => [...prev, '既ににデータが存在します。']);
        }
      } catch (error) {}
    }
  };

  // 在庫データ読み込み
  const readStocks = async (shopCode: string, items: Map<string, InventoryDetail>) => {
    const snapStock = (await getDocs(collection(db, stockPath(shopCode)))) as QuerySnapshot<Stock>;
    snapStock.docs.forEach((docSnap) => {
      const stock = docSnap.data();
      const item = items.get(docSnap.id);
      if (item) {
        items.set(docSnap.id, { ...item, stockQuantity: stock.quantity });
      } else {
        items.set(docSnap.id, {
          productCode: stock.productCode,
          productName: stock.productName,
          quantity: 0,
          stockQuantity: stock.quantity,
          fixedAt: null,
        });
      }
    });
  };

  const addItem = async () => {
    if (inventory && currentItem.productCode && currentItem.quantity) {
      const ref = doc(db, 'products', currentItem.productCode);
      const snap = (await getDoc(ref)) as DocumentSnapshot<Product>;
      const product = snap.data();
      if (product) {
        const items = new Map(inventoryDetails);
        const item = items.get(currentItem.productCode);
        const path = inventoryDetailPath(inventory.shopCode, inventory.date.toDate(), currentItem.productCode);
        const ref = doc(db, path);
        if (item) {
          const ref = doc(db, path);
          const invt = { ...item, quantity: currentItem.quantity, fixedAt: Timestamp.fromDate(new Date()) };
          setDoc(ref, {
            ...invt,
            fixedAt: serverTimestamp(), // 差異あり
          });
          items.set(currentItem.productCode, invt);
        } else {
          const invt = {
            productCode: currentItem.productCode,
            productName: product.name,
            quantity: currentItem.quantity,
            stockQuantity: 0,
            fixed: true,
            fixedAt: Timestamp.fromDate(new Date()),
          };
          setDoc(ref, {
            ...invt,
            fixedAt: serverTimestamp(), // 差異あり
          });
        }
        setInventoryDetails(items);
        resetCurrentItem();
        quantityRef.current?.focus();
      } else {
        setErrors((prev) => [...prev, '商品データが存在しません。']);
      }
    }
  };

  const loadProduct = async (e: React.KeyboardEvent) => {
    if (currentItem.productCode && e.key === 'Enter') {
      e.preventDefault();
      setErrors([]);
      const snap = (await getDoc(doc(db, 'products', currentItem.productCode))) as DocumentSnapshot<Product>;
      const product = snap.data();
      if (product) {
        setCurrentItem((prev) => ({ ...prev, costPrice: product.costPrice })); // TODO: 後で移動平均に変更
        quantityRef.current?.focus();
      } else {
        setErrors((prev) => [...prev, '商品が見つかりません。']);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const fixInventory = async () => {
    if (inventory && inventory.shopCode) {
      try {
        setProcessing(false);
        const ref = doc(db, inventoryPath(inventory.shopCode, inventory.date.toDate()));
        if (existFixedItems()) {
          if (window.confirm('確定しますか？')) {
            await setDoc(ref, { ...inventory, fixedAt: serverTimestamp() });
            const snap = (await getDoc(ref)) as DocumentSnapshot<Inventory>;
            if (snap.exists()) setInventory(snap.data());
            alert('保存しました。');
          }
        } else {
          if (window.confirm('棚卸データが存在しません。データをクリアします。')) {
            await deleteDoc(ref);
            setInventory(undefined);
            setInventoryDetails(new Map());
          }
        }
        setProcessing(false);
      } catch (error) {
        setProcessing(false);
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const getTargetItems = () => {
    return Array.from(inventoryDetails.values());
  };

  const getFixedItems = () => {
    return Array.from(inventoryDetails.values()).filter((item) => !!item.fixedAt);
  };

  const existFixedItems = () => {
    return Array.from(inventoryDetails.values()).some((item) => !!item.fixedAt);
  };

  const sumItemQuantity = () => {
    return getTargetItems().reduce((acc, item) => acc + item.quantity, 0);
  };

  return (
    <div className="pt-12">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-2">棚卸処理</h1>
        {targetProductCode && (
          <InventoryDetailEdit
            open
            value={inventoryDetails.get(targetProductCode)}
            onClose={() => setTargetProductCode('')}
            onUpdate={(inventoryDetail: InventoryDetail) => {
              const newItems = new Map(inventoryDetails);
              newItems.set(targetProductCode, inventoryDetail);
              setInventoryDetails(newItems);
            }}
          />
        )}
        <Card className="p-5 overflow-visible">
          <Flex className="space-x-2 mb-2">
            <Form.Date
              value={toDateString(targetDate, 'YYYY-MM-DD')}
              onChange={(e) => {
                const date = new Date(e.target.value);
                setTargetDate(date);
              }}
            />
            <Button
              className="w-32"
              disabled={!!inventory || processing}
              onClick={() => {
                if (currentShop && window.confirm('棚卸を開始しますか？')) {
                  newInventory(currentShop.code, currentShop.name, targetDate);
                }
              }}
            >
              棚卸開始
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
          <Flex justify_content="between">
            <Form className="flex space-x-2 mb-2" onSubmit={handleSubmit}>
              <Form.Text
                value={currentItem.productCode}
                onChange={(e) => setCurrentItem((prev) => ({ ...prev, productCode: String(e.target.value) }))}
                onKeyPress={loadProduct}
                placeholder="商品コード"
              />
              <Form.Number
                value={String(currentItem.quantity)}
                placeholder="数量"
                innerRef={quantityRef}
                onChange={(e) => setCurrentItem((prev) => ({ ...prev, quantity: +e.target.value }))}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem();
                  }
                }}
                className="w-36"
              />
              <Button onClick={addItem}>追加</Button>
            </Form>
            <div className="space-x-2">
              <Button
                className="w-32"
                disabled={!inventory || !!inventory.fixedAt || processing}
                onClick={fixInventory}
              >
                {inventory?.fixedAt ? '確定済' : '棚卸終了'}
              </Button>
            </div>
          </Flex>
          <Table className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell>No</Table.Cell>
                <Table.Cell>商品コード</Table.Cell>
                <Table.Cell>商品名</Table.Cell>
                <Table.Cell>理論値</Table.Cell>
                <Table.Cell>実数</Table.Cell>
                <Table.Cell>差異</Table.Cell>
                <Table.Cell></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {getTargetItems().map((item, i) => (
                <Table.Row key={i}>
                  <Table.Cell>{i + 1}</Table.Cell>
                  <Table.Cell>{item.productCode}</Table.Cell>
                  <Table.Cell>{item.productName}</Table.Cell>
                  <Table.Cell>{item.stockQuantity}</Table.Cell>
                  <Table.Cell>{item.fixedAt ? item.quantity : ''}</Table.Cell>
                  <Table.Cell>{item.fixedAt ? item.stockQuantity - item.quantity : ''}</Table.Cell>
                  <Table.Cell>
                    {!item.fixedAt && (
                      <>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={() => setTargetProductCode(item.productCode)}
                        >
                          <Icon name="pencil-alt" />
                        </Button>
                      </>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card>
      </div>
    </div>
  );
};

export default InventoryMain;
