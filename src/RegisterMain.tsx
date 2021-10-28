import React, { useState, useEffect } from 'react';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

import { Button, Card, Flex, Form, Grid, Icon, Table } from './components';
import RegisterPayment from './RegisterPayment';
import { Product } from './types';

const RegisterMain: React.FC = () => {
  type BasketItem = {
    product: Product;
    quantity: number;
  };

  const [productCode, setProductCode] = useState<string>('');
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
  const [openPayment, setOpenPayment] = useState<boolean>(false);

  useEffect(() => {
    document.getElementById('productCode')?.focus(); //非推奨
  }, []);

  const findProduct = async (code: string) => {
    try {
      const db = getFirestore();
      const docRef = doc(db, 'products', code);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const product = docSnap.data() as Product;
        const existingIndex = basketItems.findIndex(
          (item) => item.product.code === code
        );
        if (existingIndex >= 0) {
          basketItems[existingIndex].quantity += 1;
          setBasketItems([...basketItems]);
        } else {
          const basketItem = { product, quantity: 1 };
          setBasketItems([...basketItems, basketItem]);
        }
        setProductCode('');
      } else {
        console.log('no such product');
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productCode) {
      findProduct(productCode);
    } else {
      setOpenPayment(true);
    }
  };

  return (
    <Flex
      direction="col"
      justify_content="center"
      align_items="center"
      className="h-screen"
    >
      <RegisterPayment
        open={openPayment}
        basketItems={basketItems}
        onClose={() => {
          setOpenPayment(false);
          document.getElementById('productCode')?.focus();
        }}
      />
      <Grid cols="2" rows="1" gap="0" flow="col" className="h-full">
        <Card className="container justify-center m-2">
          <Card.Body>
            <Form className="mt-16 ml-4" onSubmit={handleSubmit}>
              <Form.Text
                id="productCode"
                size="md"
                placeholder="商品コード"
                className="mb-3 sm:mb-0"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value.trim())}
              />
            </Form>

            <div className="mt-8 h-96 overflow-y-scroll">
              <Table border="row" className="table-fixed w-full text-sm ">
                <Table.Head>
                  <Table.Row>
                    <Table.Cell type="th" className="w-1/12">
                      No.
                    </Table.Cell>
                    <Table.Cell type="th" className="w-2/12">
                      コード
                    </Table.Cell>
                    <Table.Cell type="th" className="w-5/12">
                      商品名
                    </Table.Cell>
                    <Table.Cell type="th" className="w-1/12">
                      単価
                    </Table.Cell>
                    <Table.Cell type="th" className="w-1/12">
                      数量
                    </Table.Cell>
                    <Table.Cell type="th" className="w-1/12" />
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {basketItems?.map((basketItem, index) => (
                    <Table.Row
                      key={index}
                      className={index % 2 === 1 ? 'bg-blue-50' : ''}
                    >
                      <Table.Cell>{index + 1}</Table.Cell>
                      <Table.Cell>{basketItem.product.code}</Table.Cell>
                      <Table.Cell>{basketItem.product.name}</Table.Cell>
                      <Table.Cell className="text-right">
                        ¥{basketItem.product.price?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">
                        {basketItem.quantity}
                      </Table.Cell>
                      <Table.Cell className="text-center">
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={(e) => {
                            setBasketItems(
                              basketItems.filter(
                                (item) =>
                                  item.product.code !== basketItem.product.code
                              )
                            );
                          }}
                        >
                          <Icon name="trash" />
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>

            <Table border="row" className="table-fixed w-2/3 mt-8">
              <Table.Body>
                <Table.Row>
                  <Table.Cell type="th" className="text-xl bg-red-100">
                    合計
                  </Table.Cell>
                  <Table.Cell className="text-right text-xl pr-4">
                    ¥
                    {basketItems
                      .reduce(
                        (result, item) =>
                          result + Number(item.product.price) * item.quantity,
                        0
                      )
                      .toLocaleString()}
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
          </Card.Body>
        </Card>

        <Card className="m-2"></Card>
      </Grid>
    </Flex>
  );
};
export default RegisterMain;