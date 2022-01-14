import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  doc,
  query,
  getDocs,
  deleteDoc,
  getFirestore,
  limit,
  orderBy,
  startAt,
  endAt,
  QueryConstraint,
} from 'firebase/firestore';

import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import firebaseError from './firebaseError';
import { ProductBundle } from './types';

const db = getFirestore();
const MAX_SEARCH = 50;

const ProductBundleList: React.FC = () => {
  const [search, setSearch] = useState('');
  const [productBundles, setProductBundles] = useState<ProductBundle[]>([]);
  const [error, setError] = useState<string>('');

  const queryProductBundles = useCallback(async () => {
    try {
      setError('');
      const conds: QueryConstraint[] = [];
      const searchText = search.trim();
      if (searchText) {
        if (searchText.match(/^\d+$/)) {
          conds.push(orderBy('code'));
        } else {
          conds.push(orderBy('name'));
        }
        conds.push(startAt(searchText));
        conds.push(endAt(searchText + '\uf8ff'));
        conds.push(limit(MAX_SEARCH));
      } else {
        conds.push(orderBy('code'));
        conds.push(limit(MAX_SEARCH));
      }
      const q = query(collection(db, 'productBundles'), ...conds);
      const querySnapshot = await getDocs(q);
      const bundlesData: ProductBundle[] = [];
      await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          bundlesData.push(doc.data() as ProductBundle);
        })
      );
      setProductBundles(bundlesData);
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  }, []);

  const deleteProductBundle = (code: string) => async () => {
    if (window.confirm('削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'productBundles', code));
        queryProductBundles();
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  useEffect(() => {
    queryProductBundles();
  }, [queryProductBundles]);

  return (
    <div className="pt-12 mx-auto max-w-4xl">
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">まとめ売り</h1>
      <Card className="mx-8 mb-4">
        <Flex justify_content="between" align_items="center" className="p-4">
          <Flex>
            <Form.Text
              placeholder="検索文字"
              className="mr-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="outlined" className="mr-2" onClick={queryProductBundles}>
              検索
            </Button>
            <Link to="/product_bundle_edit">
              <Button variant="outlined" className="mr-2">
                新規
              </Button>
            </Link>
          </Flex>
        </Flex>
        <Card.Body className="p-4">
          {error && <Alert severity="error">{error}</Alert>}
          <Table size="md" border="row" className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell type="th">コード</Table.Cell>
                <Table.Cell type="th">名称</Table.Cell>
                <Table.Cell type="th"></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {productBundles &&
                productBundles.map((productBundle, index) => {
                  return (
                    <Table.Row key={index}>
                      <Table.Cell>{productBundle.code}</Table.Cell>
                      <Table.Cell>{productBundle.name}</Table.Cell>
                      <Table.Cell>
                        <Link to={`product_bundle_edit/${productBundle.code}`}>
                          <Button variant="icon" size="xs" color="none" className="hover:bg-gray-300 ">
                            <Icon name="pencil-alt" />
                          </Button>
                        </Link>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={deleteProductBundle(productBundle.code)}
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

export default ProductBundleList;
