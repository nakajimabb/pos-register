import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, DocumentSnapshot, getDoc, collection, getDocs, QuerySnapshot } from 'firebase/firestore';
import clsx from 'clsx';
import { useReactToPrint } from 'react-to-print';
import { Flex, Modal, Table } from './components';
import { nameWithCode, toDateString } from './tools';
import { Inventory, InventoryDetail, inventoryPath, inventoryDetailPath } from './types';
var JsBarcode = require('jsbarcode');

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
    try {
      JsBarcode('.barcode').init();
    } catch (err) {
      console.log({ err });
    }
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

  const sumQuantityDiff = () => {
    return items.reduce((acc, item) => acc + item.stock - item.quantity, 0);
  };

  // TODO: 後で実装
  const sumItemSellingPrice = () => {
    // return items.reduce((acc, item) => acc + item.quantity * Number(item.costPrice), 0);
    return 0;
  };

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    pageStyle,
    onAfterPrint: () => {
      onClose();
    },
  });

  return (
    <Modal open size="none" onClose={onClose} className={clsx('w-2/3 overflow-visible', mode === 'print' && 'hidden')}>
      <Modal.Body>
        <div ref={componentRef}>
          <Flex justify_content="between">
            <div>
              <h1 className="text-2xl font-bold mb-3">
                棚卸リスト{' '}
                {inventory
                  ? `${nameWithCode({ code: inventory.shopCode, name: inventory.shopName })} ${toDateString(
                      inventory.date.toDate(),
                      'MM/DD'
                    )}`
                  : ''}
              </h1>
              <Flex>
                <div className="bold border border-gray-300 text-center w-16 py-1">種類</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">{items.length}</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">差異数</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">{sumQuantityDiff()}</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">金額</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">
                  <small>{sumItemSellingPrice().toLocaleString()}円</small>
                </div>
              </Flex>
            </div>
          </Flex>
          <Table className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell>No</Table.Cell>
                <Table.Cell>商品コード</Table.Cell>
                <Table.Cell>商品名</Table.Cell>
                <Table.Cell>理論値</Table.Cell>
                <Table.Cell>数量</Table.Cell>
                <Table.Cell>差異</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {items.map((item, i) => (
                <Table.Row key={i}>
                  <Table.Cell>{i + 1}</Table.Cell>
                  <Table.Cell>{item.productCode}</Table.Cell>
                  <Table.Cell>{item.productName}</Table.Cell>
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
