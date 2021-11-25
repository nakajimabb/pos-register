import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, collection, setDoc, addDoc, Timestamp } from 'firebase/firestore';
import { useReactToPrint } from 'react-to-print';
import { Button, Form, Modal, Table } from './components';
import { Product, Sale, SaleDetail } from './types';

type BasketItem = {
  product: Product;
  quantity: number;
};

type Props = {
  open: boolean;
  basketItems: BasketItem[];
  setBasketItems: React.Dispatch<React.SetStateAction<BasketItem[]>>;
  onClose: () => void;
};

const db = getFirestore();

const RegisterPayment: React.FC<Props> = ({ open, basketItems, setBasketItems, onClose }) => {
  const [cash, setCash] = useState<number>(0);
  const componentRef = useRef(null);
  const pageStyle = `
    @media print {
      @page { size: JIS-B5 portrait; }
    }  
  `;

  const save = async () => {
    const sale: Sale = {
      code: '05',
      createdAt: Timestamp.fromDate(new Date()),
      detailsCount: basketItems.length,
      salesTotal: basketItems.reduce((result, item) => result + Number(item.product.price) * item.quantity, 0),
      taxTotal: 0,
      discountTotal: 0,
      paymentType: 'Cash',
      cashAmount: cash,
      salesNormalTotal: 0,
      salesReductionTotal: 0,
      taxNormalTotal: 0,
      taxReductionTotal: 0,
      status: 'Sales',
    };
    const docRef = await addDoc(collection(db, 'sales'), sale);
    await Promise.all(
      basketItems.map(async (item, index) => {
        const detail: SaleDetail = {
          salesId: docRef.id,
          index: index,
          productCode: item.product.code,
          price: Number(item.product.price),
          quantity: item.quantity,
          discount: 0,
          taxRate: 0,
          status: 'Sales',
        };
        await setDoc(doc(db, 'sales', docRef.id, 'saleDetails', index.toString()), detail);
      })
    );
  };

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    pageStyle,
    onAfterPrint: () => {
      save();
      setBasketItems([]);
      onClose();
    },
  });

  useEffect(() => {
    document.getElementById('inputCash')?.focus(); //非推奨
  }, [open]);

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-1/3">
      <Modal.Header centered={false} onClose={onClose}>
        お会計
      </Modal.Header>
      <Modal.Body>
        <Table border="row" className="table-fixed w-full">
          <Table.Body>
            <Table.Row>
              <Table.Cell type="th" className="text-xl bg-red-100">
                合計
              </Table.Cell>
              <Table.Cell className="text-right text-xl pr-4">
                ¥
                {basketItems
                  .reduce((result, item) => result + Number(item.product.price) * item.quantity, 0)
                  .toLocaleString()}
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell type="th">お預かり</Table.Cell>
              <Table.Cell>
                <Form onSubmit={handlePrint} className="space-y-2">
                  <Form.Text
                    id="inputCash"
                    placeholder="金額"
                    value={cash.toString()}
                    onChange={(e) => setCash(Number(e.target.value.replace(/\D/, '')))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && handlePrint) {
                        e.preventDefault();
                        handlePrint();
                      }
                    }}
                    className="text-right w-full"
                  />
                </Form>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell type="th">お釣り</Table.Cell>
              <Table.Cell className="text-right pr-4">
                ¥
                {(
                  cash - basketItems.reduce((result, item) => result + Number(item.product.price) * item.quantity, 0)
                ).toLocaleString()}
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>

        {/* 領収書 */}
        <div className="hidden">
          <div ref={componentRef} className="p-10">
            <p className="text-center text-lg m-2">領収書</p>
            <Table border="row" className="table-fixed w-full text-sm ">
              <Table.Head>
                <Table.Row>
                  <Table.Cell type="th" className="w-1/12" />
                  <Table.Cell type="th" className="w-5/12">
                    商品名
                  </Table.Cell>
                  <Table.Cell type="th" className="w-2/12">
                    数量
                  </Table.Cell>
                  <Table.Cell type="th" className="w-2/12">
                    単価
                  </Table.Cell>
                  <Table.Cell type="th" className="w-2/12">
                    金額
                  </Table.Cell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {basketItems?.map((basketItem, index) => (
                  <Table.Row key={index}>
                    <Table.Cell></Table.Cell>
                    <Table.Cell>{basketItem.product.name}</Table.Cell>
                    <Table.Cell className="text-right">{basketItem.quantity}</Table.Cell>
                    <Table.Cell className="text-right">¥{basketItem.product.price?.toLocaleString()}</Table.Cell>
                    <Table.Cell className="text-center">
                      ¥{(Number(basketItem.product.price) * basketItem.quantity)?.toLocaleString()}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>

            <Table border="row" className="table-fixed w-full">
              <Table.Body>
                <Table.Row>
                  <Table.Cell type="th" className="text-xl">
                    合計
                  </Table.Cell>
                  <Table.Cell className="text-right text-xl pr-4">
                    ¥
                    {basketItems
                      .reduce((result, item) => result + Number(item.product.price) * item.quantity, 0)
                      .toLocaleString()}
                  </Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell type="th">お預かり</Table.Cell>
                  <Table.Cell className="text-right pr-4">¥{cash.toLocaleString()}</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell type="th">お釣り</Table.Cell>
                  <Table.Cell className="text-right pr-4">
                    ¥
                    {(
                      cash -
                      basketItems.reduce((result, item) => result + Number(item.product.price) * item.quantity, 0)
                    ).toLocaleString()}
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="flex justify-end">
        <Button color="secondary" variant="outlined" className="mr-3" onClick={onClose}>
          キャンセル
        </Button>
        <Button onClick={handlePrint} color="primary">
          レシート発行
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RegisterPayment;
