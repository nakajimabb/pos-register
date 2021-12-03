import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { getFirestore, getDocs, collection, query, where, QuerySnapshot } from 'firebase/firestore';
import { Alert, Button, Card, Flex, Table } from './components';
import { Sale, SaleDetail } from './types';
import firebaseError from './firebaseError';

const db = getFirestore();

const ReceiptList: React.FC = () => {
  const [snapshot, setSnapshot] = useState<QuerySnapshot<Sale> | null>(null);
  const [sale, setSale] = useState<Sale>();
  const [saleDetails, setSaleDetails] = useState<SaleDetail[]>([]);
  const [error, setError] = useState<string>('');
  const componentRef = useRef(null);

  const querySales = async () => {
    try {
      setError('');
      const q = query(collection(db, 'sales'), where('code', '==', '05'));
      const querySnapshot = await getDocs(q);
      setSnapshot(querySnapshot as QuerySnapshot<Sale>);
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
  });

  useEffect(() => {
    querySales();
  }, []);

  return (
    <Flex direction="col" justify_content="center" align_items="center" className="h-screen">
      <Flex justify_content="between" align_items="center" className="p-4">
        <Flex>
          <Button
            variant="outlined"
            size="sm"
            className="mr-2"
            onClick={async () => {
              await querySales();
            }}
          >
            検索
          </Button>
        </Flex>
      </Flex>
      <Card className="mx-8 mb-4">
        <Card.Body className="p-4">
          {error && <Alert severity="error">{error}</Alert>}
          <div className="overflow-y-scroll">
            <Table border="row" className="table-fixed w-full text-sm">
              <Table.Head>
                <Table.Row>
                  <Table.Cell type="th" className="w-1/12">
                    No.
                  </Table.Cell>
                  <Table.Cell type="th" className="w-3/12">
                    時間
                  </Table.Cell>
                  <Table.Cell type="th" className="w-2/12">
                    金額
                  </Table.Cell>
                  <Table.Cell type="th" className="w-1/12">
                    点数
                  </Table.Cell>
                  <Table.Cell type="th" className="w-3/12">
                    商品
                  </Table.Cell>
                  <Table.Cell type="th" className="w-2/12"></Table.Cell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {snapshot &&
                  snapshot.docs.map((doc, index) => {
                    const saleData = doc.data();
                    return (
                      <Table.Row className="hover:bg-gray-300" key={index}>
                        <Table.Cell>{index + 1}</Table.Cell>
                        <Table.Cell className="truncate">{`${saleData.createdAt
                          ?.toDate()
                          .toLocaleDateString()} ${saleData.createdAt?.toDate().toLocaleTimeString()}`}</Table.Cell>
                        <Table.Cell className="text-right">{saleData.salesTotal?.toLocaleString()}</Table.Cell>
                        <Table.Cell className="text-right">{saleData.detailsCount?.toLocaleString()}</Table.Cell>
                        <Table.Cell className="text-right">{}</Table.Cell>
                        <Table.Cell>
                          <Button
                            color="primary"
                            size="xs"
                            onClick={async () => {
                              setSale(saleData);
                              const querySnapshot = await getDocs(collection(db, 'sales', doc.id, 'saleDetails'));
                              const details: Array<SaleDetail> = [];
                              querySnapshot.docs.map((doc, index) => {
                                details.push(doc.data() as SaleDetail);
                              });
                              setSaleDetails(details);
                              if (handlePrint) handlePrint();
                            }}
                          >
                            印刷
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
              </Table.Body>
            </Table>
          </div>
        </Card.Body>
      </Card>
      <div className="m-2">
        <Link to="/">
          <Button color="light" size="sm">
            戻る
          </Button>
        </Link>
      </div>
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
              {saleDetails?.map((saleDetail, index) => (
                <Table.Row key={index}>
                  <Table.Cell></Table.Cell>
                  <Table.Cell>{saleDetail.productName}</Table.Cell>
                  <Table.Cell className="text-right">{saleDetail.quantity}</Table.Cell>
                  <Table.Cell className="text-right">¥{saleDetail.price?.toLocaleString()}</Table.Cell>
                  <Table.Cell className="text-center">
                    ¥{(Number(saleDetail.price) * saleDetail.quantity)?.toLocaleString()}
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
                <Table.Cell className="text-right text-xl pr-4">¥{sale?.salesTotal.toLocaleString()}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell type="th">お預かり</Table.Cell>
                <Table.Cell className="text-right pr-4">¥{sale?.cashAmount.toLocaleString()}</Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell type="th">お釣り</Table.Cell>
                <Table.Cell className="text-right pr-4">
                  ¥{(Number(sale?.cashAmount) - Number(sale?.salesTotal)).toLocaleString()}
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        </div>
      </div>
    </Flex>
  );
};

export default ReceiptList;
