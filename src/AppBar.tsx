import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Flex, Icon, Navbar, Tooltip } from './components';
import { getAuth, signOut } from 'firebase/auth';
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
      </Flex>
    </Navbar>
  );
};

export default AppBar;
