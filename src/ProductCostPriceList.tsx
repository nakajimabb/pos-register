import React, { useState, useEffect } from 'react';
import { truncate } from 'lodash';
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
import ProductCostPriceEdit from './ProductCostPriceEdit';
import { ProductCostPrice, Shop, Supplier } from './types';

const db = getFirestore();

const ProductCostPriceList: React.FC = () => {
  const [search, setSearch] = useState({ text: '', shopCode: '' });
  const [snapshot, setSnapshot] = useState<QuerySnapshot<ProductCostPrice> | null>(null);
  const [suppliers, setSuppliers] = useState<{ id: string; supplier: Supplier }[]>([]);
  const [open, setOpen] = useState(false);
  const [productCode, setProductCode] = useState<string | null>(null);
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
      const newSuppliers = snapshot.docs.map((item) => ({ id: item.id, supplier: item.data() as Supplier }));
      setSuppliers(newSuppliers);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'shops'), (snapshot) => {
      const options = snapshot.docs.map((item) => {
        const shop = item.data() as Shop;
        return { value: item.id, label: shop.name + '(' + shop.code + ')' };
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
      const q = query(collection(db, 'shops', search.shopCode, 'costPrices'), ...conds);
      const querySnapshot = await getDocs(q);
      setSnapshot(querySnapshot as QuerySnapshot<ProductCostPrice>);
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  const newProduct = () => {
    setOpen(true);
    setProductCode(null);
  };

  const editProduct = (code: string) => () => {
    setOpen(true);
    setProductCode(code);
  };

  const deleteCostPrice = (productCode: string) => async () => {
    if (window.confirm('削除してもよろしいですか？')) {
      try {
        if (search.shopCode) {
          await deleteDoc(doc(db, 'shops', search.shopCode, 'costPrices', productCode));
          queryResults();
        }
      } catch (error) {
        console.log({ error });
        alert(firebaseError(error));
      }
    }
  };

  const supplierName = (costPrice: ProductCostPrice) => {
    if (costPrice.supplierRef) {
      const supplier = suppliers.find((s) => s.id === costPrice.supplierRef?.id);
      return supplier?.supplier?.name;
    }
  };

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  return (
    <div className="pt-12">
      <ProductCostPriceEdit
        open={open}
        productCode={productCode}
        shopCode={search.shopCode}
        suppliers={suppliers}
        onClose={() => setOpen(false)}
        onUpdate={queryResults}
      />
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">店舗原価マスタ</h1>
      <Card className="mx-8 mb-4">
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
            <Button variant="outlined" className="mr-2" onClick={newProduct}>
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
                  return (
                    <Table.Row key={i}>
                      <Table.Cell>{item.code}</Table.Cell>
                      <Table.Cell>{item.name}</Table.Cell>
                      <Table.Cell className="text-right">{item.costPrice?.toLocaleString()}</Table.Cell>
                      <Table.Cell>{truncate(supplierName(item), { length: 10 })}</Table.Cell>
                      <Table.Cell>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300 "
                          onClick={editProduct(item.code)}
                        >
                          <Icon name="pencil-alt" />
                        </Button>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={deleteCostPrice(item.code)}
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
