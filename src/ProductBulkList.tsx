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
import { ProductBulk } from './types';

const db = getFirestore();
const MAX_SEARCH = 50;

const ProductBulkList: React.FC = () => {
  const [search, setSearch] = useState('');
  const [productBulks, setProductBulks] = useState<ProductBulk[]>([]);
  const [error, setError] = useState<string>('');

  const queryProductBulks = useCallback(async () => {
    try {
      setError('');
      const conds: QueryConstraint[] = [];
      const searchText = search.trim();
      if (searchText) {
        if (searchText.match(/^\d+$/)) {
          conds.push(orderBy('parentProductCode'));
        } else {
          conds.push(orderBy('parentProductName'));
        }
        conds.push(startAt(searchText));
        conds.push(endAt(searchText + '\uf8ff'));
        conds.push(limit(MAX_SEARCH));
      } else {
        conds.push(orderBy('parentProductCode'));
        conds.push(limit(MAX_SEARCH));
      }
      const q = query(collection(db, 'productBulks'), ...conds);
      const querySnapshot = await getDocs(q);
      const bulksData: ProductBulk[] = [];
      await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          bulksData.push(doc.data() as ProductBulk);
        })
      );
      setProductBulks(bulksData);
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  }, [search]);

  const deleteProductBulk = (code: string) => async () => {
    if (window.confirm('削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'productBulks', code));
        queryProductBulks();
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  useEffect(() => {
    queryProductBulks();
  }, [queryProductBulks]);

  return (
    <div className="pt-12 mx-auto">
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">セット</h1>
      <Card className="mx-8 mb-4">
        <Flex justify_content="between" align_items="center" className="p-4">
          <Flex>
            <Form.Text
              placeholder="検索文字"
              className="mr-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="outlined" className="mr-2" onClick={queryProductBulks}>
              検索
            </Button>
            <Link to="/product_bulk_edit">
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
                <Table.Cell type="th">親コード</Table.Cell>
                <Table.Cell type="th">商品名</Table.Cell>
                <Table.Cell type="th">子コード</Table.Cell>
                <Table.Cell type="th">商品名</Table.Cell>
                <Table.Cell type="th"></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {productBulks &&
                productBulks.map((productBulk, index) => {
                  return (
                    <Table.Row key={index}>
                      <Table.Cell>{productBulk.parentProductCode}</Table.Cell>
                      <Table.Cell>{productBulk.parentProductName}</Table.Cell>
                      <Table.Cell>{productBulk.childProductCode}</Table.Cell>
                      <Table.Cell>{productBulk.childProductName}</Table.Cell>
                      <Table.Cell>
                        <Link to={`product_bulk_edit/${productBulk.parentProductCode}`}>
                          <Button variant="icon" size="xs" color="none" className="hover:bg-gray-300 ">
                            <Icon name="pencil-alt" />
                          </Button>
                        </Link>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={deleteProductBulk(productBulk.parentProductCode)}
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

export default ProductBulkList;
