import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, collection, runTransaction, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useReactToPrint } from 'react-to-print';
import app from './firebase';
import { Button, Form, Modal, Table } from './components';
import { Product, Sale, SaleDetail, Stock } from './types';

type BasketItem = {
  product: Product;
  quantity: number;
};

type Props = {
  open: boolean;
  registerMode: 'Sales' | 'Return';
  paymentType: 'Cash' | 'Credit';
  basketItems: BasketItem[];
  setBasketItems: React.Dispatch<React.SetStateAction<BasketItem[]>>;
  onClose: () => void;
};

const db = getFirestore();

const RegisterPayment: React.FC<Props> = ({
  open,
  registerMode,
  paymentType,
  basketItems,
  setBasketItems,
  onClose,
}) => {
  const [cash, setCash] = useState<number>(0);
  const componentRef = useRef(null);
  const registerSign = registerMode === 'Return' ? -1 : 1;
  const pageStyle = `
    @media print {
      @page { size: JIS-B5 portrait; }
    }  
  `;

  const save = async () => {
    runTransaction(db, async (transaction) => {
      const functions = getFunctions(app, 'asia-northeast1');
      const result = await httpsCallable(functions, 'getSequence')({ docId: 'sales' });
      const receiptNumber = Number(result.data);
      const stocks: Stock[] = [];
      await Promise.all(
        basketItems.map(async (item, index) => {
          if (item.product.code) {
            const stockRef = doc(collection(db, 'shops', '05', 'stocks'), item.product.code);
            const stockDoc = await transaction.get(stockRef);
            if (stockDoc.exists()) {
              stocks[index] = stockDoc.data() as Stock;
            } else {
              stocks[index] = {
                shopCode: '05',
                productCode: item.product.code,
                productName: item.product.name,
                quantity: 0,
                updatedAt: Timestamp.fromDate(new Date()),
              };
            }
          }
        })
      );

      const sale: Sale = {
        receiptNumber,
        code: '05',
        createdAt: Timestamp.fromDate(new Date()),
        detailsCount: basketItems.filter((item) => !!item.product.code).length,
        salesTotal,
        taxTotal: taxNormalTotal + taxReducedTotal,
        discountTotal: 0,
        paymentType,
        cashAmount: cash,
        salesNormalTotal: priceNormalTotal + taxNormalTotal,
        salesReducedTotal: priceReducedTotal + taxReducedTotal,
        taxNormalTotal,
        taxReducedTotal,
        status: registerMode,
      };
      const saleRef = doc(collection(db, 'sales'), receiptNumber.toString());
      transaction.set(saleRef, sale);

      let discountTotal = 0;
      basketItems.map((item, index) => {
        const detail: SaleDetail = {
          salesId: saleRef.id,
          index: index,
          product: item.product,
          quantity: item.quantity,
          discount: 0,
          status: registerMode,
        };
        const detailRef = doc(collection(db, 'sales', saleRef.id, 'saleDetails'), index.toString());
        transaction.set(detailRef, detail);
        if (!item.product.code && item.product.sellingPrice) {
          const prevDetailRef = doc(collection(db, 'sales', saleRef.id, 'saleDetails'), (index - 1).toString());
          transaction.update(prevDetailRef, { discount: -item.product.sellingPrice });
          discountTotal += -item.product.sellingPrice;
        }
        const stockRef = doc(collection(db, 'shops', '05', 'stocks'), item.product.code);
        transaction.set(stockRef, {
          ...stocks[index],
          quantity: stocks[index].quantity - item.quantity * registerSign,
        });
      });
      transaction.update(saleRef, { discountTotal });
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

  const priceNormalTotal = ((items: BasketItem[]) => {
    return (
      items
        .filter((item) => item.product.sellingTax === 10)
        .reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) * registerSign
    );
  })(basketItems);

  const priceReducedTotal = ((items: BasketItem[]) => {
    return (
      items
        .filter((item) => item.product.sellingTax === 8)
        .reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) * registerSign
    );
  })(basketItems);

  const taxNormalTotal = Math.floor(priceNormalTotal * 0.1);
  const taxReducedTotal = Math.floor(priceReducedTotal * 0.08);

  const salesTotal = ((items: BasketItem[]) => {
    return (
      items.reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) * registerSign +
      taxReducedTotal +
      taxNormalTotal
    );
  })(basketItems);

  useEffect(() => {
    if (registerMode === 'Return') {
      setCash(-salesTotal);
    } else {
      setCash(paymentType === 'Cash' ? 0 : salesTotal);
    }
    const inputCash = document.getElementById('inputCash') as HTMLInputElement;
    inputCash?.focus();
    inputCash?.select();
  }, [open]);

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-1/3">
      <Modal.Header centered={false} onClose={onClose}>
        {registerMode === 'Return' ? '返品' : 'お会計'}
      </Modal.Header>
      <Modal.Body>
        <Table border="row" className="table-fixed w-full">
          <Table.Body>
            <Table.Row>
              <Table.Cell type="th" className="text-xl bg-red-100">
                {registerMode === 'Return' ? 'ご返金' : '合計'}
              </Table.Cell>
              <Table.Cell className="text-right text-xl pr-4">¥{salesTotal.toLocaleString()}</Table.Cell>
            </Table.Row>
            <Table.Row className={registerMode === 'Return' ? 'hidden' : ''}>
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
            <Table.Row className={registerMode === 'Return' ? 'hidden' : ''}>
              <Table.Cell type="th">お釣り</Table.Cell>
              <Table.Cell className="text-right pr-4">
                ¥{cash < salesTotal ? '0' : (cash - salesTotal).toLocaleString()}
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>

        {/* 領収書 */}
        <div className="hidden">
          <div ref={componentRef} className="p-10">
            <p className="text-center text-xl font-bold m-2">{registerMode === 'Return' ? '返品' : '領収書'}</p>
            <Table border="cell" className="table-fixed w-full text-sm shadow-none">
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

            <Table border="none" size="sm" className="table-fixed w-1/2 mt-4 shadow-none ml-96">
              <Table.Head>
                <Table.Row>
                  <Table.Cell type="th" className="w-3/12" />
                  <Table.Cell type="th" className="w-3/12" />
                  <Table.Cell type="th" className="w-6/12" />
                </Table.Row>
              </Table.Head>
              <Table.Body>
                <Table.Row>
                  <Table.Cell type="th" className="text-lg">
                    {registerMode === 'Return' ? 'ご返金' : '合計'}
                  </Table.Cell>
                  <Table.Cell className="text-right text-xl pr-4">¥{salesTotal.toLocaleString()}</Table.Cell>
                  <Table.Cell></Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell type="th">8%対象</Table.Cell>
                  <Table.Cell className="text-right pr-4">
                    ¥{(priceReducedTotal + taxReducedTotal + 0).toLocaleString()}
                  </Table.Cell>
                  <Table.Cell>（内消費税等　¥{(taxReducedTotal + 0).toLocaleString()}）</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell type="th">10%対象</Table.Cell>
                  <Table.Cell className="text-right pr-4">
                    ¥{(priceNormalTotal + taxNormalTotal + 0).toLocaleString()}
                  </Table.Cell>
                  <Table.Cell>（内消費税等　¥{(taxNormalTotal + 0).toLocaleString()}）</Table.Cell>
                </Table.Row>
                {registerMode === 'Return' ? null : (
                  <Table.Row>
                    <Table.Cell type="th">お預かり</Table.Cell>
                    <Table.Cell className="text-right pr-4">¥{cash.toLocaleString()}</Table.Cell>
                    <Table.Cell></Table.Cell>
                  </Table.Row>
                )}
                {registerMode === 'Return' ? null : (
                  <Table.Row>
                    <Table.Cell type="th">お釣り</Table.Cell>
                    <Table.Cell className="text-right pr-4">
                      ¥{cash < salesTotal ? '0' : (cash - salesTotal).toLocaleString()}
                    </Table.Cell>
                    <Table.Cell></Table.Cell>
                  </Table.Row>
                )}
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
