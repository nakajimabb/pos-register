import React from 'react';
import { Link } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, getDocs, collectionGroup, writeBatch } from 'firebase/firestore';

import { Button, Flex, Dropdown, Icon, Navbar, Tooltip } from './components';
import app from './firebase';
import { useAppContext } from './AppContext';
import { nameWithCode } from './tools';
import firebaseError from './firebaseError';
import './App.css';

const db = getFirestore();
const MAX_BATCH = 500;

const AppBar: React.FC = () => {
  const { currentShop } = useAppContext();

  const logout = () => {
    if (window.confirm('ログアウトしますか？')) {
      const auth = getAuth();
      signOut(auth)
        .then(function () {
          // Sign-out successful.
        })
        .catch(function (error) {
          // An error happened.
          alert('エラーが発生しました。');
          console.log({ error });
        });
    }
  };

  const getAuthUserByCode = async () => {
    const uid = window.prompt('input uid');
    if (uid) {
      try {
        const functions = getFunctions(app, 'asia-northeast1');
        const result = await httpsCallable(functions, 'getAuthUserByCode')({ uid });
        console.log({ result });
        alert('データを取得しました。');
      } catch (error) {
        console.log({ error });
        alert('エラーが発生しました。');
      }
    }
  };

  const clearProductCostPrices = async () => {
    if (window.confirm('削除してもよろしいですか？')) {
      try {
        const querySnapshot = await getDocs(collectionGroup(db, 'productCostPrices'));
        console.log({ len: querySnapshot.docs.length });
        const refs = querySnapshot.docs.map((ds) => ds.ref);
        const taskSize = Math.ceil(refs.length / MAX_BATCH);
        const sequential = [...Array(taskSize)].map((_, i) => i);
        const tasks = sequential.map(async (_, i) => {
          try {
            const batch = writeBatch(db);
            const sliced = refs.slice(i * MAX_BATCH, (i + 1) * MAX_BATCH);
            sliced.forEach((ref) => batch.delete(ref));
            await batch.commit();
            return { count: sliced.length, error: '' };
          } catch (error) {
            return { count: 0, error: firebaseError(error) };
          }
        });
        const results = await Promise.all(tasks);
        const count = results.reduce((cnt, res) => cnt + res.count, 0);
        const errors = results.filter((res) => !!res.error).map((res) => res.error);
        alert(`${count}件のデータを削除しました。`);
        console.log({ errors });
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  return (
    <Navbar fixed className="bg-gray-100 flex justify-between h-12">
      <Flex align_items="center">
        <img src="pos-register.png" alt="logo" className="h-10 mx-6 hidden sm:block" />
        <Link to="/" className="mx-2">
          <Button color="light" size="sm">
            レジ画面
          </Button>
        </Link>
        <Dropdown
          icon={
            <Button color="light" size="sm" className="flex">
              仕入
              <div className="triangle-down ml-2 my-1"></div>
            </Button>
          }
          align="left"
          className="mx-2"
        >
          <Dropdown.Item title="仕入処理" to="/purchase_new" />
          <Dropdown.Item title="仕入一覧" to="/purchase_list" />
        </Dropdown>
        <Dropdown
          icon={
            <Button color="light" size="sm" className="flex">
              出庫
              <div className="triangle-down ml-2 my-1"></div>
            </Button>
          }
          align="left"
          className="mx-2"
        >
          <Dropdown.Item title="出庫処理" to="/delivery_new" />
          <Dropdown.Item title="出庫一覧" to="/delivery_list" />
        </Dropdown>
        <Dropdown
          icon={
            <Button color="light" size="sm" className="flex">
              商品マスタ
              <div className="triangle-down ml-2 my-1"></div>
            </Button>
          }
          align="left"
          className="mx-2"
        >
          <Dropdown.Item title="商品マスタ(共通)" to="/products" />
          <Dropdown.Item title="店舗原価マスタ" to="/product_cost_prices" />
          <Dropdown.Item title="店舗売価マスタ" to="/product_selling_prices" />
          <Dropdown.Item title="商品マスタ(共通)取込" to="/import_products" />
          <Dropdown.Item title="商品マスタ(店舗)取込" to="/import_shop_products" />
          <Dropdown.Item title="商品カテゴリ" to="/product_categories" />
          <Dropdown.Item title="バンドル" to="/product_bundle_list" />
          <Dropdown.Item title="セット" to="/product_bulk_list" />
          <Dropdown.Item title="未登録商品" to="/unregistered_products" />
        </Dropdown>
        <Dropdown
          icon={
            <Button color="light" size="sm" className="flex">
              その他
              <div className="triangle-down ml-2 my-1"></div>
            </Button>
          }
          align="left"
          className="mx-2"
        >
          <Dropdown.Item title="店舗一覧" to="/shops" />
          <Dropdown.Item title="仕入先マスタ" to="/suppliers" />
          <Dropdown.Item title="仕入先マスタ取込" to="/import_suppliers" />
        </Dropdown>
      </Flex>
      <Flex align_items="center">
        {currentShop && nameWithCode(currentShop)}
        <Link to="/sign_in">
          <Tooltip title="ログアウト">
            <Button
              variant="icon"
              size="sm"
              color="none"
              className="m-2 text-gray-500 hover:bg-gray-200 focus:ring-inset focus:ring-gray-300"
              onClick={logout}
            >
              <Icon name="logout" />
            </Button>
          </Tooltip>
        </Link>
        <Dropdown
          icon={
            <Button
              variant="icon"
              size="sm"
              color="none"
              className="m-2 text-gray-500 hover:bg-gray-200 focus:ring-inset focus:ring-gray-300"
            >
              <Icon name="dots-vertical" />
            </Button>
          }
          align="right"
        >
          <Dropdown.Item title="ユーザ情報取得" onClick={getAuthUserByCode} />
          <Dropdown.Item title="店舗原価マスタ全削除" onClick={clearProductCostPrices} />
          <Dropdown.Item title="tailwind" to="/tailwind" />
        </Dropdown>
      </Flex>
    </Navbar>
  );
};

export default AppBar;
