import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { getFirestore, getDocs, collection, query, where, orderBy, limit, QueryConstraint } from 'firebase/firestore';
import { format } from 'date-fns';
import { Alert, Button, Card, Flex, Form, Table } from './components';
import { useAppContext } from './AppContext';
import { Sale, SaleDetail } from './types';
import { prefectureName } from './tools';
import firebaseError from './firebaseError';

const db = getFirestore();
const MAX_SEARCH = 50;

const ReceiptList: React.FC = () => {
  const { currentShop } = useAppContext();
  const [sales, setSales] = useState<[Sale, string][]>();
  const [sale, setSale] = useState<Sale>();
  const [saleDetails, setSaleDetails] = useState<SaleDetail[]>([]);
  const [dateTimeFrom, setDateTimeFrom] = useState<Date>();
  const [dateTimeTo, setDateTimeTo] = useState<Date>();
  const [error, setError] = useState<string>('');
  const componentRef = useRef(null);

  const querySales = useCallback(async () => {
    if (!currentShop) return;
    try {
      setError('');
      const conds: QueryConstraint[] = [];
      conds.push(where('code', '==', currentShop.code));
      if (dateTimeFrom) {
        conds.push(where('createdAt', '>=', dateTimeFrom));
      }
      if (dateTimeTo) {
        conds.push(where('createdAt', '<=', dateTimeTo));
      }
      conds.push(orderBy('createdAt', 'desc'));
      conds.push(limit(MAX_SEARCH));
      const q = query(collection(db, 'sales'), ...conds);
      const querySnapshot = await getDocs(q);
      const salesData = new Array<[Sale, string]>();
      await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const detailsSnapshot = await getDocs(collection(db, 'sales', doc.id, 'saleDetails'));
          salesData.push([
            doc.data() as Sale,
            detailsSnapshot.docs
              .map((detailDoc) => {
                const detail = detailDoc.data() as SaleDetail;
                return detail.product.name;
              })
              .join('、'),
          ]);
        })
      );
      setSales(salesData);
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  }, [currentShop, dateTimeFrom, dateTimeTo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    querySales();
  };

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
  });

  useEffect(() => {
    querySales();
  }, [querySales]);

  return (
    <Flex direction="col" justify_content="center" align_items="center" className="h-screen">
      <Flex justify_content="between" align_items="center" className="p-4">
        <Flex>
          <Form onSubmit={handleSubmit}>
            <Form.DateTime
              className="mr-2 inline"
              id="DateTimeFrom"
              size="sm"
              value={dateTimeFrom ? format(dateTimeFrom, "yyyy-MM-dd'T'HH:mm") : ''}
              onChange={(e) => {
                setDateTimeFrom(new Date(e.target.value));
              }}
            />
            〜
            <Form.DateTime
              className="ml-2 mr-2 inline"
              id="DateTimeTo"
              size="sm"
              value={dateTimeTo ? format(dateTimeTo, "yyyy-MM-dd'T'HH:mm") : ''}
              onChange={(e) => {
                setDateTimeTo(new Date(e.target.value));
              }}
            />
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
          </Form>
        </Flex>
      </Flex>
      <Card className="mx-8 mb-4">
        <Card.Body className="p-4">
          {error && <Alert severity="error">{error}</Alert>}
          <div className="overflow-y-scroll h-96">
            <Table border="row" className="table-fixed w-full text-sm">
              <Table.Head>
                <Table.Row>
                  <Table.Cell type="th" className="w-1/12">
                    No.
                  </Table.Cell>
                  <Table.Cell type="th" className="w-1/12" />
                  <Table.Cell type="th" className="w-2/12">
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
                {sales &&
                  sales.map((data, index) => {
                    const [saleData, productName] = data;
                    return (
                      <Table.Row className="hover:bg-gray-300" key={index}>
                        <Table.Cell>{index + 1}</Table.Cell>
                        <Table.Cell>{saleData?.status === 'Return' ? '返品' : ''}</Table.Cell>
                        <Table.Cell className="truncate">{`${saleData.createdAt
                          ?.toDate()
                          .toLocaleDateString()} ${saleData.createdAt?.toDate().toLocaleTimeString()}`}</Table.Cell>
                        <Table.Cell className="text-right">{saleData.salesTotal?.toLocaleString()}</Table.Cell>
                        <Table.Cell className="text-right">{saleData.detailsCount?.toLocaleString()}</Table.Cell>
                        <Table.Cell className="truncate">{productName}</Table.Cell>
                        <Table.Cell>
                          <Button
                            color="primary"
                            size="xs"
                            onClick={async () => {
                              setSale(saleData);
                              const querySnapshot = await getDocs(
                                collection(db, 'sales', saleData.receiptNumber.toString(), 'saleDetails')
                              );
                              const details: Array<SaleDetail> = [];
                              querySnapshot.docs.forEach((doc) => {
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
          <p className="text-right text-sm mt-2">
            {sale?.createdAt?.toDate().toLocaleDateString()} {sale?.createdAt?.toDate().toLocaleTimeString()}
          </p>
          <p className="text-right text-sm mt-2">
            {currentShop ? prefectureName(currentShop.prefecture) : ''}
            {currentShop?.municipality}
            {currentShop?.house_number}
            {currentShop?.building_name}
          </p>
          <p className="text-right text-sm mt-2">{currentShop?.name}</p>
          <p className="text-center text-xl font-bold m-2">{sale?.status === 'Return' ? '返品' : '領収書'}</p>
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
              {saleDetails?.map((saleDetail, index) => (
                <Table.Row key={index}>
                  <Table.Cell>
                    {saleDetail.product.selfMedication ? '★' : ''}
                    {saleDetail.product.sellingTax === 8 ? '軽' : ''}
                  </Table.Cell>
                  <Table.Cell>{saleDetail.product.name}</Table.Cell>
                  <Table.Cell className="text-right">{saleDetail.product.code ? saleDetail.quantity : null}</Table.Cell>
                  <Table.Cell className="text-right">
                    {saleDetail.product.code ? `¥${saleDetail.product.sellingPrice?.toLocaleString()}` : null}
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    ¥{(Number(saleDetail.product.sellingPrice) * saleDetail.quantity)?.toLocaleString()}
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
                    {sale?.status === 'Return' ? 'ご返金' : '合計'}
                  </Table.Cell>
                  <Table.Cell className="text-right text-xl pr-4">¥{sale?.salesTotal.toLocaleString()}</Table.Cell>
                  <Table.Cell></Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell type="th">8%対象</Table.Cell>
                  <Table.Cell className="text-right pr-4">
                    ¥{(Number(sale?.salesReducedTotal) + 0).toLocaleString()}
                  </Table.Cell>
                  <Table.Cell>（内消費税等　¥{(Number(sale?.taxReducedTotal) + 0).toLocaleString()}）</Table.Cell>
                </Table.Row>
                <Table.Row>
                  <Table.Cell type="th">10%対象</Table.Cell>
                  <Table.Cell className="text-right pr-4">
                    ¥{(Number(sale?.salesNormalTotal) + 0).toLocaleString()}
                  </Table.Cell>
                  <Table.Cell>（内消費税等　¥{(Number(sale?.taxNormalTotal) + 0).toLocaleString()}）</Table.Cell>
                </Table.Row>
                {sale?.status === 'Return' ? null : (
                  <Table.Row>
                    <Table.Cell type="th">お預かり</Table.Cell>
                    <Table.Cell className="text-right pr-4">¥{sale?.cashAmount.toLocaleString()}</Table.Cell>
                    <Table.Cell></Table.Cell>
                  </Table.Row>
                )}
                {sale?.status === 'Return' ? null : (
                  <Table.Row>
                    <Table.Cell type="th">お釣り</Table.Cell>
                    <Table.Cell className="text-right pr-4">
                      ¥{(Number(sale?.cashAmount) - Number(sale?.salesTotal)).toLocaleString()}
                    </Table.Cell>
                    <Table.Cell></Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          </Flex>
        </div>
      </div>
    </Flex>
  );
};

export default ReceiptList;
