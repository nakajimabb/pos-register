import React, { useState, useEffect } from 'react';
import { truncate } from 'lodash';
import {
  collection,
  collectionGroup,
  doc,
  query,
  getDocs,
  deleteDoc,
  getFirestore,
  orderBy,
  startAt,
  endAt,
  QueryConstraint,
  QuerySnapshot,
  onSnapshot,
} from 'firebase/firestore';
import Select from 'react-select';

import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import firebaseError from './firebaseError';
import { useAppContext } from './AppContext';
import ProductCostPriceEdit from './ProductCostPriceEdit';
import { ProductCostPrice, Shop } from './types';
import { nameWithCode, userCodeFromEmail } from './tools';

const db = getFirestore();

const ProductCostPriceList: React.FC = () => {
  const [search, setSearch] = useState({ text: '', shopCode: '' });
  const [snapshot, setSnapshot] = useState<QuerySnapshot<ProductCostPrice> | null>(null);
  const [open, setOpen] = useState(false);
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string>('');
  const { currentUser } = useAppContext();

  useEffect(() => {
    if (currentUser && currentUser.email) {
      const shopCode = userCodeFromEmail(currentUser.email);
      if (shopCode) setSearch((prev) => ({ ...prev, shopCode }));
    }
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'shops'), (snapshot) => {
      const options = snapshot.docs.map((item) => {
        const shop = item.data() as Shop;
        return { value: item.id, label: nameWithCode(shop) };
      });
      options.unshift({ label: '', value: '' });
      setShopOptions(options);
    });
    return () => unsubscribe();
  }, []);

  const queryResults = async () => {
    try {
      if (!search.shopCode) {
        setError('店舗を指定してください。');
        return;
      } else {
        setError('');
      }
      const searchText = search.text.trim();
      const conds: QueryConstraint[] = [];
      if (searchText) {
        if (searchText) {
          if (searchText.match(/^\d+$/)) {
            conds.push(orderBy('productCode'));
          } else {
            conds.push(orderBy('productName'));
          }
          conds.push(startAt(searchText));
          conds.push(endAt(searchText + '\uf8ff'));
        }
      }
      const q = query(collection(db, 'shops', search.shopCode, 'productCostPrices'), ...conds);
      const querySnapshot = await getDocs(q);
      setSnapshot(querySnapshot as QuerySnapshot<ProductCostPrice>);
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  const newProductCostPrice = (shopCode: string) => () => {
    if (shopCode) {
      setOpen(true);
      setTargetPath(null);
    }
  };

  const editProductCostPrice = (path: string) => () => {
    setOpen(true);
    setTargetPath(path);
  };

  const deleteProductCostPrice = (path: string) => async () => {
    if (window.confirm('削除してもよろしいですか？')) {
      try {
        if (path) {
          await deleteDoc(doc(db, path));
          queryResults();
        }
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  return (
    <div className="pt-12">
      {search.shopCode && (
        <ProductCostPriceEdit
          open={open}
          shopCode={search.shopCode}
          path={targetPath}
          onClose={() => setOpen(false)}
          onUpdate={queryResults}
        />
      )}
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">店舗原価マスタ</h1>
      <Card className="mx-8 mb-4 overflow-visible">
        <Flex justify_content="between" align_items="center" className="p-4">
          <Flex>
            <Form.Text
              placeholder="検索文字"
              className="mr-2"
              value={search.text}
              onChange={(e) => setSearch({ ...search, text: e.target.value })}
            />
            <Select
              className="mr-2 w-64"
              value={selectValue(search.shopCode, shopOptions)}
              options={shopOptions}
              onChange={(e) => setSearch({ ...search, shopCode: String(e?.value) })}
            />
            <Button variant="outlined" onClick={queryResults} className="mr-2">
              検索
            </Button>
            <Button variant="outlined" className="mr-2" onClick={newProductCostPrice(search.shopCode)}>
              新規
            </Button>
          </Flex>
        </Flex>
        <Card.Body className="p-4">
          {error && <Alert severity="error">{error}</Alert>}
          <Table size="md" border="row" className="w-full">
            <Table.Head>
              <Table.Row>
                <Table.Cell type="th">PLUコード</Table.Cell>
                <Table.Cell type="th">商品名称</Table.Cell>
                <Table.Cell type="th">原価</Table.Cell>
                <Table.Cell type="th">仕入先</Table.Cell>
                <Table.Cell type="th"></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {snapshot &&
                snapshot.docs.map((doc, i) => {
                  const item = doc.data();
                  const path = doc.ref.path;

                  return (
                    <Table.Row key={i}>
                      <Table.Cell>{item.productCode}</Table.Cell>
                      <Table.Cell>{item.productName}</Table.Cell>
                      <Table.Cell className="text-right">{item.costPrice?.toLocaleString()}</Table.Cell>
                      <Table.Cell>{truncate(item.supplierName, { length: 10 })}</Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300 "
                          onClick={editProductCostPrice(path)}
                        >
                          <Icon name="pencil-alt" />
                        </Button>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={deleteProductCostPrice(path)}
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

export default ProductCostPriceList;
