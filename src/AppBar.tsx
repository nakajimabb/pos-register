import React from 'react';
import { Link } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  doc,
  getFirestore,
  getDocs,
  collection,
  collectionGroup,
  query,
  Query,
  DocumentSnapshot,
  QuerySnapshot,
  QueryDocumentSnapshot,
  getDoc,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';

import { Button, Flex, Dropdown, Icon, Navbar, Tooltip } from './components';
import app from './firebase';
import { useAppContext } from './AppContext';
import { nameWithCode, isNum, arrToPieces } from './tools';
import {
  Delivery,
  DeliveryDetail,
  Purchase,
  PurchaseDetail,
  deliveryDetailPath,
  Product,
  purchaseDetailPath,
  Role,
  Stock,
  stockPath,
} from './types';
import firebaseError from './firebaseError';
import './App.css';

const db = getFirestore();
const MAX_BATCH = 500;

const AppBar: React.FC = () => {
  const { role, currentShop } = useAppContext();

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

  const initAvgCostPrices = async () => {
    if (window.confirm('移動平均原価をリセットしますか？')) {
      try {
        const q = collection(db, 'products');
        const snap = (await getDocs(q)) as QuerySnapshot<Product>;
        const pieces: QueryDocumentSnapshot<Product>[][] = arrToPieces(snap.docs, MAX_BATCH);
        const tasks = pieces.map(async (dsnaps) => {
          try {
            const batch = writeBatch(db);
            dsnaps.forEach((dsnap) => {
              const pdct = dsnap.data();
              if (!isNum(pdct.avgCostPrice) && isNum(pdct.costPrice)) {
                batch.set(doc(db, 'products', pdct.code), { ...pdct, avgCostPrice: pdct.costPrice }, { merge: true });
              }
            });
            await batch.commit();
            return { result: true };
          } catch (error) {
            return { result: false, error };
          }
        });
        const results = await Promise.all(tasks);
        console.log({ results });
        alert('移動平均原価をリセットしました。');
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const updateAvgCostPrices = async () => {
    const input = window.prompt('対象日');
    if (input) {
      try {
        const date1 = new Date(input);
        const date2 = new Date(input);
        date2.setDate(date2.getDate() + 1);

        // 仕入れ情報の取得
        const conds = [where('date', '>=', Timestamp.fromDate(date1)), where('date', '<', Timestamp.fromDate(date2))];
        const q = query(collectionGroup(db, 'purchases'), ...conds) as Query<Purchase>;
        const qsnap = await getDocs(q);
        const tasks = qsnap.docs.map(async (dsnap) => {
          const result: { shopCode: string; productCode: string; quantity: number; costPrice: number }[] = [];
          try {
            const purchase = dsnap.data();
            console.log({ purchase });
            const path = purchaseDetailPath(purchase.shopCode, purchase.purchaseNumber);
            const qsnap2 = (await getDocs(collection(db, path))) as QuerySnapshot<PurchaseDetail>;
            qsnap2.docs.forEach((dsnap2) => {
              const detail = dsnap2.data();
              if (isNum(detail.costPrice)) {
                result.push({
                  shopCode: purchase.shopCode,
                  productCode: detail.productCode,
                  quantity: detail.quantity,
                  costPrice: Number(detail.costPrice),
                });
              }
            });
          } catch (error) {
            console.log({ error });
          }
          return result;
        });
        const results = await Promise.all(tasks);
        console.log({ results });

        const items = new Map<string, { quantity: number; costPrice: number }[]>();
        results.flat().forEach((r) => {
          if (r.quantity > 0) {
            const item = items.get(r.productCode) ?? [];
            item.push({ quantity: r.quantity, costPrice: r.costPrice });
            items.set(r.productCode, item);
          }
        });
        console.log({ items });

        // 現在値、在庫数、仕入れ情報から移動平均原価の再計算を行う
        const tasks2 = Array.from(items.entries()).map(async ([productCode, item]) => {
          const result = { productCode, avgCostPrice: NaN, totalStock: 0, totalQuantity: 0 };
          try {
            const dPdct = (await getDoc(doc(db, 'products', productCode))) as DocumentSnapshot<Product>;
            const product = dPdct.data();
            if (product) {
              const validAvgCostPrice = isNum(product.avgCostPrice);
              let totalStock = 0;
              if (validAvgCostPrice) {
                const qstock = query(
                  collectionGroup(db, 'stocks'),
                  where('productCode', '==', productCode)
                ) as Query<Stock>;
                const snapStock = await getDocs(qstock);
                totalStock = snapStock.docs
                  .map((dsnap) => dsnap.data().quantity)
                  .reduce((sum, quantity) => sum + quantity, 0);
                result.totalStock = totalStock;
              }
              const totalQuantity = item.reduce((sum, i) => sum + i.quantity, 0);
              result.totalQuantity = totalQuantity;
              if (totalStock + totalQuantity > 0) {
                const avgCostPrice0 = validAvgCostPrice ? Number(product.avgCostPrice) : 0;
                const avgCostPrice =
                  item.reduce((sum, i) => sum + i.quantity * i.costPrice, avgCostPrice0 * totalStock) /
                  (totalStock + totalQuantity);
                result.avgCostPrice = avgCostPrice;
                await setDoc(
                  doc(db, 'products', productCode),
                  { avgCostPrice: Math.round(avgCostPrice) },
                  { merge: true }
                );
              }
            }
          } catch (error) {
            console.log({ error });
          }
          return result;
        });
        const results2 = await Promise.all(tasks2);
        console.log({ results2 });
        alert('移動平均原価を更新しました。');
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
          <Dropdown.Item title="配荷データ作成" to="/delivery_from_sale" />
        </Dropdown>
        <Dropdown
          icon={
            <Button color="light" size="sm" className="flex">
              廃棄・返品
              <div className="triangle-down ml-2 my-1"></div>
            </Button>
          }
          align="left"
          className="mx-2"
        >
          <Dropdown.Item title="廃棄・返品処理" to="/rejection_new" />
          <Dropdown.Item title="廃棄・返品一覧" to="/rejection_list" />
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
            <Dropdown.Item title="移動平均原価リセット" onClick={initAvgCostPrices} />
            <Dropdown.Item title="移動平均原価更新" onClick={updateAvgCostPrices} />
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
