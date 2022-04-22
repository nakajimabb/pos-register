import React, { useState, useEffect, useRef } from 'react';
import {
  getFirestore,
  doc,
  DocumentSnapshot,
  getDoc,
  collection,
  getDocs,
  QuerySnapshot,
  setDoc,
} from 'firebase/firestore';
import clsx from 'clsx';
import { useReactToPrint } from 'react-to-print';
import { Button, Flex, Modal, Table } from './components';
import { nameWithCode, toDateString, isNum } from './tools';
import { Inventory, InventoryDetail, inventoryPath, inventoryDetailPath } from './types';
import InventorySum from './InventorySum';
import { useAppContext } from './AppContext';

const db = getFirestore();

type Props = {
  mode: 'modal' | 'print';
  shopCode: string;
  date: Date;
  onClose: () => void;
};

const InventoryPrint: React.FC<Props> = ({ mode, shopCode, date, onClose }) => {
  const [items, setItems] = useState<InventoryDetail[]>([]);
  const [inventory, setInventory] = useState<Inventory | undefined>(undefined);
  const [loaded, setLoaded] = useState<boolean>(false);
  const { getProductPrice } = useAppContext();
  const sortType = 'diff';
  const pageStyle = `
    @media print {
      @page { size: JIS-B5 portrait; }
    }  
  `;
  const componentRef = useRef(null);

  useEffect(() => {
    loadInventoryDetails(shopCode, date);
  }, [shopCode, date]);

  useEffect(() => {
    if (loaded && handlePrint && mode === 'print') handlePrint();
  }, [loaded]);

  const loadInventoryDetails = async (shopCode: string, date: Date) => {
    if (shopCode && date) {
      const delivPath = inventoryPath(shopCode, date);
      const snap = (await getDoc(doc(db, delivPath))) as DocumentSnapshot<Inventory>;
      setInventory(snap.data());
      const detailPath = inventoryDetailPath(shopCode, date);
      const qSnap = (await getDocs(collection(db, detailPath))) as QuerySnapshot<InventoryDetail>;
      setItems(qSnap.docs.map((docSnap) => docSnap.data()));
      setLoaded(true);
    }
  };

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    pageStyle,
    onAfterPrint: () => {
      onClose();
    },
  });

  const getSortItems = () => {
    return items.sort((item1, item2) => {
      const countedAt1 = item1.countedAt;
      const countedAt2 = item2.countedAt;
      if (countedAt1 && countedAt2) {
        const diff = sortType === 'diff';
        const v1 = diff ? Math.abs(item1.quantity - item1.stock) : item1[sortType];
        const v2 = diff ? Math.abs(item2.quantity - item2.stock) : item2[sortType];
        if (v1 !== null && v2 !== null) {
          if (v1 > v2) return -1;
          else if (v1 < v2) return 1;
          else return 0;
        }
      }

      const code1 = item1.productCode;
      const code2 = item2.productCode;
      if (code1 > code2) return 1;
      else if (code1 < code2) return -1;
      else return 0;
    });
  };

  const recalc = async () => {
    if (inventory) {
      const details = [...items];
      for await (const item of details) {
        const prices = await getProductPrice(inventory.shopCode, item.productCode, ['finalCostPrice', 'product']);
        const value: { costPrice?: number; stockTax?: number } = {};
        if (prices?.finalCostPrice !== undefined) {
          item.costPrice = prices.finalCostPrice;
          value.costPrice = prices.finalCostPrice;
        }
        if (prices?.product?.stockTax) {
          item.stockTax = prices.product.stockTax;
          value.stockTax = prices.product.stockTax;
        }
        await setDoc(
          doc(db, inventoryDetailPath(inventory.shopCode, inventory.date.toDate(), item.productCode)),
          value,
          { merge: true }
        );
      }
      setItems(details);
    }
  };

  return (
    <Modal open size="none" onClose={onClose} className={clsx('w-2/3 overflow-visible', mode === 'print' && 'hidden')}>
      <Modal.Body>
        <div ref={componentRef}>
          <Flex justify_content="between" className="mb-3">
            <div>
              <h1 className="text-2xl font-bold mb-3">
                棚卸リスト{inventory && nameWithCode({ code: inventory.shopCode, name: inventory.shopName })}
              </h1>
              {inventory && (
                <>
                  <Flex>
                    <div className="w-24">ｽﾃｰﾀｽ</div>
                    {inventory && (inventory.fixedAt ? '確定済' : '作業中')}
                  </Flex>
                  <Flex>
                    <div className="w-24">作業期間</div>
                    {toDateString(inventory.date.toDate(), 'MM/DD hh:mm')}〜
                    {inventory.fixedAt && toDateString(inventory.fixedAt.toDate(), 'MM/DD hh:mm')}
                  </Flex>
                </>
              )}
            </div>
            {inventory && (
              <Flex>
                <Button color="light" size="sm" className="h-8 mr-2" onClick={recalc}>
                  再計算
                </Button>
                <InventorySum inventoryDetails={items} />
              </Flex>
            )}
          </Flex>
          <Table className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell>No</Table.Cell>
                <Table.Cell>商品コード</Table.Cell>
                <Table.Cell>商品名</Table.Cell>
                <Table.Cell>原価</Table.Cell>
                <Table.Cell>消費税</Table.Cell>
                <Table.Cell>理論値</Table.Cell>
                <Table.Cell>数量</Table.Cell>
                <Table.Cell>差異</Table.Cell>
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
                  <Table.Cell>{item.quantity}</Table.Cell>
                  <Table.Cell>{item.quantity - item.stock}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default InventoryPrint;
