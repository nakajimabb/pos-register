import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

import AppBar from './AppBar';
import SignIn from './SignIn';
import Tailwind from './Tailwind';
import ProductList from './ProductList';
import ImportProducts from './ImportProducts';
import ImportCostPrices from './ImportCostPrices';
import ImportSuppliers from './ImportSuppliers';
import ImportSellingPrices from './ImportSellingPrices';
import ProductCategoryList from './ProductCategoryList';
import SupplierList from './SupplierList';
import RegisterMain from './RegisterMain';
import ShortcutEdit from './ShortcutEdit';
import ShopList from './ShopList';
import './App.css';

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
        <Route exact path="/import_products" component={ImportProducts} />
        <Route exact path="/import_cost_prices" component={ImportCostPrices} />
        <Route exact path="/import_selling_prices" component={ImportSellingPrices} />
        <Route exact path="/import_suppliers" component={ImportSuppliers} />
        <Route exact path="/suppliers" component={SupplierList} />
        <Route exact path="/product_categories" component={ProductCategoryList} />
        <Route exact path="/shops" component={ShopList} />
        <Route exact path="/shortcut_edit" component={ShortcutEdit} />
        <Route exact path="/tailwind" component={Tailwind} />
      </Router>
    </React.StrictMode>
  );
};

export default App;
