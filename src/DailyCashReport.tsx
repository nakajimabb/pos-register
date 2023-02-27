import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import {
  getFirestore,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';
import { startOfToday, startOfTomorrow } from 'date-fns';
import { Button, Flex, Table } from './components';
import { useAppContext } from './AppContext';
import { Sale, SaleDetail, RegisterStatus } from './types';
import { Divisions } from './tools';

const db = getFirestore();

const DailyCashReport: React.FC = () => {
  const { currentShop } = useAppContext();
  const [completed, setCompleted] = useState<boolean>(false);
  const [reportItems, setReportItems] = useState<{ [code: string]: number }>({});
  const [registerStatus, setRegisterStatus] = useState<RegisterStatus>();
  const componentRef = useRef(null);
  const [reportTimestamp, setReportTimestamp] = useState<Timestamp>(Timestamp.fromDate(new Date()));

  const getRegisterStatus = useCallback(async () => {
    if (currentShop) {
      const statusRef = collection(db, 'shops', currentShop.code, 'status');
      const statusSnap = await getDocs(query(statusRef, orderBy('openedAt', 'desc'), limit(1)));
      if (statusSnap.size > 0) {
        statusSnap.docs.map(async (doc) => {
          const status = doc.data() as RegisterStatus;
          if (status.closedAt) {
            setReportTimestamp(status.closedAt);
          }
          setRegisterStatus(status);
        });
      }
    }
  }, [currentShop, setReportTimestamp, setRegisterStatus]);

  const querySales = useCallback(async () => {
    if (completed) return;
    if (!currentShop) return;
    try {
      const conds: QueryConstraint[] = [];
      conds.push(where('shopCode', '==', currentShop.code));
      if (registerStatus) {
        conds.push(where('createdAt', '>=', registerStatus.openedAt.toDate()));
        if (registerStatus.closedAt) {
          conds.push(where('createdAt', '<', registerStatus.closedAt.toDate()));
        }
      } else {
        conds.push(where('createdAt', '>=', startOfToday()));
        conds.push(where('createdAt', '<', startOfTomorrow()));
      }
      conds.push(orderBy('createdAt', 'desc'));
      const q = query(collection(db, 'sales'), ...conds);
      const querySnapshot = await getDocs(q);
      const reportItemsData: { [code: string]: number } = {};
      reportItemsData['detailsCountTotal'] = 0;
      reportItemsData['detailsAmountTotal'] = 0;
      reportItemsData['cashCountTotal'] = 0;
      reportItemsData['cashAmountTotal'] = 0;
      reportItemsData['creditCountTotal'] = 0;
      reportItemsData['creditAmountTotal'] = 0;
      reportItemsData['digitalCountTotal'] = 0;
      reportItemsData['digitalAmountTotal'] = 0;
      reportItemsData['receivableCountTotal'] = 0;
      reportItemsData['receivableAmountTotal'] = 0;
      reportItemsData['customerCountTotal'] = 0;
      reportItemsData['customerAmountTotal'] = 0;
      reportItemsData['discountCountTotal'] = 0;
      reportItemsData['discountAmountTotal'] = 0;
      reportItemsData['returnCountTotal'] = 0;
      reportItemsData['returnAmountTotal'] = 0;
      reportItemsData['inclusivePriceNormalTotal'] = 0;
      reportItemsData['inclusiveTaxNormalTotal'] = 0;
      reportItemsData['inclusivePriceReducedTotal'] = 0;
      reportItemsData['inclusiveTaxReducedTotal'] = 0;
      reportItemsData['exclusivePriceNormalTotal'] = 0;
      reportItemsData['exclusiveTaxNormalTotal'] = 0;
      reportItemsData['exclusivePriceReducedTotal'] = 0;
      reportItemsData['exclusiveTaxReducedTotal'] = 0;
      reportItemsData['exclusiveTaxNormalCashTotal'] = 0;
      reportItemsData['exclusiveTaxReducedCashTotal'] = 0;
      reportItemsData['exclusiveTaxNormalCreditTotal'] = 0;
      reportItemsData['exclusiveTaxReducedCreditTotal'] = 0;
      reportItemsData['exclusiveTaxNormalDigitalTotal'] = 0;
      reportItemsData['exclusiveTaxReducedDigitalTotal'] = 0;
      reportItemsData['exclusiveTaxNormalReceivableTotal'] = 0;
      reportItemsData['exclusiveTaxReducedReceivableTotal'] = 0;
      reportItemsData['priceTaxFreeTotal'] = 0;
      Object.keys(Divisions).forEach((division) => {
        reportItemsData[`division${division}CountTotal`] = 0;
        reportItemsData[`division${division}AmountTotal`] = 0;
        reportItemsData[`division${division}DiscountCountTotal`] = 0;
        reportItemsData[`division${division}DiscountAmountTotal`] = 0;
      });
      reportItemsData[`divisionAllCountTotal`] = 0;
      reportItemsData[`divisionAllAmountTotal`] = 0;
      reportItemsData[`divisionAllDiscountCountTotal`] = 0;
      reportItemsData[`divisionAllDiscountAmountTotal`] = 0;

      await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const sale = doc.data() as Sale;

          const registerSign = sale.status === 'Return' ? -1 : 1;

          let exclusivePriceNormalTotal = 0;
          let exclusivePriceReducedTotal = 0;
          let inclusivePriceNormalTotal = 0;
          let inclusivePriceReducedTotal = 0;
          let priceTaxFreeTotal = 0;

          reportItemsData['customerCountTotal'] += 1;

          if (sale.status === 'Return') {
            reportItemsData['returnCountTotal'] += 1;
          }

          if (sale.paymentType === 'Cash') {
            reportItemsData['cashCountTotal'] += 1;
          } else if (sale.paymentType === 'Credit') {
            reportItemsData['creditCountTotal'] += 1;
          } else if (sale.paymentType === 'Digital') {
            reportItemsData['digitalCountTotal'] += 1;
          } else if (sale.paymentType === 'Receivable') {
            reportItemsData['receivableCountTotal'] += 1;
          }

          if (sale.discountTotal > 0) {
            reportItemsData['discountCountTotal'] += 1;
            reportItemsData['discountAmountTotal'] += sale.discountTotal;
          }

          const detailsSnapshot = await getDocs(collection(db, 'sales', doc.id, 'saleDetails'));
          detailsSnapshot.docs.forEach((detailDoc) => {
            const detail = detailDoc.data() as SaleDetail;
            const amount = Number(detail.product.sellingPrice) * detail.quantity * registerSign;
            reportItemsData['customerAmountTotal'] += amount;
            if (sale.paymentType === 'Cash') {
              reportItemsData['cashAmountTotal'] += amount;
            } else if (sale.paymentType === 'Credit') {
              reportItemsData['creditAmountTotal'] += amount;
            } else if (sale.paymentType === 'Digital') {
              reportItemsData['digitalAmountTotal'] += amount;
            } else if (sale.paymentType === 'Receivable') {
              reportItemsData['receivableAmountTotal'] += amount;
            }
            reportItemsData['detailsCountTotal'] += 1;
            reportItemsData[`division${detail.division}CountTotal`] += 1;
            reportItemsData[`division${detail.division}AmountTotal`] += amount + detail.discount * -1 * registerSign;
            if (detail.discount !== 0) {
              reportItemsData[`division${detail.division}DiscountCountTotal`] += 1;
              reportItemsData[`division${detail.division}DiscountAmountTotal`] += detail.discount * -1 * registerSign;
            }
            if (detail.product.sellingTaxClass === 'exclusive') {
              if (detail.product.sellingTax === 10) {
                exclusivePriceNormalTotal += amount;
              } else if (detail.product.sellingTax === 8) {
                exclusivePriceReducedTotal += amount;
              }
            } else if (detail.product.sellingTaxClass === 'inclusive') {
              if (detail.product.sellingTax === 10) {
                inclusivePriceNormalTotal += amount;
              } else if (detail.product.sellingTax === 8) {
                inclusivePriceReducedTotal += amount;
              }
            } else {
              priceTaxFreeTotal += amount;
            }
          });

          reportItemsData['exclusivePriceNormalTotal'] += exclusivePriceNormalTotal;
          reportItemsData['exclusivePriceReducedTotal'] += exclusivePriceReducedTotal;
          reportItemsData['inclusivePriceNormalTotal'] += inclusivePriceNormalTotal;
          reportItemsData['inclusivePriceReducedTotal'] += inclusivePriceReducedTotal;
          reportItemsData['priceTaxFreeTotal'] += priceTaxFreeTotal;
          reportItemsData['exclusiveTaxNormalTotal'] += Math.floor((exclusivePriceNormalTotal * 10) / 100);
          reportItemsData['exclusiveTaxReducedTotal'] += Math.floor((exclusivePriceReducedTotal * 8) / 100);
          reportItemsData['inclusiveTaxNormalTotal'] += Math.floor((inclusivePriceNormalTotal * 10) / (100 + 10));
          reportItemsData['inclusiveTaxReducedTotal'] += Math.floor((inclusivePriceReducedTotal * 8) / (100 + 8));
          if (sale.paymentType === 'Cash') {
            reportItemsData['exclusiveTaxNormalCashTotal'] += Math.floor((exclusivePriceNormalTotal * 10) / 100);
            reportItemsData['exclusiveTaxReducedCashTotal'] += Math.floor((exclusivePriceReducedTotal * 8) / 100);
          } else if (sale.paymentType === 'Credit') {
            reportItemsData['exclusiveTaxNormalCreditTotal'] += Math.floor((exclusivePriceNormalTotal * 10) / 100);
            reportItemsData['exclusiveTaxReducedCreditTotal'] += Math.floor((exclusivePriceReducedTotal * 8) / 100);
          } else if (sale.paymentType === 'Digital') {
            reportItemsData['exclusiveTaxNormalDigitalTotal'] += Math.floor((exclusivePriceNormalTotal * 10) / 100);
            reportItemsData['exclusiveTaxReducedDigitalTotal'] += Math.floor((exclusivePriceReducedTotal * 8) / 100);
          } else if (sale.paymentType === 'Receivable') {
            reportItemsData['exclusiveTaxNormalReceivableTotal'] += Math.floor((exclusivePriceNormalTotal * 10) / 100);
            reportItemsData['exclusiveTaxReducedReceivableTotal'] += Math.floor((exclusivePriceReducedTotal * 8) / 100);
          }

          if (sale.status === 'Return') {
            reportItemsData['returnAmountTotal'] +=
              exclusivePriceNormalTotal +
              exclusivePriceReducedTotal +
              inclusivePriceNormalTotal +
              inclusivePriceReducedTotal +
              priceTaxFreeTotal +
              Math.floor((exclusivePriceNormalTotal * 10) / 100) +
              Math.floor((exclusivePriceReducedTotal * 8) / 100) +
              Math.floor((inclusivePriceNormalTotal * 10) / (100 + 10)) +
              Math.floor((inclusivePriceReducedTotal * 8) / (100 + 8));
          }
        })
      );
      Object.keys(Divisions).forEach((division) => {
        reportItemsData['divisionAllCountTotal'] += reportItemsData[`division${division}CountTotal`];
        reportItemsData['divisionAllAmountTotal'] += reportItemsData[`division${division}AmountTotal`];
        reportItemsData['divisionAllDiscountCountTotal'] += reportItemsData[`division${division}DiscountCountTotal`];
        reportItemsData['divisionAllDiscountAmountTotal'] += reportItemsData[`division${division}DiscountAmountTotal`];
      });
      setReportItems(reportItemsData);
      setCompleted(true);
    } catch (error) {
      console.log({ error });
      setCompleted(true);
    }
  }, [currentShop, registerStatus]);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
  });

  useEffect(() => {
    let unmounted = false;
    (async () => {
      if (!unmounted) {
        getRegisterStatus();
        querySales();
      }
    })();
    return () => {
      unmounted = true;
    };
  }, [querySales, getRegisterStatus]);

  return (
    <Flex direction="col" justify_content="center" align_items="center" className="h-screen">
      <div className="mt-16 mb-2 w-1/2">
        <Flex justify_content="between" align_items="center">
          <div></div>
          <div>
            精算・点検レポート
            <Button color="primary" size="xs" className="ml-4" onClick={handlePrint}>
              印刷
            </Button>
          </div>
          <div>
            {registerStatus && !registerStatus.closedAt && (
              <Link to="/register_close">
                <Button color="warning" size="xs">
                  精算
                </Button>
              </Link>
            )}
          </div>
        </Flex>
      </div>
      <div className="w-1/2 overflow-y-scroll border border-solid" style={{ height: '40rem' }}>
        <div ref={componentRef} className="p-10">
          <p className="text-right text-xs mb-4">
            {currentShop?.formalName}　{reportTimestamp.toDate().toLocaleDateString()}{' '}
            {reportTimestamp.toDate().toLocaleTimeString()}
          </p>
          {completed && (
            <Flex>
              <div className="w-1/2 pr-5">
                <Table border="none" size="xs" className="table-fixed w-full text-xs shadow-none">
                  <Table.Body>
                    <Table.Row>
                      <Table.Cell className="w-2/3">総売上（点）</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`${reportItems['detailsCountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3"></Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(
                          reportItems['customerAmountTotal'] + reportItems['discountAmountTotal']
                        )?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">総売内税抜き</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(
                          reportItems['customerAmountTotal'] -
                          reportItems['inclusiveTaxNormalTotal'] -
                          reportItems['inclusiveTaxReducedTotal'] +
                          reportItems['discountAmountTotal']
                        )?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">純売上（件）</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`${reportItems['customerCountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3"></Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(
                          reportItems['customerAmountTotal'] +
                          reportItems['exclusiveTaxNormalTotal'] +
                          reportItems['exclusiveTaxReducedTotal']
                        )?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">純売税抜き</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(
                          reportItems['customerAmountTotal'] -
                          reportItems['inclusiveTaxNormalTotal'] -
                          reportItems['inclusiveTaxReducedTotal']
                        )?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">現金在高</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(
                          reportItems['cashAmountTotal'] +
                          reportItems['exclusiveTaxNormalCashTotal'] +
                          reportItems['exclusiveTaxReducedCashTotal']
                        )?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">クレジット在高</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(
                          reportItems['creditAmountTotal'] +
                          reportItems['exclusiveTaxNormalCreditTotal'] +
                          reportItems['exclusiveTaxReducedCreditTotal']
                        )?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">電子マネー在高</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(
                          reportItems['digitalAmountTotal'] +
                          reportItems['exclusiveTaxNormalDigitalTotal'] +
                          reportItems['exclusiveTaxReducedDigitalTotal']
                        )?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    {currentShop?.receivable && (
                      <Table.Row>
                        <Table.Cell className="w-2/3">売掛金</Table.Cell>
                        <Table.Cell className="text-right w-1/3">
                          {`¥${(
                            reportItems['receivableAmountTotal'] +
                            reportItems['exclusiveTaxNormalReceivableTotal'] +
                            reportItems['exclusiveTaxReducedReceivableTotal']
                          )?.toLocaleString()}`}
                        </Table.Cell>
                      </Table.Row>
                    )}

                    <Table.Row>
                      <Table.Cell className="w-2/3">客数</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`${reportItems['customerCountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">客単価</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {reportItems['customerCountTotal'] > 0
                          ? `¥${Math.floor(
                              reportItems['customerAmountTotal'] / reportItems['customerCountTotal']
                            )?.toLocaleString()}`
                          : 0}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">値引回数</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`${reportItems['discountCountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">値引金額</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(-reportItems['discountAmountTotal'] + 0)?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">戻回数</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`${reportItems['returnCountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">戻金額</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${reportItems['returnAmountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">内税抜額</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(
                          reportItems['inclusivePriceNormalTotal'] - reportItems['inclusiveTaxNormalTotal']
                        )?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">内税</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${reportItems['inclusiveTaxNormalTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">外税抜額</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${reportItems['exclusivePriceNormalTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">外税</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${reportItems['exclusiveTaxNormalTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">内税抜額※</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(
                          reportItems['inclusivePriceReducedTotal'] - reportItems['inclusiveTaxReducedTotal']
                        )?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">内税※</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${reportItems['inclusiveTaxReducedTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">外税抜額※</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${reportItems['exclusivePriceReducedTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">外税※</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${reportItems['exclusiveTaxReducedTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">非課税合計</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${reportItems['priceTaxFreeTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table>
              </div>
              <div className="w-1/2 pl-5">
                <Table border="none" size="xs" className="table-fixed w-full text-xs shadow-none">
                  <Table.Body>
                    <Table.Row>
                      <Table.Cell className="w-2/3">現金</Table.Cell>
                      <Table.Cell className="text-right w-1/3"></Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">　回数</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`${reportItems['cashCountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">　金額</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(
                          reportItems['cashAmountTotal'] +
                          reportItems['exclusiveTaxNormalCashTotal'] +
                          reportItems['exclusiveTaxReducedCashTotal']
                        )?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">クレジット</Table.Cell>
                      <Table.Cell className="text-right w-1/3"></Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">　回数</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`${reportItems['creditCountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">　金額</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(
                          reportItems['creditAmountTotal'] +
                          reportItems['exclusiveTaxNormalCreditTotal'] +
                          reportItems['exclusiveTaxReducedCreditTotal']
                        )?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">電子マネー</Table.Cell>
                      <Table.Cell className="text-right w-1/3"></Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">　回数</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`${reportItems['digitalCountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">　金額</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${(
                          reportItems['digitalAmountTotal'] +
                          reportItems['exclusiveTaxNormalDigitalTotal'] +
                          reportItems['exclusiveTaxReducedDigitalTotal']
                        )?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    {currentShop?.receivable && (
                      <Table.Row>
                        <Table.Cell className="w-2/3">売掛金</Table.Cell>
                        <Table.Cell className="text-right w-1/3"></Table.Cell>
                      </Table.Row>
                    )}
                    {currentShop?.receivable && (
                      <Table.Row>
                        <Table.Cell className="w-2/3">　回数</Table.Cell>
                        <Table.Cell className="text-right w-1/3">
                          {`${reportItems['receivableCountTotal']?.toLocaleString()}`}
                        </Table.Cell>
                      </Table.Row>
                    )}
                    {currentShop?.receivable && (
                      <Table.Row>
                        <Table.Cell className="w-2/3">　金額</Table.Cell>
                        <Table.Cell className="text-right w-1/3">
                          {`¥${(
                            reportItems['receivableAmountTotal'] +
                            reportItems['exclusiveTaxNormalReceivableTotal'] +
                            reportItems['exclusiveTaxReducedReceivableTotal']
                          )?.toLocaleString()}`}
                        </Table.Cell>
                      </Table.Row>
                    )}
                    <Table.Row>
                      <Table.Cell className="w-2/3">　</Table.Cell>
                      <Table.Cell className="text-right w-1/3"></Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table>

                {Object.entries(Divisions)
                  .filter((division) => reportItems[`division${division[0]}CountTotal`] !== 0)
                  .map((division, index) => (
                    <Table border="none" size="xs" className="table-fixed w-full text-xs shadow-none" key={index}>
                      <Table.Body>
                        <Table.Row>
                          <Table.Cell className="w-2/3">{division[1]}</Table.Cell>
                          <Table.Cell className="text-right w-1/3"></Table.Cell>
                        </Table.Row>
                        <Table.Row>
                          <Table.Cell className="w-2/3">　個数</Table.Cell>
                          <Table.Cell className="text-right w-1/3">
                            {`${reportItems[`division${division[0]}CountTotal`]?.toLocaleString()}`}
                          </Table.Cell>
                        </Table.Row>
                        <Table.Row>
                          <Table.Cell className="w-2/3">　金額</Table.Cell>
                          <Table.Cell className="text-right w-1/3">
                            {`¥${reportItems[`division${division[0]}AmountTotal`]?.toLocaleString()}`}
                          </Table.Cell>
                        </Table.Row>
                        <Table.Row>
                          <Table.Cell className="w-2/3">　値引件数</Table.Cell>
                          <Table.Cell className="text-right w-1/3">
                            {`${reportItems[`division${division[0]}DiscountCountTotal`]?.toLocaleString()}`}
                          </Table.Cell>
                        </Table.Row>
                        <Table.Row>
                          <Table.Cell className="w-2/3">　値引金額</Table.Cell>
                          <Table.Cell className="text-right w-1/3">
                            {`¥${reportItems[`division${division[0]}DiscountAmountTotal`]?.toLocaleString()}`}
                          </Table.Cell>
                        </Table.Row>
                      </Table.Body>
                    </Table>
                  ))}
                <Table border="none" size="xs" className="table-fixed w-full text-xs shadow-none">
                  <Table.Body>
                    <Table.Row>
                      <Table.Cell className="w-2/3">合計</Table.Cell>
                      <Table.Cell className="text-right w-1/3"></Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">　個数</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`${reportItems['divisionAllCountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">　金額</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${reportItems['divisionAllAmountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">　値引件数</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`${reportItems['divisionAllDiscountCountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row>
                      <Table.Cell className="w-2/3">　値引金額</Table.Cell>
                      <Table.Cell className="text-right w-1/3">
                        {`¥${reportItems['divisionAllDiscountAmountTotal']?.toLocaleString()}`}
                      </Table.Cell>
                    </Table.Row>
                  </Table.Body>
                </Table>
              </div>
            </Flex>
          )}
        </div>
      </div>
      <div className="m-4">
        <Link to="/">
          <Button color="light" size="sm">
            戻る
          </Button>
        </Link>
      </div>
    </Flex>
  );
};

export default DailyCashReport;
