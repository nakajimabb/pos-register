import React from 'react';
import { Link } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Button, Flex, Dropdown, Icon, Navbar, Tooltip } from './components';
import app from './firebase';
import './App.css';

const AppBar: React.FC = () => {
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
        const result = await httpsCallable(
          functions,
          'getAuthUserByCode'
        )({ uid });
        console.log({ result });
        alert('データを取得しました。');
      } catch (error) {
        console.log({ error });
        alert('エラーが発生しました。');
      }
    }
  };

  return (
    <Navbar fixed className="bg-gray-100 flex justify-between h-12">
      <Flex align_items="center"></Flex>
      <Flex align_items="center">
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
          <Dropdown.Item title="商品マスタ(共通)" to="/products" />
          <Dropdown.Item title="商品マスタ(共通)取込" to="/import_products" />
          <Dropdown.Item title="店舗原価マスタ取込" to="/import_cost_prices" />
          <Dropdown.Item
            title="店舗売価マスタ取込"
            to="/import_selling_prices"
          />
          <Dropdown.Item title="レジ画面" to="/register_main" />
          <Dropdown.Item title="ユーザ情報取得" onClick={getAuthUserByCode} />
          <Dropdown.Item title="tailwind" to="/tailwind" />
        </Dropdown>
      </Flex>
    </Navbar>
  );
};

export default AppBar;
