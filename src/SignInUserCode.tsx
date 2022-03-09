import React, { useState } from 'react';
import { Alert, Button, Form } from './components';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseError from './firebaseError';

const MAIL_DOMAIN = '@ebondregister.com';

const SignInUserCode: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [account, setAccount] = useState({ code: '', password: '' });
  const [error, setError] = useState<string>('');

  const login = (e: React.FormEvent) => {
    if (account.code[0] === '$') {
      const auth = getAuth();
      const email = account.code.slice(1) + MAIL_DOMAIN;
      setLoading(true);
      signInWithEmailAndPassword(auth, email, account.password)
        .then(() => {
          setLoading(false);
        })
        .catch((error) => {
          console.log({ error });
          setError(firebaseError(error));
          setLoading(false);
        });
    } else {
      e.preventDefault();
      setError('ユーザーが存在しません。');
    }
  };

  return (
    <Form onSubmit={login} className="p-3">
      <Form.Text
        size="md"
        placeholder="店舗番号"
        disabled={loading}
        autoComplete="new-password"
        required
        className="w-full mb-3"
        value={account.code}
        onChange={(e) => {
          setAccount({ ...account, code: e.target.value });
        }}
      />
      <Form.Password
        size="md"
        placeholder="パスワード"
        disabled={loading}
        autoComplete="new-password"
        required
        className="w-full mb-3"
        value={account.password}
        onChange={(e) => {
          setAccount({ ...account, password: e.target.value });
        }}
      />
      <Button variant="contained" color="primary" onClick={login} disabled={loading} className="w-full">
        ログイン
      </Button>
      {error && (
        <Alert severity="error" className="mt-3">
          {error}
        </Alert>
      )}
    </Form>
  );
};

export default SignInUserCode;
