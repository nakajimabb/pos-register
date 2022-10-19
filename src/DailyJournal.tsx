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

const db = getFirestore();

const DailyJournal: React.FC = () => {
  const { currentShop } = useAppContext();
  const [completed, setCompleted] = useState<boolean>(false);
  const [sales, setSales] = useState<[string, Sale, SaleDetail[]][]>();
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
      const salesData = new Array<[string, Sale, SaleDetail[]]>();
      await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const detailsSnapshot = await getDocs(
            query(collection(db, 'sales', doc.id, 'saleDetails'), orderBy('index'))
          );
          salesData.push([
            doc.id,
            doc.data() as Sale,
            detailsSnapshot.docs.map((detailDoc) => {
              return detailDoc.data() as SaleDetail;
            }),
          ]);
        })
      );
      setSales(salesData);
      setCompleted(true);
    } catch (error) {
      console.log({ error });
      setCompleted(true);
    }
  }, [completed, currentShop, registerStatus]);

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
  }, [getRegisterStatus, querySales]);

  return (
    <Flex direction="col" justify_content="center" align_items="center" className="h-screen">
      <div className="mt-16 mb-2 w-1/2">
        <Flex justify_content="center" align_items="center">
          <div>
            ジャーナル
            <Button color="primary" size="xs" className="ml-4" onClick={handlePrint}>
              印刷
            </Button>
          </div>
        </Flex>
      </div>
      <div className="w-1/2 overflow-y-scroll border border-solid" style={{ height: '40rem' }}>
        <div ref={componentRef} className="p-10">
          <p className="text-right text-xs mb-4">
            {currentShop?.formalName}　{reportTimestamp.toDate().toLocaleDateString()}{' '}
            {reportTimestamp.toDate().toLocaleTimeString()}
          </p>

          {sales &&
            sales.map((data, index) => {
              const [docId, saleData, saleDetails] = data;
              const registerSign = saleData.status === 'Return' ? -1 : 1;
              const rows = [
                <Table.Row className="hover:bg-yellow-500" key={docId}>
                  <Table.Cell className="w-2/12">{saleData.status === 'Return' ? '返品' : '売上'}</Table.Cell>
                  <Table.Cell className="w-4/12">{saleData.createdAt.toDate().toLocaleTimeString()}</Table.Cell>
                  <Table.Cell className="w-2/12 text-right"></Table.Cell>
                  <Table.Cell className="w-2/12 text-right"></Table.Cell>
                  <Table.Cell className="w-2/12 text-right"></Table.Cell>
                </Table.Row>,
              ];

              let priceTotal = 0;
              let normalTotal = 0;
              let reducedTotal = 0;

              saleDetails?.forEach((saleDetail, index) => {
                priceTotal += Number(saleDetail.product.sellingPrice) * saleDetail.quantity;
                if (saleDetail.product.sellingTaxClass === 'exclusive') {
                  if (saleDetail.product.sellingTax) {
                    if (saleDetail.product.sellingTax === 10) {
                      normalTotal += Number(saleDetail.product.sellingPrice) * saleDetail.quantity;
                    } else if (saleDetail.product.sellingTax === 8) {
                      reducedTotal += Number(saleDetail.product.sellingPrice) * saleDetail.quantity;
                    }
                  }
                }
                rows.push(
                  <Table.Row className="hover:bg-yellow-500" key={`${docId}${index}`}>
                    <Table.Cell></Table.Cell>
                    <Table.Cell>{saleDetail.product.name}</Table.Cell>
                    <Table.Cell className="text-right">
                      {saleDetail.product.code ? saleDetail.quantity : null}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {saleDetail.product.code
                        ? `¥${(Number(saleDetail.product.sellingPrice) * registerSign)?.toLocaleString()}`
                        : null}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      ¥
                      {(Number(saleDetail.product.sellingPrice) * saleDetail.quantity * registerSign)?.toLocaleString()}
                    </Table.Cell>
                  </Table.Row>
                );
              });
              const total =
                (priceTotal + Math.floor((normalTotal * 10) / 100) + Math.floor((reducedTotal * 8) / 100)) *
                registerSign;
              rows.push(
                <Table.Row className="hover:bg-yellow-500" key={`${docId}Total`}>
                  <Table.Cell></Table.Cell>
                  <Table.Cell></Table.Cell>
                  <Table.Cell className="text-right"></Table.Cell>
                  <Table.Cell className="text-right">合計</Table.Cell>
                  <Table.Cell className="text-right">¥{total.toLocaleString()}</Table.Cell>
                </Table.Row>
              );
              if (saleData.status !== 'Return') {
                rows.push(
                  <Table.Row className="hover:bg-yellow-500" key={`${docId}CashAmount`}>
                    <Table.Cell></Table.Cell>
                    <Table.Cell></Table.Cell>
                    <Table.Cell className="text-right"></Table.Cell>
                    <Table.Cell className="text-right">
                      {saleData.paymentType === 'Cash'
                        ? '預り金'
                        : saleData.paymentType === 'Credit'
                        ? 'クレジット'
                        : '電子マネー'}
                    </Table.Cell>
                    <Table.Cell className="text-right">¥{saleData.cashAmount.toLocaleString()}</Table.Cell>
                  </Table.Row>
                );
                if (saleData.paymentType === 'Cash') {
                  rows.push(
                    <Table.Row className="hover:bg-yellow-500" key={`${docId}Change`}>
                      <Table.Cell></Table.Cell>
                      <Table.Cell></Table.Cell>
                      <Table.Cell className="text-right"></Table.Cell>
                      <Table.Cell className="text-right">お釣り</Table.Cell>
                      <Table.Cell className="text-right">¥{(saleData.cashAmount - total).toLocaleString()}</Table.Cell>
                    </Table.Row>
                  );
                }
              }
              return (
                <div className="my-2 border-b-2" style={{ breakInside: 'avoid' }} key={index}>
                  <Table border="none" size="xs" className="table-fixed w-full text-xs shadow-none">
                    <Table.Body>{rows}</Table.Body>
                  </Table>
                </div>
              );
            })}
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

export default DailyJournal;
