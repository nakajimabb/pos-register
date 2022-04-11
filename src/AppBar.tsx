import React from 'react';
import { Link } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, getDocs, collection, collectionGroup, QuerySnapshot, setDoc } from 'firebase/firestore';

import { Button, Flex, Dropdown, Icon, Navbar, Tooltip } from './components';
import app from './firebase';
import { useAppContext } from './AppContext';
import { nameWithCode, isNum } from './tools';
import {
  Delivery,
  DeliveryDetail,
  Purchase,
  PurchaseDetail,
  deliveryDetailPath,
  purchaseDetailPath,
  Role,
} from './types';
import firebaseError from './firebaseError';
import './App.css';

const db = getFirestore();
const MAX_BATCH = 500;

const AppBar: React.FC = () => {
  const { role, currentShop, getProductPrice } = useAppContext();

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
  const updateDeliverySum = async () => {
    const qsnap = (await getDocs(collectionGroup(db, 'deliveries'))) as QuerySnapshot<Delivery>;
    for await (const dsnap of qsnap.docs) {
      const delv = dsnap.data();
      const path = deliveryDetailPath(delv.shopCode, delv.deliveryNumber);
      const qsnap2 = (await getDocs(collection(db, path))) as QuerySnapshot<DeliveryDetail>;
      let totalQuantity = 0;
      let totalAmount = 0;
      for await (const dsnap2 of qsnap2.docs) {
        const detail = dsnap2.data();
        totalQuantity += detail.quantity;
        if (detail.costPrice !== null && isNum(detail.costPrice)) {
          totalAmount += detail.quantity * detail.costPrice;
        }
      }
      setDoc(dsnap.ref, { totalVariety: qsnap2.size, totalQuantity, totalAmount }, { merge: true });
    }
    alert('completed!');
  };

  const updatePurchaseSum = async () => {
    const qsnap = (await getDocs(collectionGroup(db, 'purchases'))) as QuerySnapshot<Purchase>;
    for await (const dsnap of qsnap.docs) {
      const purch = dsnap.data();
      const path = purchaseDetailPath(purch.shopCode, purch.purchaseNumber);
      const qsnap2 = (await getDocs(collection(db, path))) as QuerySnapshot<PurchaseDetail>;
      let totalQuantity = 0;
      let totalAmount = 0;
      for await (const dsnap2 of qsnap2.docs) {
        const detail = dsnap2.data();
        totalQuantity += detail.quantity;
        if (detail.costPrice !== null && isNum(detail.costPrice)) {
          totalAmount += detail.quantity * detail.costPrice;
        }
      }
      setDoc(dsnap.ref, { totalVariety: qsnap2.size, totalQuantity, totalAmount }, { merge: true });
    }
    alert('completed!');
  };

  const saveRole = (role: Role) => async () => {
    const uid = window.prompt('input uid');
    if (uid) {
      try {
        const functions = getFunctions(app, 'asia-northeast1');
        const result = await httpsCallable(functions, 'saveRole')({ uid, role });
        console.log({ result });
        alert('更新しました。');
      } catch (error) {
        console.log({ error });
        alert('エラーが発生しました。');
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
              棚卸
              <div className="triangle-down ml-2 my-1"></div>
            </Button>
          }
          align="left"
          className="mx-2"
        >
          <Dropdown.Item title="棚卸処理" to="/invetory_new" />
          <Dropdown.Item title="棚卸一覧" to="/invetory_list" />
          {role === 'manager' && <Dropdown.Item title="棚卸モニタ" to="/invetory_all" />}
          {role === 'manager' && <Dropdown.Item title="在庫数取込" to="/import_stocks" />}
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
          <Dropdown.Item title="店舗商品マスタ" to="/shop_products" />
          {role === 'manager' && <Dropdown.Item title="商品マスタ取込" to="/import_products" />}
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
          <Dropdown.Item title="売上帳票" to="/sales_summary_list" />
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
        {(role === 'admin' || role === 'manager') && (
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
            <Dropdown.Item title="出庫合計更新" onClick={updateDeliverySum} />
            <Dropdown.Item title="仕入合計更新" onClick={updatePurchaseSum} />
            <Dropdown.Item title="tailwind" to="/tailwind" />{' '}
            {role === 'admin' && (
              <>
                <Dropdown.Item title="店舗権限" onClick={saveRole('shop')} />
                <Dropdown.Item title="管理者権限" onClick={saveRole('manager')} />
                <Dropdown.Item title="システム管理者権限" onClick={saveRole('admin')} />
              </>
            )}
          </Dropdown>
        )}
      </Flex>
    </Navbar>
  );
};

export default AppBar;
