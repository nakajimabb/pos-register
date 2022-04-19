import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, collection, runTransaction, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useReactToPrint } from 'react-to-print';
import app from './firebase';
import { Button, Flex, Form, Modal, Table } from './components';
import { useAppContext } from './AppContext';
import { Sale, SaleDetail, Stock, BasketItem } from './types';
import { prefectureName } from './prefecture';
import { toNumber, OTC_DIVISION } from './tools';

type Props = {
  open: boolean;
  registerMode: 'Sales' | 'Return';
  paymentType: 'Cash' | 'Credit';
  basketItems: BasketItem[];
  setBasketItems: React.Dispatch<React.SetStateAction<BasketItem[]>>;
  setRegisterMode: React.Dispatch<React.SetStateAction<'Sales' | 'Return'>>;
  onClose: () => void;
};

const db = getFirestore();

const RegisterPayment: React.FC<Props> = ({
  open,
  registerMode,
  paymentType,
  basketItems,
  setBasketItems,
  setRegisterMode,
  onClose,
}) => {
  const { currentShop, productBulks, incrementStock } = useAppContext();
  const [cashText, setCashText] = useState<string>('0');
  const [currentTimestamp, setCurrentTimestamp] = useState<Timestamp>(Timestamp.fromDate(new Date()));
  const componentRef = useRef(null);
  const registerSign = registerMode === 'Return' ? -1 : 1;
  const pageStyle = `
    @media print {
      @page { size: JIS-B5 portrait; }
    }  
  `;

  const save = async () => {
    if (!currentShop) return;
    runTransaction(db, async (transaction) => {
      const functions = getFunctions(app, 'asia-northeast1');
      const result = await httpsCallable(functions, 'getSequence')({ docId: 'sales' });
      const receiptNumber = Number(result.data);
      const sale: Sale = {
        receiptNumber,
        shopCode: currentShop.code,
        createdAt: currentTimestamp,
        detailsCount: basketItems.filter((item) => !!item.product.code).length,
        salesTotal: salesExceptHidden,
        taxTotal:
          exclusiveTaxNormalTotal + inclusiveTaxNormalTotal + exclusiveTaxReducedTotal + inclusiveTaxReducedTotal,
        discountTotal: 0,
        paymentType,
        cashAmount: toNumber(cashText),
        salesTaxFreeTotal: priceTaxFreeTotal,
        salesNormalTotal: priceNormalTotal + exclusiveTaxNormalTotal,
        salesReducedTotal: priceReducedTotal + exclusiveTaxReducedTotal,
        taxNormalTotal: exclusiveTaxNormalTotal + inclusiveTaxNormalTotal,
        taxReducedTotal: exclusiveTaxReducedTotal + inclusiveTaxReducedTotal,
        status: registerMode,
      };
      const saleRef = doc(collection(db, 'sales'));
      transaction.set(saleRef, sale);

      let discountTotal = 0;
      basketItems.forEach((item, index) => {
        const detail: SaleDetail = {
          salesId: saleRef.id,
          index: index,
          product: item.product,
          division: item.division,
          quantity: item.quantity,
          discount: 0,
          outputReceipt: item.outputReceipt,
          status: registerMode,
        };
        const detailRef = doc(collection(db, 'sales', saleRef.id, 'saleDetails'), index.toString());
        transaction.set(detailRef, detail);
        if (!item.product.code && item.product.sellingPrice) {
          const prevDetailRef = doc(collection(db, 'sales', saleRef.id, 'saleDetails'), (index - 1).toString());
          transaction.update(prevDetailRef, { discount: -item.product.sellingPrice });
          discountTotal += -item.product.sellingPrice;
        }
        if (item.product.code && item.division === OTC_DIVISION) {
          const incr = -item.quantity * registerSign;
          incrementStock(currentShop.code, item.product.code, item.product.name, incr, transaction);
        }
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
      setRegisterMode('Sales');
      onClose();
    },
  });

  const priceNormalTotal = ((items: BasketItem[]) => {
    return (
      items
        .filter((item) => item.outputReceipt && item.product.sellingTax === 10)
        .reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) * registerSign
    );
  })(basketItems);

  const priceReducedTotal = ((items: BasketItem[]) => {
    return (
      items
        .filter((item) => item.outputReceipt && item.product.sellingTax === 8)
        .reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) * registerSign
    );
  })(basketItems);

  const priceTaxFreeTotal = ((items: BasketItem[]) => {
    return (
      items
        .filter((item) => item.outputReceipt && item.product.sellingTax === 0)
        .reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) * registerSign
    );
  })(basketItems);

  const exclusiveTaxNormalTotal = ((items: BasketItem[]) => {
    return (
      Math.floor(
        (items
          .filter(
            (item) =>
              item.outputReceipt && item.product.sellingTaxClass === 'exclusive' && item.product.sellingTax === 10
          )
          .reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) *
          10) /
          100
      ) * registerSign
    );
  })(basketItems);

  const inclusiveTaxNormalTotal = ((items: BasketItem[]) => {
    return (
      Math.floor(
        (items
          .filter(
            (item) =>
              item.outputReceipt && item.product.sellingTaxClass === 'inclusive' && item.product.sellingTax === 10
          )
          .reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) *
          10) /
          (100 + 10)
      ) * registerSign
    );
  })(basketItems);

  const exclusiveTaxReducedTotal = ((items: BasketItem[]) => {
    return (
      Math.floor(
        (items
          .filter(
            (item) =>
              item.outputReceipt && item.product.sellingTaxClass === 'exclusive' && item.product.sellingTax === 8
          )
          .reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) *
          8) /
          100
      ) * registerSign
    );
  })(basketItems);

  const inclusiveTaxReducedTotal = ((items: BasketItem[]) => {
    return (
      Math.floor(
        (items
          .filter(
            (item) =>
              item.outputReceipt && item.product.sellingTaxClass === 'inclusive' && item.product.sellingTax === 8
          )
          .reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) *
          8) /
          (100 + 8)
      ) * registerSign
    );
  })(basketItems);

  const salesTotal = ((items: BasketItem[]) => {
    return (
      items.reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) * registerSign +
      exclusiveTaxReducedTotal +
      exclusiveTaxNormalTotal
    );
  })(basketItems);

  const salesExceptHidden = ((items: BasketItem[]) => {
    return (
      items
        .filter((item) => item.outputReceipt)
        .reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) *
        registerSign +
      exclusiveTaxReducedTotal +
      exclusiveTaxNormalTotal
    );
  })(basketItems);

  useEffect(() => {
    if (registerMode === 'Return') {
      setCashText((-salesTotal).toString());
    } else {
      setCashText(salesTotal.toString());
    }
    setCurrentTimestamp(Timestamp.fromDate(new Date()));
    const inputCash = document.getElementById('inputCash') as HTMLInputElement;
    inputCash?.focus();
    inputCash?.select();
  }, [open, registerMode, paymentType, salesTotal]);

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-1/3">
      <Modal.Header
        centered={false}
        onClose={onClose}
        className={paymentType === 'Cash' ? 'bg-blue-200' : 'bg-green-200'}
      >
        {registerMode === 'Return' ? '返品' : 'お会計'}
        {paymentType === 'Cash' ? '（現金）' : '（クレジット）'}
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
                    value={cashText}
                    onChange={(e) => setCashText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && handlePrint) {
                        e.preventDefault();
                        if (toNumber(cashText) >= salesTotal) {
                          if (basketItems.some((item) => item.outputReceipt) && handlePrint) {
                            handlePrint();
                          } else {
                            save();
                            setBasketItems([]);
                            setRegisterMode('Sales');
                            onClose();
                          }
                        }
                      }
                    }}
                    onBlur={() => setCashText(toNumber(cashText).toString())}
                    className="text-right w-full"
                  />
                </Form>
              </Table.Cell>
            </Table.Row>
            <Table.Row className={registerMode === 'Return' ? 'hidden' : ''}>
              <Table.Cell type="th">お釣り</Table.Cell>
              <Table.Cell className="text-right pr-4">
                ¥{toNumber(cashText) < salesTotal ? '0' : (toNumber(cashText) - salesTotal).toLocaleString()}
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>

        {/* 領収書 */}
        <div className="hidden">
          <div ref={componentRef} className="p-10">
            <p className="text-right text-sm mt-2">
              {currentTimestamp.toDate().toLocaleDateString()} {currentTimestamp.toDate().toLocaleTimeString()}
            </p>
            <p className="text-right text-sm mt-2">
              {currentShop ? prefectureName(currentShop.prefecture) : ''}
              {currentShop?.municipality}
              {currentShop?.houseNumber}
              {currentShop?.buildingName}
            </p>
            <p className="text-right text-sm mt-2">{currentShop?.formalName}</p>
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
                {basketItems
                  ?.filter((basketItem) => basketItem.outputReceipt)
                  ?.map((basketItem, index) => (
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

            <Flex className="mt-4">
              <div className="text-xs w-1/3 mt-4">
                軽印は、軽減税率対象商品です。 <br />
                ★印は、セルフメディケーション
                <br />
                税制対象製品です。
              </div>

              <Table border="none" size="sm" className="table-fixed w-2/3 shadow-none">
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
                    <Table.Cell className="text-right text-xl pr-4">¥{salesExceptHidden.toLocaleString()}</Table.Cell>
                    <Table.Cell></Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell type="th">非課税対象</Table.Cell>
                    <Table.Cell className="text-right pr-4">¥{priceTaxFreeTotal.toLocaleString()}</Table.Cell>
                    <Table.Cell></Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell type="th">8%対象</Table.Cell>
                    <Table.Cell className="text-right pr-4">
                      ¥{(priceReducedTotal + exclusiveTaxReducedTotal + 0).toLocaleString()}
                    </Table.Cell>
                    <Table.Cell>
                      （内消費税等　¥{(exclusiveTaxReducedTotal + inclusiveTaxReducedTotal + 0).toLocaleString()}）
                    </Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell type="th">10%対象</Table.Cell>
                    <Table.Cell className="text-right pr-4">
                      ¥{(priceNormalTotal + exclusiveTaxNormalTotal + 0).toLocaleString()}
                    </Table.Cell>
                    <Table.Cell>
                      （内消費税等　¥{(exclusiveTaxNormalTotal + inclusiveTaxNormalTotal + 0).toLocaleString()}）
                    </Table.Cell>
                  </Table.Row>
                  {registerMode === 'Return' || basketItems.some((item) => !item.outputReceipt) ? null : (
                    <Table.Row>
                      <Table.Cell type="th">お預かり</Table.Cell>
                      <Table.Cell className="text-right pr-4">¥{toNumber(cashText).toLocaleString()}</Table.Cell>
                      <Table.Cell></Table.Cell>
                    </Table.Row>
                  )}
                  {registerMode === 'Return' || basketItems.some((item) => !item.outputReceipt) ? null : (
                    <Table.Row>
                      <Table.Cell type="th">お釣り</Table.Cell>
                      <Table.Cell className="text-right pr-4">
                        ¥{toNumber(cashText) < salesTotal ? '0' : (toNumber(cashText) - salesTotal).toLocaleString()}
                      </Table.Cell>
                      <Table.Cell></Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table>
            </Flex>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="flex justify-end">
        <Button color="secondary" variant="outlined" className="mr-3" onClick={onClose}>
          キャンセル
        </Button>
        <Button
          onClick={(e) => {
            if (basketItems.some((item) => item.outputReceipt) && handlePrint) {
              handlePrint();
            } else {
              save();
              setBasketItems([]);
              setRegisterMode('Sales');
              onClose();
            }
          }}
          color="primary"
          disabled={toNumber(cashText) < salesTotal}
        >
          レシート発行
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RegisterPayment;
