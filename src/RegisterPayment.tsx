import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, collection, setDoc, runTransaction, Timestamp } from 'firebase/firestore';
import { useReactToPrint } from 'react-to-print';
import { Button, Form, Modal, Table } from './components';
import { Product, Sale, SaleDetail } from './types';

type BasketItem = {
  product: Product;
  quantity: number;
};

type Props = {
  open: boolean;
  paymentType: 'Cash' | 'Credit';
  basketItems: BasketItem[];
  setBasketItems: React.Dispatch<React.SetStateAction<BasketItem[]>>;
  onClose: () => void;
};

const db = getFirestore();

const RegisterPayment: React.FC<Props> = ({ open, paymentType, basketItems, setBasketItems, onClose }) => {
  const [cash, setCash] = useState<number>(0);
  const componentRef = useRef(null);
  const pageStyle = `
    @media print {
      @page { size: JIS-B5 portrait; }
    }  
  `;

  const save = async () => {
    runTransaction(db, async (transaction) => {
      const sale: Sale = {
        code: '05',
        createdAt: Timestamp.fromDate(new Date()),
        detailsCount: basketItems.filter((item) => !!item.product.code).length,
        salesTotal: calcTotal(basketItems),
        taxTotal: calcNormalTax(basketItems) + calcReducedTax(basketItems),
        discountTotal: 0,
        paymentType,
        cashAmount: cash,
        salesNormalTotal: calcNormalTotal(basketItems) + calcNormalTax(basketItems),
        salesReductionTotal: calcReducedTotal(basketItems) + calcReducedTax(basketItems),
        taxNormalTotal: calcNormalTax(basketItems),
        taxReductionTotal: calcReducedTax(basketItems),
        status: 'Sales',
      };
      const saleRef = doc(collection(db, 'sales'));
      transaction.set(saleRef, sale);

      let discountTotal = 0;
      basketItems.map((item, index) => {
        const detail: SaleDetail = {
          salesId: saleRef.id,
          index: index,
          product: item.product,
          quantity: item.quantity,
          discount: 0,
          status: 'Sales',
        };
        const detailRef = doc(collection(db, 'sales', saleRef.id, 'saleDetails'), index.toString());
        transaction.set(detailRef, detail);
        if (!item.product.code && item.product.sellingPrice) {
          const prevDetailRef = doc(collection(db, 'sales', saleRef.id, 'saleDetails'), (index - 1).toString());
          transaction.update(prevDetailRef, { discount: -item.product.sellingPrice });
          discountTotal += -item.product.sellingPrice;
        }
        transaction.update(saleRef, { discountTotal });
      });
    });
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

  const calcTotal = (items: BasketItem[]) => {
    return (
      items.reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) +
      calcReducedTax(items) +
      calcNormalTax(items)
    );
  };

  const calcNormalTotal = (items: BasketItem[]) => {
    return items
      .filter((item) => item.product.sellingTax === 10)
      .reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0);
  };

  const calcReducedTotal = (items: BasketItem[]) => {
    return items
      .filter((item) => item.product.sellingTax === 8)
      .reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0);
  };

  const calcNormalTax = (items: BasketItem[]) => {
    return Math.floor(calcNormalTotal(items) * 0.1);
  };

  const calcReducedTax = (items: BasketItem[]) => {
    return Math.floor(calcReducedTotal(items) * 0.08);
  };

  useEffect(() => {
    setCash(paymentType === 'Cash' ? 0 : calcTotal(basketItems));
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
              <Table.Cell className="text-right text-xl pr-4">¥{calcTotal(basketItems).toLocaleString()}</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell type="th">お預かり</Table.Cell>
              <Table.Cell>
                <Form onSubmit={handlePrint} className="space-y-2">
                  <Form.Text
                    id="inputCash"
                    placeholder="金額"
                    value={cash.toString()}
                    onChange={(e) => setCash(Number(e.target.value.replace(/\D/, '')) || 0)}
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
              <Table.Cell className="text-right pr-4">¥{(cash - calcTotal(basketItems)).toLocaleString()}</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>

        {/* 領収書 */}
        <div className="hidden">
          <div ref={componentRef} className="p-10">
            <p className="text-center text-lg m-2">領収書</p>
            <Table border="cell" className="table-fixed w-full text-sm">
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
                    <Table.Cell>
                      {basketItem.product.selfMedication ? '★' : ''}
                      {basketItem.product.sellingTax === 8 ? '軽' : ''}
                    </Table.Cell>
                    <Table.Cell>{basketItem.product.name}</Table.Cell>
                    <Table.Cell className="text-right">
                      {basketItem.product.code ? basketItem.quantity : null}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {basketItem.product.code ? `¥${basketItem.product.sellingPrice?.toLocaleString()}` : null}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      ¥{(Number(basketItem.product.sellingPrice) * basketItem.quantity)?.toLocaleString()}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>

            <Table border="none" className="table-fixed w-2/3 mt-4 shadow-none ml-72">
              <Table.Head>
                <Table.Row>
                  <Table.Cell type="th" className="w-3/12" />
                  <Table.Cell type="th" className="w-3/12" />
                  <Table.Cell type="th" className="w-6/12" />
                </Table.Row>
              </Table.Head>
              <Table.Body>
                <Table.Row>
                  <Table.Cell type="th" className="text-xl">
                    合計
                  </Table.Cell>
                  <Table.Cell className="text-right text-xl pr-4">
                    ¥{calcTotal(basketItems).toLocaleString()}
                  </Table.Cell>
                  <Table.Cell></Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell type="th">8%対象</Table.Cell>
                  <Table.Cell className="text-right pr-4">
                    ¥{(calcReducedTotal(basketItems) + calcReducedTax(basketItems)).toLocaleString()}
                  </Table.Cell>
                  <Table.Cell>（内消費税等　¥{calcReducedTax(basketItems).toLocaleString()}）</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell type="th">10%対象</Table.Cell>
                  <Table.Cell className="text-right pr-4">
                    ¥{(calcNormalTotal(basketItems) + calcNormalTax(basketItems)).toLocaleString()}
                  </Table.Cell>
                  <Table.Cell>（内消費税等　¥{calcNormalTax(basketItems).toLocaleString()}）</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell type="th">お預かり</Table.Cell>
                  <Table.Cell className="text-right pr-4">¥{cash.toLocaleString()}</Table.Cell>
                  <Table.Cell></Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell type="th">お釣り</Table.Cell>
                  <Table.Cell className="text-right pr-4">
                    ¥{(cash - calcTotal(basketItems)).toLocaleString()}
                  </Table.Cell>
                  <Table.Cell></Table.Cell>
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
