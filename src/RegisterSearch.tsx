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
  QueryConstraint,
  QuerySnapshot,
  onSnapshot,
} from 'firebase/firestore';
import { useAppContext } from './AppContext';
import { Alert, Button, Card, Flex, Form, Modal, Table } from './components';
import firebaseError from './firebaseError';
import { sortedProductCategories } from './tools';
import { Product, ProductCategory, ProductSellingPrice } from './types';

const db = getFirestore();
const PER_PAGE = 10;

type Props = {
  open: boolean;
  setProductCode: React.Dispatch<React.SetStateAction<string>>;
  findProduct: (code: string) => Promise<void>;
  onClose: () => void;
};

const RegisterSearch: React.FC<Props> = ({ open, setProductCode, findProduct, onClose }) => {
  const [search, setSearch] = useState({ text: '', categoryId: '' });
  const [snapshot, setSnapshot] = useState<QuerySnapshot<Product> | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([]);
  const [sellingPrices, setSellingPrices] = useState<{ [code: string]: number }>({});
  const [error, setError] = useState<string>('');
  const { counters, searchProducts, currentShop } = useAppContext();

  const existSearch = () => search.text.trim() || search.categoryId.trim();

  const queryProducts = (action: 'head' | 'prev' | 'next' | 'current') => async () => {
    try {
      setError('');
      const searchText = search.text.trim();
      let querySnapshot: QuerySnapshot<Product> | null = null;
      if (searchText) {
        const pds = await searchProducts(searchText);
        setSnapshot(null);
        setProducts(pds);
        setPage(0);
        setProductCount(null);
      } else {
        const conds: QueryConstraint[] = [];
        setProductCount(Number(counters?.products.all));

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
        const q = query(collection(db, 'products'), ...conds);
        querySnapshot = (await getDocs(q)) as QuerySnapshot<Product>;
        setSnapshot(querySnapshot);
        setProducts(querySnapshot.docs.map((item) => item.data()));
      }
      if (querySnapshot) {
        const sellingPricesDic: { [code: string]: number } = {};
        await Promise.all(
          querySnapshot.docs.map(async (productDoc, i) => {
            const product = productDoc.data() as Product;
            if (currentShop) {
              const sellingPriceref = doc(db, 'shops', currentShop.code, 'productSellingPrices', product.code);
              const sellingPriceSnap = await getDoc(sellingPriceref);
              if (sellingPriceSnap.exists()) {
                const sellingPrice = sellingPriceSnap.data() as ProductSellingPrice;
                if (sellingPrice.sellingPrice) {
                  sellingPricesDic[product.code] = Number(sellingPrice.sellingPrice);
                }
              }
            }
          })
        );
        setSellingPrices(sellingPricesDic);
        setSnapshot(querySnapshot as QuerySnapshot<Product>);
        setProducts(querySnapshot.docs.map((item) => item.data()));
      }
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    queryProducts('head')();
  };

  useEffect(() => {
    setSnapshot(null);
    setProducts([]);
    setSearch({ text: '', categoryId: '' });
    const unsubscribe = onSnapshot(collection(db, 'productCategories'), (snapshot) => {
      const categories = sortedProductCategories(snapshot as QuerySnapshot<ProductCategory>);
      const options = categories.map(({ id, productCategory }) => ({
        value: id,
        label: '　'.repeat(productCategory.level) + productCategory.name,
      }));
      options.unshift({ label: '-- カテゴリ --', value: '' });
      setCategoryOptions(options);
    });
    document.getElementById('searchText')?.focus();
    queryProducts('head')();
    return () => unsubscribe();
  }, [open]);

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-2/3">
      <Modal.Header centered={false} onClose={onClose}>
        商品検索
      </Modal.Header>
      <Modal.Body>
        <Card className="mx-8 mb-2">
          <Flex justify_content="between" align_items="center" className="p-4">
            <Form onSubmit={handleSubmit}>
              <Flex>
                <Form.Text
                  id="select"
                  size="md"
                  placeholder="PLUコード 商品名"
                  className="mr-2 w-64"
                  value={search.text}
                  onChange={(e) => setSearch({ ...search, text: e.target.value })}
                />
                <Form.Select
                  id="select"
                  size="md"
                  className="mr-2 w-40"
                  value={search.categoryId}
                  options={categoryOptions}
                  onChange={(e) => setSearch({ ...search, categoryId: e.target.value })}
                />
                <Button variant="outlined" size="sm" className="mr-2" onClick={queryProducts('head')}>
                  検索
                </Button>
              </Flex>
            </Form>
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
            <div className="overflow-y-scroll" style={{ height: '32rem' }}>
              <Table border="row" className="table-fixed w-full text-xs">
                <Table.Head>
                  <Table.Row size="sm">
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
                  {products.map((product, i) => {
                    return (
                      <Table.Row size="sm" className="hover:bg-gray-300" key={i}>
                        <Table.Cell>{product.code}</Table.Cell>
                        <Table.Cell className="truncate">{product.name}</Table.Cell>
                        <Table.Cell className="text-right">
                          {sellingPrices[product.code]
                            ? sellingPrices[product.code].toLocaleString()
                            : product.sellingPrice?.toLocaleString()}
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            color="primary"
                            size="xs"
                            onClick={() => {
                              setProductCode(product.code);
                              findProduct(product.code);
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
