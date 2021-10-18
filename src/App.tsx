import React from 'react';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import Tailwind from './Tailwind';
import './App.css';

const App: React.FC = () => {
  return (
    <React.StrictMode>
      <Router>
        <Route exact path="/tailwind" component={Tailwind} />
      </Router>
    </React.StrictMode>
  );
};

export default App;
