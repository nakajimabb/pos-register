import React, { useState } from 'react';
import {
  collection,
  doc,
  query,
  getDocs,
  deleteDoc,
  getFirestore,
} from 'firebase/firestore';

import { Button, Card, Flex, Form, Icon, Table } from './components';
import firebaseError from './firebaseError';
import ProductEdit from './ProductEdit';
import { Product } from './types';

const db = getFirestore();

const ProductList: React.FC = () => {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);

  const queryProducts = async () => {
    const q = query(collection(db, 'products'));
    const querySnapshot = await getDocs(q);
    const dataArray: Product[] = [];
    querySnapshot.forEach((doc) => {
      dataArray.push(doc.data() as Product);
    });
    setProducts(dataArray);
  };

  const newProduct = () => {
    setOpen(true);
    setDocId(null);
  };

  const editProduct = (code: string) => () => {
    setOpen(true);
    setDocId(code);
  };

  const deleteProduct = (code: string) => async () => {
    if (window.confirm('削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'products', code));
        setProducts(products.filter((product) => product.code !== code));
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  return (
    <div className="pt-12 h-screen">
      <ProductEdit open={open} onClose={() => setOpen(false)} docId={docId} />
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">
        商品マスタ(共通)
      </h1>
      <Card className="mx-8">
        <Flex className="p-4">
          <Form.Text
            placeholder="検索文字"
            className="mr-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button variant="outlined" className="mr-2" onClick={queryProducts}>
            検索
          </Button>
          <Button variant="outlined" className="mr-2" onClick={newProduct}>
            新規
          </Button>
        </Flex>
        <Card.Body className="p-4 bg-gray-50">
          <Table size="md" border="row" className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell type="th">PLUコード</Table.Cell>
                <Table.Cell type="th">商品名称</Table.Cell>
                <Table.Cell type="th">商品名カナ</Table.Cell>
                <Table.Cell type="th">商品名略</Table.Cell>
                <Table.Cell type="th">売価税抜</Table.Cell>
                <Table.Cell type="th">備考</Table.Cell>
                <Table.Cell type="th"></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {products.map((product, i) => (
                <Table.Row key={i}>
                  <Table.Cell>{product.code}</Table.Cell>
                  <Table.Cell>{product.name}</Table.Cell>
                  <Table.Cell>{product.kana}</Table.Cell>
                  <Table.Cell>{product.abbr}</Table.Cell>
                  <Table.Cell>{product.price}</Table.Cell>
                  <Table.Cell>{product.note}</Table.Cell>
                  <Table.Cell>
                    <Button
                      key={i}
                      variant="icon"
                      size="xs"
                      color="none"
                      className="hover:bg-gray-300 "
                      onClick={editProduct(product.code)}
                    >
                      <Icon name="pencil-alt" />
                    </Button>
                    <Button
                      key={i}
                      variant="icon"
                      size="xs"
                      color="none"
                      className="hover:bg-gray-300"
                      onClick={deleteProduct(product.code)}
                    >
                      <Icon name="trash" />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default ProductList;
