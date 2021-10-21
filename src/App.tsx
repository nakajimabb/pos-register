import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

import AppBar from './AppBar';
import SignIn from './SignIn';
import Tailwind from './Tailwind';
import ImportProducts from './ImportProducts';
import RegisterMain from './RegisterMain';
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
        <Route exact path="/import_products" component={ImportProducts} />
        <Route exact path="/tailwind" component={Tailwind} />
        <Route exact path="/register_main" component={RegisterMain} />
      </Router>
    </React.StrictMode>
  );
};

export default App;
