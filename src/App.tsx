import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

import AppBar from './AppBar';
import SignIn from './SignIn';
import Tailwind from './Tailwind';
import ProductList from './ProductList';
import ProductCostPriceList from './ProductCostPriceList';
import ProductSellingPriceList from './ProductSellingPriceList';
import ImportProducts from './ImportProducts';
import ImportSuppliers from './ImportSuppliers';
import ProductCategoryList from './ProductCategoryList';
import SupplierList from './SupplierList';
import RegisterMain from './RegisterMain';
import ShortcutEdit from './ShortcutEdit';
import ShopList from './ShopList';
import { AppContextProvider } from './AppContext';
import './App.css';
import ReceiptList from './ReceiptList';
import ProductBundleList from './ProductBundleList';
import ProductBundleEdit from './ProductBundleEdit';
import ProductBulkList from './ProductBulkList';
import ProductBulkEdit from './ProductBulkEdit';
import PurchaseMain from './PurchaseMain';
import PurchaseList from './PurchaseList';
import DeliveryMain from './DeliveryMain';
import DeliveryList from './DeliveryList';
import DailyCashReport from './DailyCashReport';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
  }, []);

  if (!currentUser) return <SignIn />;

  return (
    <React.StrictMode>
      <AppContextProvider>
        <Router>
          <Route path="/" component={AppBar} />
          <Route exact path="/" component={RegisterMain} />
          <Route exact path="/products" component={ProductList} />
          <Route exact path="/product_cost_prices" component={ProductCostPriceList} />
          <Route exact path="/product_selling_prices" component={ProductSellingPriceList} />
          <Route exact path="/import_products" component={() => <ImportProducts common={true} />} />
          <Route exact path="/import_shop_products" component={() => <ImportProducts common={false} />} />
          <Route exact path="/import_suppliers" component={ImportSuppliers} />
          <Route exact path="/suppliers" component={SupplierList} />
          <Route exact path="/product_categories" component={ProductCategoryList} />
          <Route exact path="/shops" component={ShopList} />
          <Route exact path="/shortcut_edit" component={ShortcutEdit} />
          <Route exact path="/receipt_list" component={ReceiptList} />
          <Route exact path="/daily_cash_report" component={DailyCashReport} />
          <Route exact path="/product_bundle_list" component={ProductBundleList} />
          <Route exact path="/product_bundle_edit" component={ProductBundleEdit} />
          <Route path="/product_bundle_edit/:id" component={ProductBundleEdit} />
          <Route exact path="/product_bulk_list" component={ProductBulkList} />
          <Route exact path="/product_bulk_edit" component={ProductBulkEdit} />
          <Route path="/product_bulk_edit/:id" component={ProductBulkEdit} />
          <Route path="/purchase_main" component={PurchaseMain} />
          <Route path="/purchase_list" component={PurchaseList} />
          <Route path="/delivery_main" component={DeliveryMain} />
          <Route path="/delivery_list" component={DeliveryList} />
          <Route exact path="/tailwind" component={Tailwind} />
        </Router>
      </AppContextProvider>
    </React.StrictMode>
  );
};

export default App;
