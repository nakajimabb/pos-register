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
  onSnapshot,
} from 'firebase/firestore';
import Select from 'react-select';

import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import firebaseError from './firebaseError';
import ProductSellingPriceEdit from './ProductSellingPriceEdit';
import { ProductSellingPrice, Shop } from './types';
import { nameWithCode } from './tools';

const db = getFirestore();

const ProductSellingPriceList: React.FC = () => {
  const [search, setSearch] = useState({ text: '', shopCode: '' });
  const [snapshot, setSnapshot] = useState<QuerySnapshot<ProductSellingPrice> | null>(null);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<{ shopCode: string | null; productCode: string | null }>({
    shopCode: null,
    productCode: null,
  });
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string>('');

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
      setTarget({ shopCode, productCode: null });
    }
  };

  const editProductSellingPrice = (shopCode: string, productCode: string) => () => {
    setOpen(true);
    setTarget({ shopCode, productCode });
  };

  const deleteProductSellingPrice = (shopCode: string, productCode: string) => async () => {
    if (window.confirm('削除してもよろしいですか？')) {
      try {
        if (shopCode && productCode) {
          await deleteDoc(doc(db, 'shops', shopCode, 'productSellingPrices', productCode));
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
      {target.shopCode && (
        <ProductSellingPriceEdit
          open={open}
          shopCode={target.shopCode}
          productCode={target.productCode}
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
                <Table.Cell type="th"></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {snapshot &&
                snapshot.docs.map((doc, i) => {
                  const item = doc.data();
                  const ref = doc.ref;
                  const id = ref.id; // productCode
                  const shopId = String(ref.parent.parent?.id); // shopCode

                  return (
                    <Table.Row key={i}>
                      <Table.Cell>{item.productCode}</Table.Cell>
                      <Table.Cell>{item.productName}</Table.Cell>
                      <Table.Cell className="text-right">{item.sellingPrice?.toLocaleString()}</Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300 "
                          onClick={editProductSellingPrice(shopId, id)}
                        >
                          <Icon name="pencil-alt" />
                        </Button>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={deleteProductSellingPrice(shopId, id)}
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
