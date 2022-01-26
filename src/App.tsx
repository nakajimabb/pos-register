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
import PurchaseMain from './PurchaseMain';

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
          <Route exact path="/product_bundle_list" component={ProductBundleList} />
          <Route exact path="/product_bundle_edit" component={ProductBundleEdit} />
          <Route path="/product_bundle_edit/:id" component={ProductBundleEdit} />
          <Route path="/purchase_main" component={PurchaseMain} />
          <Route exact path="/tailwind" component={Tailwind} />
        </Router>
      </AppContextProvider>
    </React.StrictMode>
  );
};

export default App;
