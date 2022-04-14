import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, DocumentSnapshot, getDoc, collection, getDocs, QuerySnapshot } from 'firebase/firestore';
import clsx from 'clsx';
import { useReactToPrint } from 'react-to-print';
import { Flex, Modal, Table } from './components';
import { toDateString, nameWithCode } from './tools';
import { Rejection, RejectionDetail, rejectionPath } from './types';
var JsBarcode = require('jsbarcode');

const db = getFirestore();

type Props = {
  mode: 'modal' | 'print';
  shopCode: string;
  rejectionNumber: number;
  onClose: () => void;
};

const RejectionPrint: React.FC<Props> = ({ mode, shopCode, rejectionNumber, onClose }) => {
  const [items, setItems] = useState<RejectionDetail[]>([]);
  const [rejection, setRejection] = useState<Rejection | undefined>(undefined);
  const [loaded, setLoaded] = useState<boolean>(false);
  const pageStyle = `
    @media print {
      @page { size: JIS-B5 portrait; }
    }  
  `;
  const componentRef = useRef(null);

  useEffect(() => {
    loadRejectionDetails(shopCode, rejectionNumber);
  }, [shopCode, rejectionNumber]);

  useEffect(() => {
    try {
      JsBarcode('.barcode').init();
    } catch (err) {
      console.log({ err });
    }
    if (loaded && handlePrint && mode === 'print') handlePrint();
  }, [loaded]);

  const loadRejectionDetails = async (shopCode: string, rejectionNumber: number) => {
    if (shopCode && rejectionNumber) {
      const delivPath = rejectionPath(shopCode, rejectionNumber);
      const snap = (await getDoc(doc(db, delivPath))) as DocumentSnapshot<Rejection>;
      setRejection(snap.data());
      const detailPath = delivPath + '/rejectionDetails';
      const qSnap = (await getDocs(collection(db, detailPath))) as QuerySnapshot<RejectionDetail>;
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
            廃棄・返品処理 {rejection?.date ? toDateString(rejection?.date?.toDate(), 'MM/DD') : ''}
            &emsp;
            <small>{nameWithCode({ code: rejection?.shopCode ?? '', name: rejection?.shopName ?? '' })} </small>
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
          <Table className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell>No</Table.Cell>
                <Table.Cell>商品コード</Table.Cell>
                <Table.Cell>商品名</Table.Cell>
                <Table.Cell>種別</Table.Cell>
                <Table.Cell>数量</Table.Cell>
                <Table.Cell>仕入価格(税抜)</Table.Cell>
                <Table.Cell>理由</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {items.map((item, i) => (
                <Table.Row key={i}>
                  <Table.Cell>{i + 1}</Table.Cell>
                  <Table.Cell>{item.productCode}</Table.Cell>
                  <Table.Cell>{item.productName}</Table.Cell>
                  <Table.Cell>
                    {item.rejectType === 'return' && '返品'}
                    {item.rejectType === 'waste' && '廃棄'}
                  </Table.Cell>
                  <Table.Cell>{item.quantity}</Table.Cell>
                  <Table.Cell>{item.costPrice?.toLocaleString()}</Table.Cell>
                  <Table.Cell>{item.reason}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default RejectionPrint;
