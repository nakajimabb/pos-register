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
} from 'firebase/firestore';
import Select from 'react-select';

import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import firebaseError from './firebaseError';
import { useAppContext } from './AppContext';
import ShopProductEdit from './ShopProductEdit';
import { ProductCostPrice, ProductSellingPrice, Stock } from './types';
import { toDateString, nameWithCode } from './tools';

const db = getFirestore();
type ShopProduct = {
  productName: string;
  productCostPrices?: ProductCostPrice[];
  productSellingPrice?: ProductSellingPrice;
  stock?: Stock;
};

const ProductCostPriceList: React.FC = () => {
  const [search, setSearch] = useState({ text: '', shopCode: '' });
  const [snapshot, setSnapshot] = useState<QuerySnapshot<ProductCostPrice> | null>(null);
  const [shopProducts, setShopProducts] = useState<Map<string, ShopProduct>>(new Map());
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
      // const searchText = search.text.trim();
      // const conds: QueryConstraint[] = [];
      // if (searchText) {
      //   if (searchText) {
      //     if (searchText.match(/^\d+$/)) {
      //       conds.push(orderBy('productCode'));
      //     } else {
      //       conds.push(orderBy('productName'));
      //     }
      //     conds.push(startAt(searchText));
      //     conds.push(endAt(searchText + '\uf8ff'));
      //   }
      // }
      // const q = query(collection(db, 'shops', search.shopCode, 'productCostPrices'), ...conds);
      // const querySnapshot = await getDocs(q);
      // setSnapshot(querySnapshot as QuerySnapshot<ProductCostPrice>);
      const items: Map<string, ShopProduct> = new Map();
      // 店舗原価
      {
        const ref = collection(db, 'shops', search.shopCode, 'productCostPrices');
        const qsnap = (await getDocs(ref)) as QuerySnapshot<ProductCostPrice>;
        qsnap.forEach((dsnap) => {
          const data = dsnap.data();
          const item = items.get(data.productCode);
          const value = item ?? { productName: data.productName };
          const costPrices = value?.productCostPrices || [];
          items.set(data.productCode, { ...value, productCostPrices: [...costPrices, data] });
        });
      }
      // 店舗売価・在庫
      for (const name of ['productSellingPrice', 'stock']) {
        const ref = collection(db, 'shops', search.shopCode, name + 's');
        const qsnap = await getDocs(ref);
        qsnap.forEach((dsnap) => {
          const data = dsnap.data();
          const item = items.get(data.productCode);
          const value = item ?? { productName: data.productName };
          items.set(data.productCode, { ...value, [name]: data });
        });
      }
      setShopProducts(items);
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  const newProductCostPrice = (shopCode: string) => () => {
    if (shopCode) {
      setOpen(true);
      setTargetProductCode(null);
    }
  };

  const editProductCostPrice = (productCode: string) => () => {
    setOpen(true);
    setTargetProductCode(productCode);
  };

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const sortedProductCodes = () => Array.from(shopProducts.keys()).sort();

  return (
    <div className="pt-12">
      {open && (
        <ShopProductEdit
          open={open}
          shopCode={search.shopCode}
          productCode={targetProductCode}
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
              onMenuOpen={() => {
                if (role === 'manager') {
                  registListner('shops');
                }
              }}
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
                <Table.Cell type="th">在庫</Table.Cell>
                <Table.Cell type="th">店舗売価</Table.Cell>
                <Table.Cell type="th">店舗原価</Table.Cell>
                <Table.Cell type="th">仕入先</Table.Cell>
                <Table.Cell type="th"></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {sortedProductCodes().map((productCode, i) => {
                const item = shopProducts.get(productCode);
                const productName = item?.productName;
                const stock = item?.stock;
                const sellingPrice = item?.productSellingPrice;
                const costPrices = (item?.productCostPrices ?? [{ costPrice: undefined, supplierName: undefined }]) as {
                  costPrice?: number;
                  supplierName?: string;
                }[];
                const rowSpan = costPrices.length;

                return costPrices.map((item, j) => (
                  <Table.Row key={i}>
                    {j === 0 && (
                      <>
                        <Table.Cell rowSpan={rowSpan}>{productCode}</Table.Cell>
                        <Table.Cell rowSpan={rowSpan}>{productName}</Table.Cell>
                        <Table.Cell rowSpan={rowSpan} className="text-right">
                          {stock?.quantity ?? 0}
                        </Table.Cell>
                        <Table.Cell rowSpan={rowSpan} className="text-right">
                          {sellingPrice?.sellingPrice ?? ''}
                        </Table.Cell>
                      </>
                    )}
                    <Table.Cell>{item.costPrice}</Table.Cell>
                    <Table.Cell>{item.supplierName}</Table.Cell>
                    {j === 0 && (
                      <Table.Cell rowSpan={rowSpan}>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300 "
                          onClick={editProductCostPrice(productCode)}
                        >
                          <Icon name="pencil-alt" />
                        </Button>
                      </Table.Cell>
                    )}
                  </Table.Row>
                ));
              })}
            </Table.Body>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default ProductCostPriceList;
