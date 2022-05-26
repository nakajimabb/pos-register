import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, DocumentSnapshot, getDoc, collection, getDocs, QuerySnapshot } from 'firebase/firestore';
import clsx from 'clsx';
import { useReactToPrint } from 'react-to-print';
import { Flex, Modal, Table } from './components';
import { toDateString, nameWithCode } from './tools';
import { Rejection, RejectionDetail, rejectionPath, wasteReasons } from './types';
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
    <Modal open size="none" onClose={onClose} className={clsx('w-4/5 overflow-visible', mode === 'print' && 'hidden')}>
      <Modal.Body>
        <div ref={componentRef} className="print-p-3">
          <h1 className="text-2xl font-bold mb-3">
            廃棄・返品処理 {rejection?.date ? toDateString(rejection?.date?.toDate(), 'MM/DD') : ''}
            &emsp;
            <small>{nameWithCode({ code: rejection?.shopCode ?? '', name: rejection?.shopName ?? '' })} </small>
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
          <Table size={mode === 'print' ? 'xs' : 'md'} className="w-full">
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <Table.Head>
              <Table.Row>
                <Table.Cell>No1</Table.Cell>
                <Table.Cell>商品コード</Table.Cell>
                <Table.Cell>商品名</Table.Cell>
                <Table.Cell>種別</Table.Cell>
                <Table.Cell>数量</Table.Cell>
                <Table.Cell>
                  <small>仕入価格(税抜)</small>
                </Table.Cell>
                <Table.Cell>仕入先</Table.Cell>
                <Table.Cell>廃棄理由</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {items.map((item, i) => (
                <Table.Row key={i}>
                  <Table.Cell className="print-p-1">{i + 1}</Table.Cell>
                  <Table.Cell className="print-p-1">{item.productCode}</Table.Cell>
                  <Table.Cell className="print-p-1">{item.productName}</Table.Cell>
                  <Table.Cell className="print-p-1">
                    {item.rejectType === 'return' && '返品'}
                    {item.rejectType === 'waste' && '廃棄'}
                  </Table.Cell>
                  <Table.Cell className="print-p-1">{item.quantity}</Table.Cell>
                  <Table.Cell className="print-p-1">{item.costPrice?.toLocaleString()}</Table.Cell>
                  <Table.Cell className="print-p-1">{item.rejectType === 'return' && item.supplierName}</Table.Cell>
                  <Table.Cell className="print-p-1">
                    <small>{item.wasteReason && wasteReasons[item.wasteReason]}</small>
                  </Table.Cell>
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
