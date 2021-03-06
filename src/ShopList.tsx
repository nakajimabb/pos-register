import React, { useState } from 'react';
import {
  collection,
  doc,
  query,
  getDocs,
  getFirestore,
  limit,
  limitToLast,
  orderBy,
  startAfter,
  endBefore,
  startAt,
  endAt,
  setDoc,
  QueryConstraint,
  QuerySnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from './firebase';

import { Alert, Button, Card, Flex, Form, Table, Icon } from './components';
import { useAppContext } from './AppContext';
import ShopEdit from './ShopEdit';
import firebaseError from './firebaseError';
import { Shop } from './types';
import { hiraToKana } from './tools';
import { prefectureName } from './prefecture';
import clsx from 'clsx';

const db = getFirestore();
const PER_PAGE = 25;
const MAX_SEARCH = 50;

const ROLE_NAMES = { shop: '店舗', manager: '管理者', admin: 'ｼｽﾃﾑ' };

const ShopList: React.FC = () => {
  const [search, setSearch] = useState({ text: '' });
  const [snapshot, setSnapshot] = useState<QuerySnapshot<Shop> | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [page, setPage] = useState(0);
  const [shopCount, setShopCount] = useState<number | null>(null);
  const [targetShopCode, setTargetShopCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const { role, counters } = useAppContext();

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
        setShopCount(Number(counters?.shops.all));

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
      const querySnapshot = (await getDocs(q)) as QuerySnapshot<Shop>;
      setSnapshot(querySnapshot);
      setShops(querySnapshot.docs.map((dsnap) => dsnap.data()));
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
        const result = await httpsCallable(functions, 'updateShops')();
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

  const createAccount = (shopCode: string) => async () => {
    if (window.confirm('ログインアカウントを作成しますか？')) {
      try {
        setLoading(true);
        const functions = getFunctions(app, 'asia-northeast1');
        const result = await httpsCallable(functions, 'createAccount')({ uid: shopCode });
        console.log({ result });

        const ref = doc(db, 'shops', shopCode);
        setDoc(ref, { role: 'shop' }, { merge: true });

        setLoading(false);
        alert('アカウントを作成しました。');
      } catch (error) {
        console.log({ error });
        setError(firebaseError(error));
        setLoading(false);
      }
    }
  };

  return (
    <div className="pt-12">
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">店舗一覧</h1>
      {targetShopCode && (
        <ShopEdit
          open
          mode={role === 'manager' ? 'edit' : 'show'}
          shopCode={targetShopCode}
          onClose={() => setTargetShopCode('')}
          onUpdate={(shop) => {
            const index = shops.findIndex((s) => s.code === shop.code);
            if (index >= 0) {
              const shps = [...shops];
              shps[index] = shop;
              setShops(shps);
            }
          }}
        />
      )}
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
            {role === 'manager' && (
              <Button variant="outlined" className="mr-2" disabled={loading} onClick={pullKkb}>
                店舗情報更新
              </Button>
            )}
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
                <Table.Cell type="th">店舗名(カナ)</Table.Cell>
                <Table.Cell type="th">薬局名</Table.Cell>
                <Table.Cell type="th">TEL</Table.Cell>
                <Table.Cell type="th">郵便番号</Table.Cell>
                <Table.Cell type="th">都道府県</Table.Cell>
                <Table.Cell type="th">権限</Table.Cell>
                <Table.Cell type="th"></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {shops.map((shop, i) => {
                return (
                  <Table.Row key={i} className={clsx(shop.hidden && 'line-through')}>
                    <Table.Cell>{shop.code}</Table.Cell>
                    <Table.Cell>{shop.name}</Table.Cell>
                    <Table.Cell>{shop.kana}</Table.Cell>
                    <Table.Cell>{shop.formalName}</Table.Cell>
                    <Table.Cell>{shop.tel}</Table.Cell>
                    <Table.Cell>{shop.zip}</Table.Cell>
                    <Table.Cell>{prefectureName(shop.prefecture)}</Table.Cell>
                    <Table.Cell className="text-center">{shop.role && ROLE_NAMES[shop.role]}</Table.Cell>
                    <Table.Cell>
                      <Button
                        variant="icon"
                        size="xs"
                        color="none"
                        className="hover:bg-gray-300 "
                        onClick={() => setTargetShopCode(shop.code)}
                      >
                        <Icon name="pencil-alt" />
                      </Button>
                      {!shop.role && (
                        <Button
                          color="primary"
                          size="xs"
                          className="mr-2"
                          disabled={loading}
                          onClick={createAccount(shop.code)}
                        >
                          ｱｶｳﾝﾄ
                        </Button>
                      )}
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

export default ShopList;
