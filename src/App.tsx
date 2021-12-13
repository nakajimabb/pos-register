import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

import AppBar from './AppBar';
import SignIn from './SignIn';
import Tailwind from './Tailwind';
import ProductList from './ProductList';
import ProductCostPriceList from './ProductCostPriceList';
import ImportProducts from './ImportProducts';
import ImportSuppliers from './ImportSuppliers';
import ProductCategoryList from './ProductCategoryList';
import SupplierList from './SupplierList';
import RegisterMain from './RegisterMain';
import ShortcutEdit from './ShortcutEdit';
import ShopList from './ShopList';
import './App.css';
import ReceiptList from './ReceiptList';

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
      <Router>
        <Route path="/" component={AppBar} />
        <Route exact path="/" component={RegisterMain} />
        <Route exact path="/products" component={ProductList} />
        <Route exact path="/product_cost_prices" component={ProductCostPriceList} />
        <Route exact path="/import_products" component={() => <ImportProducts common={true} />} />
        <Route exact path="/import_shop_products" component={() => <ImportProducts common={false} />} />
        <Route exact path="/import_suppliers" component={ImportSuppliers} />
        <Route exact path="/suppliers" component={SupplierList} />
        <Route exact path="/product_categories" component={ProductCategoryList} />
        <Route exact path="/shops" component={ShopList} />
        <Route exact path="/shortcut_edit" component={ShortcutEdit} />
        <Route exact path="/receipt_list" component={ReceiptList} />
        <Route exact path="/tailwind" component={Tailwind} />
      </Router>
    </React.StrictMode>
  );
};

export default App;
