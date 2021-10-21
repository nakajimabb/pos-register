import React, { useState, useRef } from 'react';
import * as xlsx from 'xlsx';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

import { Alert, Button, Card, Flex, Form, Table } from './components';
import { Product } from './types';

const RegisterMain: React.FC = () => {
  type BasketItem = {
    product: Product;
    quantity: number;
  };

  const [productCode, setProductCode] = useState<string>('');
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);

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
    findProduct(productCode);
  };

  return (
    <Flex
      direction="col"
      justify_content="center"
      align_items="center"
      className="h-screen"
    >
      <Form className="" onSubmit={handleSubmit}>
        <Form.Text
          id="text"
          size="md"
          placeholder="商品コード"
          className="mb-3 sm:mb-0"
          value={productCode}
          onChange={(e) => setProductCode(e.target.value)}
        />
      </Form>
      <Card className="m-8 w-1/2">
        <Card.Body className="p-4 bg-gray-50">
          <Table border="row" className="table-fixed w-full">
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
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {basketItems?.map((basketItem, index) => (
                <Table.Row key={index}>
                  <Table.Cell>{index + 1}</Table.Cell>
                  <Table.Cell>{basketItem.product.code}</Table.Cell>
                  <Table.Cell>{basketItem.product.name}</Table.Cell>
                  <Table.Cell>{basketItem.product.price}</Table.Cell>
                  <Table.Cell>{basketItem.quantity}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card.Body>
      </Card>
    </Flex>
  );
};
export default RegisterMain;
