import React, { useState } from 'react';
import {
  collection,
  doc,
  query,
  getDocs,
  deleteDoc,
  getFirestore,
  QuerySnapshot,
} from 'firebase/firestore';

import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import firebaseError from './firebaseError';
import ProductCategoryEdit from './ProductCategoryEdit';
import { sortedProductCategories } from './tools';
import { ProductCategory } from './types';

const db = getFirestore();

const ProductCategoryList: React.FC = () => {
  const [search, setSearch] = useState('');
  const [productCategories, setProductCategories] = useState<
    { id: string; productCategory: ProductCategory }[]
  >([]);
  const [open, setOpen] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const queryProductCategories = async () => {
    try {
      setError('');
      const q = query(collection(db, 'productCategories'));
      const snapshot = await getDocs(q);
      const categories = sortedProductCategories(
        snapshot as QuerySnapshot<ProductCategory>
      );
      setProductCategories(categories);
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  const newProductCategory = () => {
    setOpen(true);
    setDocId(null);
  };

  const editProductCategory = (docId: string) => () => {
    setOpen(true);
    setDocId(docId);
  };

  const deleteProductCategory = (code: string) => async () => {
    if (window.confirm('削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'productCategories', code));
        queryProductCategories();
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  return (
    <div className="pt-12 mx-auto max-w-4xl">
      <ProductCategoryEdit
        open={open}
        docId={docId}
        productCategories={productCategories}
        onClose={() => setOpen(false)}
        onUpdate={queryProductCategories}
      />
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">
        商品カテゴリ
      </h1>
      <Card className="mx-8 mb-4">
        <Flex justify_content="between" align_items="center" className="p-4">
          <Flex>
            <Form.Text
              placeholder="検索文字"
              className="mr-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button
              variant="outlined"
              className="mr-2"
              onClick={queryProductCategories}
            >
              検索
            </Button>
            <Button
              variant="outlined"
              className="mr-2"
              onClick={newProductCategory}
            >
              新規
            </Button>
          </Flex>
        </Flex>
        <Card.Body className="p-4">
          {error && <Alert severity="error">{error}</Alert>}
          <Table size="md" border="row" className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell type="th">カテゴリ名称</Table.Cell>
                <Table.Cell type="th">階層レベル</Table.Cell>
                <Table.Cell type="th"></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {productCategories.map((elem, i) => {
                const docId = elem.id;
                const productCategory = elem.productCategory;
                return (
                  <Table.Row key={i}>
                    <Table.Cell>
                      {[...Array(productCategory.level)].map((s, j) => (
                        <React.Fragment key={j}>&emsp;</React.Fragment>
                      ))}
                      {productCategory.name}
                    </Table.Cell>
                    <Table.Cell>{productCategory.level}</Table.Cell>
                    <Table.Cell>
                      <Button
                        variant="icon"
                        size="xs"
                        color="none"
                        className="hover:bg-gray-300 "
                        onClick={editProductCategory(docId)}
                      >
                        <Icon name="pencil-alt" />
                      </Button>
                      <Button
                        variant="icon"
                        size="xs"
                        color="none"
                        className="hover:bg-gray-300"
                        onClick={deleteProductCategory(docId)}
                      >
                        <Icon name="trash" />
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default ProductCategoryList;
