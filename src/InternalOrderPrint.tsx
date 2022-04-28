import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, DocumentSnapshot, getDoc, collection, getDocs, QuerySnapshot } from 'firebase/firestore';
import clsx from 'clsx';
import { useReactToPrint } from 'react-to-print';
import { Flex, Modal, Table } from './components';
import { toDateString, nameWithCode } from './tools';
import { InternalOrder, InternalOrderDetail, internalOrderPath } from './types';
var JsBarcode = require('jsbarcode');

const db = getFirestore();

type Props = {
  mode: 'modal' | 'print';
  shopCode: string;
  internalOrderNumber: number;
  onClose: () => void;
};

const InternalOrderPrint: React.FC<Props> = ({ mode, shopCode, internalOrderNumber, onClose }) => {
  const [items, setItems] = useState<InternalOrderDetail[]>([]);
  const [internalOrder, setInternalOrder] = useState<InternalOrder | undefined>(undefined);
  const [loaded, setLoaded] = useState<boolean>(false);
  const pageStyle = `
    @media print {
      @page { size: JIS-B5 portrait; }
    }  
  `;
  const componentRef = useRef(null);

  useEffect(() => {
    loadInternalOrderDetails(shopCode, internalOrderNumber);
  }, [shopCode, internalOrderNumber]);

  useEffect(() => {
    try {
      JsBarcode('.barcode').init();
    } catch (err) {
      console.log({ err });
    }
    if (loaded && handlePrint && mode === 'print') handlePrint();
  }, [loaded]);

  const loadInternalOrderDetails = async (shopCode: string, internalOrderNumber: number) => {
    if (shopCode && internalOrderNumber) {
      const delivPath = internalOrderPath(shopCode, internalOrderNumber);
      const snap = (await getDoc(doc(db, delivPath))) as DocumentSnapshot<InternalOrder>;
      setInternalOrder(snap.data());
      const detailPath = delivPath + '/internalOrderDetails';
      const qSnap = (await getDocs(collection(db, detailPath))) as QuerySnapshot<InternalOrderDetail>;
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
    <Modal open size="none" onClose={onClose} className={clsx('w-4/5 overflow-visible', mode === 'print' && 'hidden')}>
      <Modal.Body>
        <div ref={componentRef}>
          <h1 className="text-2xl font-bold mb-3">
            社内発注 {internalOrder?.date ? toDateString(internalOrder?.date?.toDate(), 'MM/DD') : ''}
            &emsp;
            <small>{nameWithCode({ code: internalOrder?.shopCode ?? '', name: internalOrder?.shopName ?? '' })} </small>
          </h1>
          <Flex>
            <div className="bold border border-gray-300 text-center w-16 py-1">種類</div>
            <div className="bold border border-gray-300 text-center w-16 py-1">
              {items.filter((detail) => detail.quantity !== 0).length}
            </div>
            <div className="bold border border-gray-300 text-center w-16 py-1">商品数</div>
            <div className="bold border border-gray-300 text-center w-16 py-1">{sumItemQuantity()}</div>
            <div className="bold border border-gray-300 text-center w-24 py-1">金額(税抜)</div>
            <div className="bold border border-gray-300 text-center w-24 py-1">
              <small>{sumItemCostPrice().toLocaleString()}円</small>
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
                  <Table.Cell>{item.costPrice?.toLocaleString()}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default InternalOrderPrint;
