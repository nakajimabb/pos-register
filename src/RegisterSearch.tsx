import React, { useState, useEffect } from 'react';
import {
  collection,
  doc,
  query,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  limitToLast,
  orderBy,
  startAfter,
  endBefore,
  startAt,
  endAt,
  where,
  QueryConstraint,
  QuerySnapshot,
  onSnapshot,
} from 'firebase/firestore';
import { Alert, Button, Card, Flex, Form, Modal, Table } from './components';
import firebaseError from './firebaseError';
import { sortedProductCategories } from './tools';
import { Product, ProductCategory } from './types';

const db = getFirestore();
const PER_PAGE = 10;
const MAX_SEARCH = 50;

type BasketItem = {
  product: Product;
  quantity: number;
};

type Props = {
  open: boolean;
  basketItems: BasketItem[];
  setBasketItems: React.Dispatch<React.SetStateAction<BasketItem[]>>;
  onClose: () => void;
};

const RegisterSearch: React.FC<Props> = ({ open, basketItems, setBasketItems, onClose }) => {
  const [search, setSearch] = useState({ text: '', categoryId: '' });
  const [snapshot, setSnapshot] = useState<QuerySnapshot<Product> | null>(null);
  const [page, setPage] = useState(0);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string>('');

  const existSearch = () => search.text.trim() || search.categoryId.trim();

  const queryProducts = (action: 'head' | 'prev' | 'next' | 'current') => async () => {
    try {
      setError('');
      const conds: QueryConstraint[] = [];
      if (existSearch()) {
        const searchText = search.text.trim();
        const categoryId = search.categoryId.trim();
        if (searchText) {
          if (searchText.match(/^\d+$/)) {
            conds.push(orderBy('code'));
          } else {
            conds.push(orderBy('name'));
          }
          conds.push(startAt(searchText));
          conds.push(endAt(searchText + '\uf8ff'));
        }
        if (categoryId) {
          const ref = doc(db, 'productCategories', categoryId);
          conds.push(where('categoryRef', '==', ref));
        }
        conds.push(limit(MAX_SEARCH));
        setPage(0);
        setProductCount(null);
      } else {
        const snap = await getDoc(doc(db, 'productCounts', 'all'));
        if (snap.exists()) {
          setProductCount(snap.data().count);
        } else {
          setProductCount(null);
        }

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
      const q = query(collection(db, 'products'), ...conds);
      const querySnapshot = await getDocs(q);
      setSnapshot(querySnapshot as QuerySnapshot<Product>);
      console.log({ size: querySnapshot.size });
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  useEffect(() => {
    setSnapshot(null);
    const unsubscribe = onSnapshot(collection(db, 'productCategories'), (snapshot) => {
      const categories = sortedProductCategories(snapshot as QuerySnapshot<ProductCategory>);
      const options = categories.map(({ id, productCategory }) => ({
        value: id,
        label: '　'.repeat(productCategory.level) + productCategory.name,
      }));
      options.unshift({ label: '', value: '' });
      setCategoryOptions(options);
    });
    document.getElementById('searchText')?.focus();
    return () => unsubscribe();
  }, [open]);

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-2/3">
      <Modal.Header centered={false} onClose={onClose}>
        商品検索
      </Modal.Header>
      <Modal.Body>
        <Card className="mx-8 mb-4">
          <Flex justify_content="between" align_items="center" className="p-4">
            <Flex>
              <Form.Text
                size="sm"
                placeholder="検索文字"
                className="mr-2"
                id="searchText"
                value={search.text}
                onChange={(e) => setSearch({ ...search, text: e.target.value })}
              />
              <Form.Select
                id="select"
                size="sm"
                className="mr-2"
                value={search.categoryId}
                options={categoryOptions}
                onChange={(e) => setSearch({ ...search, categoryId: e.target.value })}
              />
              <Button variant="outlined" size="sm" className="mr-2" onClick={queryProducts('head')}>
                検索
              </Button>
            </Flex>
            {snapshot && productCount && (
              <Flex>
                <Button
                  color="light"
                  size="xs"
                  disabled={!!existSearch() || page <= 0 || !snapshot || snapshot.size === 0}
                  className="mr-2"
                  onClick={queryProducts('prev')}
                >
                  前へ
                </Button>
                <Button
                  color="light"
                  size="xs"
                  disabled={
                    !!existSearch() ||
                    PER_PAGE * page + snapshot.size >= productCount ||
                    !snapshot ||
                    snapshot.size === 0
                  }
                  className="mr-2"
                  onClick={queryProducts('next')}
                >
                  次へ
                </Button>
                <div className="text-xs align-middle p-1.5">
                  {`${PER_PAGE * page + 1}～${PER_PAGE * page + snapshot.size}`}/{`${productCount}`}
                </div>
              </Flex>
            )}
          </Flex>
          <Card.Body className="p-4">
            {error && <Alert severity="error">{error}</Alert>}
            <div className="overflow-y-scroll">
              <Table border="row" className="table-fixed w-full text-sm">
                <Table.Head>
                  <Table.Row>
                    <Table.Cell type="th" className="w-2/12">
                      コード
                    </Table.Cell>
                    <Table.Cell type="th" className="w-6/12">
                      商品名称
                    </Table.Cell>
                    <Table.Cell type="th" className="w-2/12">
                      売価税抜
                    </Table.Cell>
                    <Table.Cell type="th" className="w-2/12"></Table.Cell>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {snapshot &&
                    snapshot.docs.map((doc, i) => {
                      const product = doc.data();
                      return (
                        <Table.Row className="hover:bg-gray-300" key={i}>
                          <Table.Cell>{product.code}</Table.Cell>
                          <Table.Cell className="truncate">{product.name}</Table.Cell>
                          <Table.Cell className="text-right">{product.price?.toLocaleString()}</Table.Cell>
                          <Table.Cell>
                            <Button
                              color="primary"
                              size="xs"
                              onClick={() => {
                                const existingIndex = basketItems.findIndex(
                                  (basketItem) => basketItem.product.code === product.code
                                );
                                if (existingIndex >= 0) {
                                  basketItems[existingIndex].quantity += 1;
                                  setBasketItems([...basketItems]);
                                } else {
                                  const basketItem = {
                                    product,
                                    quantity: 1,
                                  };
                                  setBasketItems([...basketItems, basketItem]);
                                }
                                onClose();
                              }}
                            >
                              選択
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                </Table.Body>
              </Table>
            </div>
          </Card.Body>
        </Card>
      </Modal.Body>
      <Modal.Footer className="flex justify-end">
        <Button color="secondary" variant="outlined" className="mr-3" onClick={onClose}>
          キャンセル
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RegisterSearch;
