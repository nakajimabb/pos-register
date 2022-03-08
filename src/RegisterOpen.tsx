import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc, setDoc, updateDoc, getFirestore, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { Alert, Button, Card, Flex, Form } from './components';
import firebaseError from './firebaseError';
import { useAppContext } from './AppContext';
import { RegisterStatus } from './types';
import { toDateString } from './tools';

const db = getFirestore();

const RegisterOpen: React.FC = () => {
  const { currentShop } = useAppContext();
  const [error, setError] = useState('');
  const [openDate, setOpenDate] = useState<Date>(new Date());

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (currentShop) {
        const statusRef = doc(db, 'shops', currentShop.code, 'status', format(openDate, 'yyyyMMdd'));
        const statusSnap = await getDoc(statusRef);
        if (statusSnap.exists()) {
          const status = statusSnap.data() as RegisterStatus;
          if (status.openedAt.toDate().toLocaleDateString() === openDate.toLocaleDateString() && status.closedAt) {
            if (openDate.toLocaleDateString() === new Date().toLocaleDateString()) {
              await updateDoc(statusRef, { closedAt: null });
            } else {
              throw Error('すでに精算済みです。');
            }
          }
        } else {
          await setDoc(statusRef, { date: openDate, openedAt: Timestamp.fromDate(new Date()), closedAt: null });
        }
      }
      window.location.href = '/';
    } catch (error) {
      setError(firebaseError(error));
    }
  };

  return (
    <Flex direction="col" justify_content="center" align_items="center" className="h-screen">
      <Card className="container w-1/3 p-2">
        <Card.Body>
          {error && (
            <Alert severity="error" className="my-4">
              {error}
            </Alert>
          )}
          <p className="text-center">この営業日でレジを開設します。</p>
          <div className="flex justify-center">
            <Form className="my-4">
              <Form.Date
                value={openDate ? toDateString(openDate, 'YYYY-MM-DD') : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setOpenDate(new Date(e.target.value));
                  }
                }}
              />
            </Form>
          </div>

          <div className="flex justify-center p-4">
            <Button color="primary" className="w-40" onClick={save}>
              OK
            </Button>
          </div>
        </Card.Body>
      </Card>
      <div className="m-4">
        <Link to="/">
          <Button color="light" size="sm">
            戻る
          </Button>
        </Link>
      </div>
    </Flex>
  );
};
export default RegisterOpen;
