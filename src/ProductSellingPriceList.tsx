import React, { useState, useEffect } from 'react';
import {
  collection,
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
} from 'firebase/firestore';
import Select from 'react-select';

import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import { useAppContext } from './AppContext';
import firebaseError from './firebaseError';
import ShopProductEdit from './ShopProductEdit';
import { ProductSellingPrice } from './types';
import { toDateString, nameWithCode } from './tools';

const db = getFirestore();

const ProductSellingPriceList: React.FC = () => {
  const [search, setSearch] = useState({ text: '', shopCode: '' });
  const [snapshot, setSnapshot] = useState<QuerySnapshot<ProductSellingPrice> | null>(null);
  const [open, setOpen] = useState(false);
  const [targetProductCode, setTargetProductCode] = useState<string | null>(null);
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string>('');
  const { shops, currentShop, role, registListner } = useAppContext();

  useEffect(() => {
    if (currentShop) {
      const options = [{ label: currentShop.name, value: currentShop.code }];
      setShopOptions(options);
      setSearch((prev) => ({ ...prev, shopCode: currentShop.code }));
    }
  }, [currentShop]);

  useEffect(() => {
    if (role === 'manager' && shops.size > 0) {
      const options = Array.from(shops.entries()).map(([code, shop]) => ({
        value: code,
        label: nameWithCode(shop),
      }));
      setShopOptions(options);
    }
  }, [shops, currentShop]);

  const queryResults = async () => {
    try {
      setError('');
      const searchText = search.text.trim();
      const conds: QueryConstraint[] = [];
      if (searchText) {
        if (searchText) {
          if (searchText.match(/^\d+$/)) {
            conds.push(orderBy('code'));
          } else {
            conds.push(orderBy('name'));
          }
          conds.push(startAt(searchText));
          conds.push(endAt(searchText + '\uf8ff'));
        }
      }
      const q = query(collection(db, 'shops', search.shopCode, 'productSellingPrices'), ...conds);
      const querySnapshot = await getDocs(q);
      setSnapshot(querySnapshot as QuerySnapshot<ProductSellingPrice>);
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  const newProductSellingPrice = (shopCode: string) => () => {
    if (shopCode) {
      setOpen(true);
      setTargetProductCode(null);
    }
  };

  const editProductSellingPrice = (productCode: string) => () => {
    setOpen(true);
    setTargetProductCode(productCode);
  };

  const deleteProductSellingPrice = (path: string) => async () => {
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
      {open && (
        <ShopProductEdit
          open={open}
          mode="sellingPrice"
          shopCode={search.shopCode}
          productCode={targetProductCode}
          onClose={() => setOpen(false)}
          onUpdate={queryResults}
        />
      )}
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">店舗売価マスタ</h1>
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
              onMenuOpen={() => {
                if (role === 'manager') {
                  registListner('shops');
                }
              }}
            />
            <Button variant="outlined" onClick={queryResults} className="mr-2">
              検索
            </Button>
            <Button variant="outlined" className="mr-2" onClick={newProductSellingPrice(search.shopCode)}>
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
                <Table.Cell type="th">売価</Table.Cell>
                <Table.Cell type="th">更新日</Table.Cell>
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
                      <Table.Cell className="text-right">{item.sellingPrice?.toLocaleString()}</Table.Cell>
                      <Table.Cell>
                        {item.updatedAt ? toDateString(item.updatedAt.toDate(), 'YYYY-MM-DD') : ''}
                      </Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300 "
                          onClick={editProductSellingPrice(item.productCode)}
                        >
                          <Icon name="pencil-alt" />
                        </Button>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={deleteProductSellingPrice(path)}
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

export default ProductSellingPriceList;
