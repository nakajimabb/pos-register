import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, DocumentSnapshot, getDoc, collection, getDocs, QuerySnapshot } from 'firebase/firestore';
import clsx from 'clsx';
import { useReactToPrint } from 'react-to-print';
import { Button, Flex, Modal, Table } from './components';
import { toDateString, genBarcode, nameWithCode } from './tools';
import { Delivery, DeliveryDetail, deliveryPath, deliveryDetailPath, CLASS_DELIV } from './types';
var JsBarcode = require('jsbarcode');

const db = getFirestore();

type Props = {
  mode: 'modal' | 'print';
  shopCode: string;
  deliveryNumber: number;
  onClose: () => void;
};

const DeliveryPrint: React.FC<Props> = ({ mode, shopCode, deliveryNumber, onClose }) => {
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
    loadDeliveryDetails(shopCode, deliveryNumber);
  }, [shopCode, deliveryNumber]);

  useEffect(() => {
    try {
      JsBarcode('.barcode').init();
    } catch (err) {
      console.log({ err });
    }
    if (loaded && handlePrint && mode === 'print') handlePrint();
  }, [loaded]);

  const loadDeliveryDetails = async (shopCode: string, deliveryNumber: number) => {
    if (shopCode && deliveryNumber) {
      const delivPath = deliveryPath(shopCode, deliveryNumber);
      const snap = (await getDoc(doc(db, delivPath))) as DocumentSnapshot<Delivery>;
      setDelivery(snap.data());
      const detailPath = deliveryDetailPath(shopCode, deliveryNumber);
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
          <Flex justify_content="between">
            <div>
              <h1 className="text-2xl font-bold mb-3">
                出庫リスト {delivery?.date ? toDateString(delivery?.date?.toDate(), 'MM/DD') : ''}
                &emsp;
                <small>
                  {nameWithCode({ code: delivery?.shopCode ?? '', name: delivery?.shopName ?? '' })} →{' '}
                  {delivery?.dstShopName}
                </small>
              </h1>
              <Flex>
                <div className="bold border border-gray-300 text-center w-16 py-1">種類</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">{items.length}</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">商品数</div>
                <div className="bold border border-gray-300 text-center w-16 py-1">{sumItemQuantity()}</div>
                <div className="bold border border-gray-300 text-center w-24 py-1">金額(税抜)</div>
                <div className="bold border border-gray-300 text-center w-24 py-1">
                  <small>{sumItemCostPrice().toLocaleString()}円</small>
                </div>
              </Flex>
            </div>
            <div className="text-center">
              <small>出庫リスト番号 ({String(delivery?.deliveryNumber)})</small>
              <svg
                id="barcode"
                className="barcode"
                jsbarcode-format="EAN13"
                jsbarcode-width="1"
                jsbarcode-height="40"
                jsbarcode-value={genBarcode(String(delivery?.deliveryNumber), CLASS_DELIV)}
                jsbarcode-textmargin="0"
                jsbarcode-fontoptions="bold"
              ></svg>
            </div>
          </Flex>
          <Table className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell>No</Table.Cell>
                <Table.Cell>商品コード</Table.Cell>
                <Table.Cell>商品名</Table.Cell>
                <Table.Cell>数量</Table.Cell>
                <Table.Cell>仕入価格(税抜)</Table.Cell>
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
