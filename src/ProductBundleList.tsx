import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  doc,
  query,
  getDocs,
  deleteDoc,
  getFirestore,
  limit,
  limitToLast,
  orderBy,
  startAfter,
  endBefore,
  startAt,
  endAt,
  QueryConstraint,
  QuerySnapshot,
} from 'firebase/firestore';

import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import firebaseError from './firebaseError';
import { ProductBundle } from './types';

const db = getFirestore();
const PER_PAGE = 25;
const MAX_SEARCH = 50;

const ProductBundleList: React.FC = () => {
  const [search, setSearch] = useState('');
  const [snapshot, setSnapshot] = useState<QuerySnapshot<ProductBundle> | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string>('');

  const queryProductBundles = (action: 'head' | 'prev' | 'next' | 'current') => async () => {
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
        setPage(0);
      } else {
        if (action === 'head') {
          conds.push(orderBy('code'));
          conds.push(limit(PER_PAGE));
          setPage(0);
        } else if (action === 'next') {
          if (snapshot) {
            conds.push(orderBy('code'));
            const last = snapshot.docs[snapshot.docs.length - 1];
            conds.push(startAfter(last));
            conds.push(limit(PER_PAGE));
            setPage(page + 1);
          }
        } else if (action === 'prev') {
          if (snapshot) {
            conds.push(orderBy('code', 'asc'));
            const last = snapshot.docs[0];
            conds.push(endBefore(last));
            conds.push(limitToLast(PER_PAGE));
            setPage(page - 1);
          }
        } else if (action === 'current') {
          if (snapshot) {
            const first = snapshot.docs[0];
            conds.push(startAt(first));
            conds.push(limit(PER_PAGE));
          }
        }
      }
      const q = query(collection(db, 'productBundles'), ...conds);
      const querySnapshot = await getDocs(q);
      setSnapshot(querySnapshot as QuerySnapshot<ProductBundle>);
      console.log({ size: querySnapshot.size });
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  const deleteProductBundle = (code: string) => async () => {
    if (window.confirm('削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'productBundles', code));
        queryProductBundles('current')();
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

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
            <Button variant="outlined" className="mr-2" onClick={queryProductBundles('head')}>
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
              {snapshot &&
                snapshot.docs.map((doc, i) => {
                  const productBundle = doc.data();
                  return (
                    <Table.Row key={i}>
                      <Table.Cell>{productBundle.code}</Table.Cell>
                      <Table.Cell>{productBundle.name}</Table.Cell>
                      <Table.Cell>
                        <Link to={`product_bundle_edit/${productBundle.code}`}>
                          <Button size="xs" color="light">
                            詳細
                          </Button>
                        </Link>
                        <Button
                          size="xs"
                          color="danger"
                          className="ml-2"
                          onClick={deleteProductBundle(productBundle.code)}
                        >
                          削除
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
