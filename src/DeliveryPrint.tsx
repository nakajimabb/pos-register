import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, DocumentSnapshot, getDoc, collection, getDocs, QuerySnapshot } from 'firebase/firestore';
import clsx from 'clsx';
import { useReactToPrint } from 'react-to-print';
import { Button, Flex, Modal, Table } from './components';
import { toDateString } from './tools';
import { Delivery, DeliveryDetail, deliveryPath } from './types';

const db = getFirestore();

type Props = {
  mode: 'modal' | 'print';
  shopCode: string;
  date: Date;
  dstShopCode: string;
  onClose: () => void;
};

const DeliveryPrint: React.FC<Props> = ({ mode, shopCode, date, dstShopCode, onClose }) => {
  const [items, setItems] = useState<DeliveryDetail[]>([]);
  const [delivery, setDelivery] = useState<Delivery | undefined>(undefined);
  const [loaded, setLoaded] = useState<boolean>(false);
  const pageStyle = `
    @media print {
      @page { size: JIS-B5 portrait; }
    }  
  `;
  const componentRef = useRef(null);

  useEffect(() => {
    loadDeliveryDetails(shopCode, date, dstShopCode);
  }, [shopCode, date, dstShopCode]);

  useEffect(() => {
    if (loaded && handlePrint && mode === 'print') handlePrint();
  }, [loaded]);

  const loadDeliveryDetails = async (shopCode: string, date: Date, dstShopCode: string) => {
    if (shopCode && shopCode && date) {
      const path = deliveryPath({ shopCode, dstShopCode, date });
      const snap = (await getDoc(doc(db, path))) as DocumentSnapshot<Delivery>;
      setDelivery(snap.data());
      const detailPath = deliveryPath({ shopCode, dstShopCode, date }) + '/deliveryDetails';
      const qSnap = (await getDocs(collection(db, detailPath))) as QuerySnapshot<DeliveryDetail>;
      setItems(qSnap.docs.map((docSnap) => docSnap.data()));
      setLoaded(true);
    }
  };

  const sumItemQuantity = () => {
    return items.reduce((acc, item) => acc + item.quantity, 0);
  };

  const sumItemCostPrice = () => {
    return items.reduce((acc, item) => acc + item.quantity * Number(item.costPrice), 0);
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
          <h1 className="text-2xl font-bold mb-3">
            出庫リスト {toDateString(date, 'MM/DD')} {delivery?.shopName} → {delivery?.dstShopName}
          </h1>
          <Flex>
            <div>
              <Flex>
                <div className="bold border border-gray-300 text-center w-16 py-1">種類</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">{items.length}</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">商品数</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">{sumItemQuantity()}</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">金額</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">
                  <small>{sumItemCostPrice()}円</small>
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
                <Table.Cell>数量</Table.Cell>
                <Table.Cell>仕入価格</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {items.map((item, i) => (
                <Table.Row key={i}>
                  <Table.Cell>{i + 1}</Table.Cell>
                  <Table.Cell>{item.productCode}</Table.Cell>
                  <Table.Cell>{item.productName}</Table.Cell>
                  <Table.Cell>{item.quantity}</Table.Cell>
                  <Table.Cell>{item.costPrice}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default DeliveryPrint;
