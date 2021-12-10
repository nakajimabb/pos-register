import React, { useState } from 'react';
import {
  collection,
  doc,
  query,
  getDoc,
  getDocs,
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
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';

import { Alert, Button, Card, Flex, Form, Table } from './components';
import firebaseError from './firebaseError';
import { Shop } from './types';
import { prefectureName, hiraToKana } from './tools';
import clsx from 'clsx';

const db = getFirestore();
const PER_PAGE = 25;
const MAX_SEARCH = 50;

const ShopList: React.FC = () => {
  const [search, setSearch] = useState({ text: '' });
  const [snapshot, setSnapshot] = useState<QuerySnapshot<Shop> | null>(null);
  const [page, setPage] = useState(0);
  const [shopCount, setShopCount] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const existSearch = () => search.text.trim();

  const queryShops = (action: 'head' | 'prev' | 'next' | 'current') => async () => {
    try {
      setError('');
      const conds: QueryConstraint[] = [];
      if (existSearch()) {
        let searchText = search.text.trim();
        if (searchText) {
          if (searchText.match(/^\d+$/)) {
            conds.push(orderBy('code'));
          } else if (searchText.match(/^[ぁ-んー]*$/) || searchText.match(/^[ァ-ンヴー]*$/)) {
            conds.push(orderBy('kana'));
            searchText = hiraToKana(searchText);
          } else {
            conds.push(orderBy('name'));
          }
          conds.push(startAt(searchText));
          conds.push(endAt(searchText + '\uf8ff'));
        }
        conds.push(limit(MAX_SEARCH));
        setPage(0);
        setShopCount(null);
      } else {
        const snap = await getDoc(doc(db, 'counters', 'shops'));
        if (snap.exists()) {
          setShopCount(snap.data().all);
        } else {
          setShopCount(null);
        }

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
      const q = query(collection(db, 'shops'), ...conds);
      const querySnapshot = await getDocs(q);
      setSnapshot(querySnapshot as QuerySnapshot<Shop>);
      console.log({ size: querySnapshot.size });
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  const pullKkb = async () => {
    if (window.confirm('KKBから最新情報を取得しますか？')) {
      try {
        setLoading(true);
        const functions = getFunctions(app, 'asia-northeast1');
        const result = await httpsCallable(functions, 'updateShopsFromKKb')();
        console.log({ result });
        setLoading(false);
        alert('店舗情報を更新しました。');
      } catch (error) {
        console.log({ error });
        setLoading(false);
        alert('エラーが発生しました。');
      }
    }
  };

  return (
    <div className="pt-12">
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">店舗一覧</h1>
      <Card className="mx-8 mb-4">
        <Flex justify_content="between" align_items="center" className="p-4">
          <Flex>
            <Form.Text
              placeholder="検索文字"
              className="mr-2"
              value={search.text}
              onChange={(e) => setSearch({ ...search, text: e.target.value })}
            />
            <Button variant="outlined" className="mr-2" disabled={loading} onClick={queryShops('head')}>
              検索
            </Button>
            <Button variant="outlined" className="mr-2" disabled={loading} onClick={pullKkb}>
              店舗情報更新
            </Button>
          </Flex>
          {snapshot && shopCount && (
            <Flex>
              <Button
                color="light"
                size="xs"
                disabled={!!existSearch() || page <= 0 || !snapshot || snapshot.size === 0}
                className="mr-2"
                onClick={queryShops('prev')}
              >
                前へ
              </Button>
              <Button
                color="light"
                size="xs"
                disabled={
                  !!existSearch() || PER_PAGE * page + snapshot.size >= shopCount || !snapshot || snapshot.size === 0
                }
                className="mr-2"
                onClick={queryShops('next')}
              >
                後へ
              </Button>
              <div>
                {`${PER_PAGE * page + 1}～${PER_PAGE * page + snapshot.size}`}/{`${shopCount}`}
              </div>
            </Flex>
          )}
        </Flex>
        <Card.Body className="p-4">
          {error && <Alert severity="error">{error}</Alert>}
          <Table size="md" border="row" className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell type="th">店舗番号</Table.Cell>
                <Table.Cell type="th">店舗名</Table.Cell>
                <Table.Cell type="th">店舗名カナ</Table.Cell>
                <Table.Cell type="th">TEL</Table.Cell>
                <Table.Cell type="th">郵便番号</Table.Cell>
                <Table.Cell type="th">都道府県</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {snapshot &&
                snapshot.docs.map((doc, i) => {
                  const shop = doc.data();
                  return (
                    <Table.Row key={i} className={clsx(shop.hidden && 'line-through')}>
                      <Table.Cell>{shop.code}</Table.Cell>
                      <Table.Cell>{shop.name}</Table.Cell>
                      <Table.Cell>{shop.kana}</Table.Cell>
                      <Table.Cell>{shop.tel}</Table.Cell>
                      <Table.Cell>{shop.zip}</Table.Cell>
                      <Table.Cell>{prefectureName(shop.prefecture)}</Table.Cell>
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

export default ShopList;
