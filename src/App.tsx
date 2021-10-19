import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import SignIn from './SignIn';
import Tailwind from './Tailwind';
import './App.css';
import AppBar from './AppBar';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

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
        <Route exact path="/tailwind" component={Tailwind} />
      </Router>
    </React.StrictMode>
  );
};

export default App;
