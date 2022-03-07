import React, { useState, useEffect } from 'react';
import { truncate } from 'lodash';
import {
  collection,
  doc,
  query,
  getDocs,
  setDoc,
  deleteDoc,
  getFirestore,
  limit,
  limitToLast,
  orderBy,
  startAfter,
  endBefore,
  startAt,
  where,
  QueryConstraint,
  QuerySnapshot,
  onSnapshot,
  serverTimestamp,
  Bytes,
} from 'firebase/firestore';
import clsx from 'clsx';

import { useAppContext } from './AppContext';
import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import firebaseError from './firebaseError';
import ProductEdit from './ProductEdit';
import { sortedProductCategories } from './tools';
import { Product, ProductCategory, Supplier } from './types';

// import * as zlib from 'zlib';
const zlib = require('zlib');

const db = getFirestore();
const PER_PAGE = 25;

type SearchType = { text: string; categoryId: string };

type Props = {
  searchText?: string;
};

const ProductList: React.FC<Props> = ({ searchText = '' }) => {
  const [search, setSearch] = useState<SearchType>({ text: searchText, categoryId: '' });
  const [snapshot, setSnapshot] = useState<QuerySnapshot<Product> | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productCategories, setProductCategories] = useState<{ id: string; productCategory: ProductCategory }[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; supplier: Supplier }[]>([]);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [docId, setDocId] = useState<string | null>(null);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string>('');
  const { counters, searchProducts } = useAppContext();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'productCategories'), (snapshot) => {
      const categories = sortedProductCategories(snapshot as QuerySnapshot<ProductCategory>);
      setProductCategories(categories);
      const options = categories.map(({ id, productCategory }) => ({
        value: id,
        label: '　'.repeat(productCategory.level) + productCategory.name,
      }));
      options.unshift({ label: '-- カテゴリ --', value: '' });
      setCategoryOptions(options);
    });
    queryProducts(search, 'head')();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const newSuppliers = snapshot.docs.map((item) => ({ id: item.id, supplier: item.data() as Supplier }));
      setSuppliers(newSuppliers);
    });
    return () => unsubscribe();
  }, []);

  const existSearch = (search: SearchType) => search.text.trim() || search.categoryId.trim();

  const queryProducts = (search: SearchType, action: 'head' | 'prev' | 'next' | 'current') => async () => {
    try {
      setError('');
      const searchText = search.text.trim();
      if (searchText) {
        const pds = await searchProducts(searchText);
        setSnapshot(null);
        setProducts(pds);
        setPage(0);
        setProductCount(null);
      } else {
        const conds: QueryConstraint[] = [];
        setProductCount(Number(counters?.products.all));

        conds.push(where('hidden', '==', false));
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
        const querySnapshot = (await getDocs(q)) as QuerySnapshot<Product>;
        setSnapshot(querySnapshot);
        setProducts(querySnapshot.docs.map((item) => item.data()));
      }
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  const newProduct = () => {
    setOpen(true);
    setDocId(null);
  };

  const editProduct = (code: string) => () => {
    setOpen(true);
    setDocId(code);
  };

  const deleteProduct = (code: string) => async () => {
    if (window.confirm('削除してもよろしいですか？')) {
      try {
        await deleteDoc(doc(db, 'products', code));
        queryProducts(search, 'current')();
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const categoryName = (product: Product) => {
    if (product.supplierRef) {
      const category = productCategories.find((s) => s.id === product.categoryRef?.id);
      return category?.productCategory?.name;
    }
  };

  const supplierName = (product: Product) => {
    if (product.supplierRef) {
      const supplier = suppliers.find((s) => s.id === product.supplierRef?.id);
      return supplier?.supplier?.name;
    }
  };

  const createFullTextSearch = async () => {
    if (window.confirm('全文検索用のデータを作成しますか？')) {
      const q = query(collection(db, 'products'), where('hidden', '==', false));
      const snap = await getDocs(q);

      // 検索用テキストをセパレータで区切って１つの文字列として格納
      const texts = snap.docs.map((item) => {
        const product = item.data() as Product;
        return [product.code, product.name].join('|');
      });

      // 圧縮してバイナリデータとして保存
      const json = JSON.stringify(texts);
      const blob = Bytes.fromUint8Array(zlib.gzipSync(encodeURIComponent(json)));

      await setDoc(doc(db, 'searches', 'products'), { blob });
      await setDoc(
        doc(db, 'counters', 'products'),
        {
          searchUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      alert('全文検索用のデータを作成しました。');
    }
  };

  return (
    <div className="pt-12">
      <ProductEdit
        open={open}
        docId={docId}
        productCategories={productCategories}
        suppliers={suppliers}
        onClose={() => setOpen(false)}
        onUpdate={queryProducts(search, 'current')}
      />
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">商品マスタ(共通)</h1>
      <Card className="mx-8 mb-4 overflow-visible">
        <Flex justify_content="between" align_items="center" className="p-4">
          <Flex>
            <Form.Text
              id="select"
              size="md"
              placeholder="PLUコード 商品名"
              className="mr-2 w-80"
              value={search.text}
              onChange={(e) => setSearch({ ...search, text: e.target.value })}
            />
            <Form.Select
              id="select"
              size="md"
              className="mr-2 w-64"
              value={search.categoryId}
              options={categoryOptions}
              onChange={(e) => setSearch({ ...search, categoryId: e.target.value })}
            />
            <Button variant="outlined" className="mr-2" onClick={queryProducts(search, 'head')}>
              検索
            </Button>
            <Button variant="outlined" className="mr-2" onClick={newProduct}>
              新規
            </Button>
            <Button variant="outlined" className="mr-2" onClick={createFullTextSearch}>
              検索データ作成
            </Button>
          </Flex>
          {snapshot && productCount && (
            <Flex>
              <Button
                color="light"
                size="xs"
                disabled={!!existSearch(search) || page <= 0 || !snapshot || snapshot.size === 0}
                className="mr-2"
                onClick={queryProducts(search, 'prev')}
              >
                前へ
              </Button>
              <Button
                color="light"
                size="xs"
                disabled={
                  !!existSearch(search) ||
                  PER_PAGE * page + snapshot.size >= productCount ||
                  !snapshot ||
                  snapshot.size === 0
                }
                className="mr-2"
                onClick={queryProducts(search, 'next')}
              >
                後へ
              </Button>
              <div>
                {`${PER_PAGE * page + 1}～${PER_PAGE * page + snapshot.size}`}/{`${productCount}`}
              </div>
            </Flex>
          )}
        </Flex>
        <Card.Body className="p-4">
          {error && <Alert severity="error">{error}</Alert>}
          <Table size="md" border="row" className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell type="th">PLUコード</Table.Cell>
                <Table.Cell type="th">商品名称</Table.Cell>
                <Table.Cell type="th">カテゴリ</Table.Cell>
                <Table.Cell type="th">売価</Table.Cell>
                <Table.Cell type="th">原価</Table.Cell>
                <Table.Cell type="th">ｾﾙﾒ</Table.Cell>
                <Table.Cell type="th">仕入先</Table.Cell>
                <Table.Cell type="th"></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {products.map((product, i) => {
                return (
                  <Table.Row key={i} className={clsx(product.hidden && 'text-gray-300')}>
                    <Table.Cell>{product.code}</Table.Cell>
                    <Table.Cell>{product.name}</Table.Cell>
                    <Table.Cell>{truncate(categoryName(product), { length: 10 })}</Table.Cell>
                    <Table.Cell className="text-right">{product.sellingPrice?.toLocaleString()}</Table.Cell>
                    <Table.Cell className="text-right">{product.costPrice?.toLocaleString()}</Table.Cell>
                    <Table.Cell className="text-center">{product.selfMedication && '○'}</Table.Cell>
                    <Table.Cell>{truncate(supplierName(product), { length: 10 })}</Table.Cell>
                    <Table.Cell>
                      <Button
                        variant="icon"
                        size="xs"
                        color="none"
                        className="hover:bg-gray-300 "
                        onClick={editProduct(product.code)}
                      >
                        <Icon name="pencil-alt" />
                      </Button>
                      <Button
                        variant="icon"
                        size="xs"
                        color="none"
                        className="hover:bg-gray-300"
                        onClick={deleteProduct(product.code)}
                      >
                        <Icon name="trash" />
                      </Button>
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

export default ProductList;
