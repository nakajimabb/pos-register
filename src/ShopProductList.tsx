import React, { useState, useEffect } from 'react';
import InfiniteScroll from 'react-infinite-scroller';
import {
  collection,
  query,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  DocumentSnapshot,
  orderBy,
  startAfter,
  endAt,
  limit,
  where,
  QueryConstraint,
  QuerySnapshot,
} from 'firebase/firestore';
import Select from 'react-select';
import clsx from 'clsx';
import { Alert, Button, Card, Flex, Form, Icon, Table } from './components';
import firebaseError from './firebaseError';
import { useAppContext } from './AppContext';
import ShopProductEdit from './ShopProductEdit';
import { Product, ProductCostPrice, ProductSellingPrice, Stock } from './types';
import { nameWithCode, arrToPieces } from './tools';

const db = getFirestore();

const PER_PAGE = 20;

type ShopProduct = {
  productName: string;
  productCostPrices?: ProductCostPrice[];
  productSellingPrice?: ProductSellingPrice;
  stock?: Stock;
};

const ProductCostPriceList: React.FC = () => {
  const [search, setSearch] = useState({ text: '', shopCode: '' });
  const [shopProducts, setShopProducts] = useState<Map<string, ShopProduct>>(new Map());
  const [products, setProducts] = useState<Map<string, Product | null>>(new Map());
  const [open, setOpen] = useState(false);
  const [targetProductCode, setTargetProductCode] = useState<string | null>(null);
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string }[]>([]);
  const [error, setError] = useState<string>('');
  const [position, setPosition] = useState<{ productCode: string; completed: boolean }>({
    productCode: '',
    completed: false,
  });
  const { shops, suppliers, currentShop, role, registListner, searchProducts } = useAppContext();

  useEffect(() => {
    registListner('suppliers');
  }, []);

  useEffect(() => {
    if (currentShop) {
      const options = [{ label: nameWithCode(currentShop), value: currentShop.code }];
      setShopOptions(options);
      setSearch((prev) => ({ ...prev, shopCode: currentShop.code }));
    }
  }, [currentShop]);

  useEffect(() => {
    if (role === 'manager' && shops.size > 0) {
      const options = Array.from(shops.entries())
        .filter(([_, shop]) => !shop.hidden)
        .map(([code, shop]) => ({
          value: code,
          label: nameWithCode(shop),
        }));
      setShopOptions(options);
    }
  }, [shops, currentShop]);

  const loadMore = () => {
    if (!position.completed && !search.text) queryShopProducts(search.shopCode, [position.productCode]);
  };

  const resetItems = () => {
    setShopProducts(new Map());
    setPosition({ productCode: '', completed: false });
  };

  const searchShopProducts = async () => {
    resetItems();
    if (search.text) {
      const pds = await searchProducts(search.text);
      const productCodes = pds.map((pd) => pd.code);
      const pieces: string[][] = arrToPieces(productCodes, 10);
      for await (const codes of pieces) {
        await queryShopProducts(search.shopCode, codes, 'get');
      }
      setPosition({ productCode: '', completed: true });
    } else {
      queryShopProducts(search.shopCode, []);
    }
  };

  const loadProducts = async (productCodes: string[]) => {
    const existCodes = Array.from(products.keys());
    const pdctCodes = productCodes.filter((code) => !existCodes.includes(code));
    const pieces: string[][] = arrToPieces(pdctCodes, 10);
    const pdcts = new Map<string, Product>();
    await Promise.all(
      pieces.map(async (codes) => {
        const conds: QueryConstraint[] = [where('code', 'in', codes)];
        const q = query(collection(db, 'products'), ...conds);
        const snap = (await getDocs(q)) as QuerySnapshot<Product>;
        snap.docs.forEach((item) => {
          const product = item.data();
          pdcts.set(product.code, product);
        });
      })
    );
    setProducts((prev) => new Map([...Array.from(prev), ...Array.from(pdcts)]));
  };

  const queryShopProducts = async (shopCode: string, productCodes: string[], mode: 'query' | 'get' = 'query') => {
    if (shopCode) {
      try {
        setError('');
        const items: Map<string, ShopProduct> = new Map();
        let startProductCode = productCodes.length > 0 ? productCodes[0] : '';
        let lastProductCode = startProductCode;
        let completed = true;

        // 店舗在庫
        {
          const conds: QueryConstraint[] = [];
          if (mode === 'query') {
            conds.push(orderBy('productCode'));
            conds.push(startAfter(startProductCode));
            conds.push(limit(PER_PAGE));
          } else {
            if (productCodes.length > 1) {
              conds.push(where('productCode', 'in', productCodes));
            } else {
              conds.push(where('productCode', '==', startProductCode));
            }
          }
          const ref = query(collection(db, 'shops', shopCode, 'stocks'), ...conds);
          const qsnap = (await getDocs(ref)) as QuerySnapshot<Stock>;
          qsnap.forEach((dsnap) => {
            const data = dsnap.data();
            const item = items.get(data.productCode);
            const value = item ?? { productName: data.productName };
            items.set(data.productCode, { ...value, stock: data });
          });
          if (qsnap.size > 0) {
            lastProductCode = qsnap.docs.slice(-1)[0].data().productCode;
            completed = false;
          }
        }
        const conds: QueryConstraint[] = [];
        if (mode === 'query') {
          conds.push(orderBy('productCode'));
          conds.push(orderBy('updatedAt', 'desc'));
          conds.push(startAfter(startProductCode));
          if (startProductCode !== lastProductCode) conds.push(endAt(lastProductCode));
        } else {
          conds.push(orderBy('updatedAt', 'desc'));
          if (productCodes.length > 1) {
            conds.push(where('productCode', 'in', productCodes));
          } else {
            conds.push(where('productCode', '==', startProductCode));
          }
        }
        // 店舗売価
        {
          const ref = query(collection(db, 'shops', shopCode, 'productSellingPrices'), ...conds);
          const qsnap = (await getDocs(ref)) as QuerySnapshot<ProductSellingPrice>;
          qsnap.forEach((dsnap) => {
            const data = dsnap.data();
            const item = items.get(data.productCode);
            const value = item ?? { productName: data.productName };
            items.set(data.productCode, { ...value, productSellingPrice: data });
          });
          if (qsnap.size > 0) {
            completed = false;
          }
        }
        // 店舗原価
        {
          const ref = query(collection(db, 'shops', shopCode, 'productCostPrices'), ...conds);
          const qsnap = (await getDocs(ref)) as QuerySnapshot<ProductCostPrice>;
          qsnap.forEach((dsnap) => {
            const data = dsnap.data();
            const item = items.get(data.productCode);
            const value = item ?? { productName: data.productName };
            const costPrices = value?.productCostPrices || [];
            items.set(data.productCode, { ...value, productCostPrices: [...costPrices, data] });
          });
          if (qsnap.size > 0) {
            completed = false;
          }
        }
        if (mode === 'query') {
          setPosition({ productCode: lastProductCode, completed });
        }
        setShopProducts((prev) => new Map([...Array.from(prev.entries()), ...Array.from(items.entries())]));
        const pdctCodes = [...Array.from(shopProducts.keys()), ...Array.from(items.keys())];
        await loadProducts(pdctCodes);
      } catch (error) {
        setPosition((prev) => ({ ...prev, completed: true }));
        console.log({ error });
        setError(firebaseError(error));
      }
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

  const sortedProductCodes = () =>
    Array.from(shopProducts.entries())
      .sort((a, b) => {
        if (a[0] < b[0]) return -1;
        else if (a[0] > b[0]) return 1;
        else return 0;
      })
      .map((entry) => entry[0]);

  const getPrice = (productCode: string, price: number | null, priceType: 'sellingPrice' | 'costPrice') => {
    if (price !== null) {
      return { isShop: true, price };
    } else {
      const product = products.get(productCode);
      const pdctPrice = product ? product[priceType] : null;
      return { isShop: false, price: pdctPrice };
    }
  };

  const getSupplierName = (productCode: string, supplierName: string) => {
    if (supplierName) {
      return { isShop: true, supplierName };
    } else {
      const product = products.get(productCode);
      if (product && product.supplierRef) {
        const supplierCode = product.supplierRef.id;
        return { isShop: false, supplierName: suppliers.get(supplierCode)?.name ?? '' };
      } else {
        return { isShop: false, supplierName: '' };
      }
    }
  };

  return (
    <InfiniteScroll className="pt-12" id="top" hasMore={true} loadMore={loadMore}>
      {open && (
        <ShopProductEdit
          open={open}
          shopCode={search.shopCode}
          productCode={targetProductCode}
          onClose={() => setOpen(false)}
          onUpdate={(productCode) => queryShopProducts(search.shopCode, [productCode], 'get')}
        />
      )}
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">店舗商品マスタ</h1>
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
            <Button variant="outlined" onClick={searchShopProducts} className="mr-2">
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
                <Table.Cell type="th">
                  <small>店舗売価(税抜)</small>
                </Table.Cell>
                <Table.Cell type="th">
                  <small>店舗原価(税抜)</small>
                </Table.Cell>
                <Table.Cell type="th">仕入先</Table.Cell>
                <Table.Cell type="th"></Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {sortedProductCodes().map((productCode, i) => {
                const item = shopProducts.get(productCode);
                const productName = item?.productName;
                const stock = item?.stock;
                const { isShop, price: sellingPrice } = getPrice(
                  productCode,
                  item?.productSellingPrice?.sellingPrice ?? null,
                  'sellingPrice'
                );
                const costPrices = (item?.productCostPrices ?? [{ costPrice: undefined, supplierName: undefined }]) as {
                  costPrice?: number;
                  supplierName?: string;
                }[];
                const rowSpan = costPrices.length;

                return costPrices.map((item, j) => {
                  const { isShop: isShop2, price: costPrice } = getPrice(
                    productCode,
                    item.costPrice ?? null,
                    'costPrice'
                  );
                  const { isShop: isShop3, supplierName } = getSupplierName(productCode, item.supplierName ?? '');

                  return (
                    <Table.Row key={100 * i + j}>
                      {j === 0 && (
                        <>
                          <Table.Cell rowSpan={rowSpan}>{productCode}</Table.Cell>
                          <Table.Cell rowSpan={rowSpan}>{productName}</Table.Cell>
                          <Table.Cell rowSpan={rowSpan} className="text-right">
                            {stock?.quantity ?? 0}
                          </Table.Cell>
                          <Table.Cell rowSpan={rowSpan} className={clsx('text-right', isShop && 'text-red-700')}>
                            {sellingPrice?.toLocaleString() ?? ''}
                          </Table.Cell>
                        </>
                      )}
                      <Table.Cell className={clsx('text-right', isShop2 && 'text-red-700')}>
                        {costPrice?.toLocaleString() ?? ''}
                      </Table.Cell>
                      <Table.Cell className={clsx('text-right', isShop3 && 'text-red-700')}>{supplierName}</Table.Cell>
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
                  );
                });
              })}
            </Table.Body>
          </Table>
        </Card.Body>
      </Card>
    </InfiniteScroll>
  );
};

export default ProductCostPriceList;
