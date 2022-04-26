import React, { useState } from 'react';
import {
  collection,
  doc,
  query,
  getDocs,
  deleteDoc,
  getFirestore,
  limit,
  limitToLast,
  orderBy,
  startAfter,
  endBefore,
  startAt,
  endAt,
  QueryConstraint,
  QuerySnapshot,
} from 'firebase/firestore';

import { useAppContext } from './AppContext';
import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import firebaseError from './firebaseError';
import SupplierEdit from './SupplierEdit';
import { Supplier } from './types';

const db = getFirestore();
const PER_PAGE = 25;
const MAX_SEARCH = 50;

const SupplierList: React.FC = () => {
  const [search, setSearch] = useState('');
  const [snapshot, setSnapshot] = useState<QuerySnapshot<Supplier> | null>(null);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [supplierCount, setSupplierCount] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const { role, counters } = useAppContext();

  const querySuppliers = (action: 'head' | 'prev' | 'next' | 'current') => async () => {
    try {
      setError('');
      const conds: QueryConstraint[] = [];
      const searchText = search.trim();
      if (searchText) {
        if (searchText.match(/^\d+$/)) {
          conds.push(orderBy('code'));
        } else {
          conds.push(orderBy('name'));
        }
        conds.push(startAt(searchText));
        conds.push(endAt(searchText + '\uf8ff'));
        conds.push(limit(MAX_SEARCH));
        setPage(0);
        setSupplierCount(null);
      } else {
        setSupplierCount(Number(counters?.suppliers.all));

        if (action === 'head') {
          conds.push(orderBy('code'));
          conds.push(limit(PER_PAGE));
          setPage(0);
        } else if (action === 'next') {
          if (snapshot) {
            conds.push(orderBy('code'));
            const last = snapshot.docs[snapshot.docs.length - 1];
            conds.push(startAfter(last));
            conds.push(limit(PER_PAGE));
            setPage(page + 1);
          }
        } else if (action === 'prev') {
          if (snapshot) {
            conds.push(orderBy('code', 'asc'));
            const last = snapshot.docs[0];
            conds.push(endBefore(last));
            conds.push(limitToLast(PER_PAGE));
            setPage(page - 1);
          }
        } else if (action === 'current') {
          if (snapshot) {
            const first = snapshot.docs[0];
            conds.push(startAt(first));
            conds.push(limit(PER_PAGE));
          }
        }
      }
      const q = query(collection(db, 'suppliers'), ...conds);
      const querySnapshot = await getDocs(q);
      setSnapshot(querySnapshot as QuerySnapshot<Supplier>);
      console.log({ size: querySnapshot.size });
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  const newSupplier = () => {
    setOpen(true);
    setDocId(null);
  };

  const editSupplier = (code: string) => () => {
    setOpen(true);
    setDocId(code);
  };

  const deleteSupplier = (code: string) => async () => {
    if (window.confirm('削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'suppliers', code));
        querySuppliers('current')();
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  return (
    <div className="pt-12 mx-auto max-w-4xl">
      {open && (
        <SupplierEdit open={open} docId={docId} onClose={() => setOpen(false)} onUpdate={querySuppliers('current')} />
      )}
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">仕入先マスタ</h1>
      <Card className="mx-8 mb-4">
        <Flex justify_content="between" align_items="center" className="p-4">
          <Flex>
            <Form.Text
              placeholder="検索文字"
              className="mr-2"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="outlined" className="mr-2" onClick={querySuppliers('head')}>
              検索
            </Button>
            <Button variant="outlined" className="mr-2" onClick={newSupplier}>
              新規
            </Button>
          </Flex>
          {snapshot && supplierCount && (
            <Flex>
              <Button
                color="light"
                size="xs"
                disabled={!!search || page <= 0 || !snapshot || snapshot.size === 0}
                className="mr-2"
                onClick={querySuppliers('prev')}
              >
                前へ
              </Button>
              <Button
                color="light"
                size="xs"
                disabled={
                  !!search || PER_PAGE * page + snapshot.size >= supplierCount || !snapshot || snapshot.size === 0
                }
                className="mr-2"
                onClick={querySuppliers('next')}
              >
                後へ
              </Button>
              <div>
                {`${PER_PAGE * page + 1}～${PER_PAGE * page + snapshot.size}`}/{`${supplierCount}`}
              </div>
            </Flex>
          )}
        </Flex>
        <Card.Body className="p-4">
          {error && <Alert severity="error">{error}</Alert>}
          <Table size="md" border="row" className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell type="th">仕入先コード</Table.Cell>
                <Table.Cell type="th">仕入先名称</Table.Cell>
                <Table.Cell type="th"></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {snapshot &&
                snapshot.docs.map((doc, i) => {
                  const supplier = doc.data();
                  return (
                    <Table.Row key={i}>
                      <Table.Cell>{supplier.code}</Table.Cell>
                      <Table.Cell>{supplier.name}</Table.Cell>
                      <Table.Cell>
                        {role === 'manager' && (
                          <>
                            <Button
                              variant="icon"
                              size="xs"
                              color="none"
                              className="hover:bg-gray-300 "
                              onClick={editSupplier(supplier.code)}
                            >
                              <Icon name="pencil-alt" />
                            </Button>
                            <Button
                              variant="icon"
                              size="xs"
                              color="none"
                              className="hover:bg-gray-300"
                              onClick={deleteSupplier(supplier.code)}
                            >
                              <Icon name="trash" />
                            </Button>
                          </>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
            </Table.Body>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default SupplierList;
