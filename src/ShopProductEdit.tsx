import React, { useState, useEffect } from 'react';
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  getFirestore,
  limit,
  orderBy,
  startAt,
  endAt,
  QueryConstraint,
  query,
  Query,
  where,
  DocumentSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import Select, { SingleValue } from 'react-select';
import AsyncSelect from 'react-select/async';

import { Alert, Button, Flex, Form, Grid, Modal } from './components';
import { useAppContext } from './AppContext';
import firebaseError from './firebaseError';
import {
  Product,
  ProductSellingPrice,
  ProductCostPrice,
  productSellingPricePath,
  productCostPricePath,
  productCostPricesPath,
} from './types';
import { isNum, nameWithCode } from './tools';

const db = getFirestore();

type Props = {
  open: boolean;
  shopCode: string;
  productCode: string | null;
  onClose: () => void;
  onUpdate: (productCode: string) => void;
};

const ShopProductEdit: React.FC<Props> = ({ open, shopCode, productCode, onClose, onUpdate }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [productSellingPrice, setProductSellingPrice] = useState<ProductSellingPrice | null>(null);
  const [productCostPrices, setProductCostPrices] = useState<Map<string, ProductCostPrice>>(new Map());
  const [inputSellingPrice, setInputSellingPrice] = useState<number | null>(null); // 入力値
  const [InputCostPrices, setInputCostPrices] = useState<{ supplierCode: string; costPrice: number | null }[]>([]); // 入力値
  const [error, setError] = useState('');
  const [supplierOptions, setSuppliersOptions] = useState<{ label: string; value: string }[]>([]);
  const { registListner, suppliers } = useAppContext();

  useEffect(() => {
    if (open) registListner('suppliers');
  }, [open]);

  useEffect(() => {
    const options = Array.from(suppliers.entries()).map(([code, supplier]) => ({
      value: code,
      label: nameWithCode(supplier),
    }));
    options.unshift({ label: '', value: '' });
    setSuppliersOptions(options);
  }, [suppliers]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const setSupplier = (index: number) => (e: SingleValue<{ label: string; value: string }>) => {
    const supplierCode = e?.value || '';
    if (supplierCode) {
      setInputCostPrices((prev) => {
        const values = [...prev];
        values[index].supplierCode = supplierCode;
        return values;
      });
    }
  };

  const setProductCode = async (e: SingleValue<{ label: string; value: string }>) => {
    const code = String(e?.value);
    await loadProduct(shopCode, code);
  };

  const resetData = () => {
    setProduct(null);
    setProductSellingPrice(null);
    setProductCostPrices(new Map());
    setInputSellingPrice(null);
    setInputCostPrices([]);
  };

  const loadProduct = async (shopCode: string, productCode: string | null) => {
    try {
      resetData();
      if (productCode) {
        const snapPdct = (await getDoc(doc(db, 'products', productCode))) as DocumentSnapshot<Product>;
        const pdct = snapPdct.data();
        if (!pdct) throw Error('商品マスタ(共通)が存在しません。');
        setProduct(pdct);
        const snapsp = (await getDoc(
          doc(db, productSellingPricePath(shopCode, productCode))
        )) as DocumentSnapshot<ProductSellingPrice>;
        const pdctSellingPrice = snapsp.data();
        if (pdctSellingPrice) {
          setProductSellingPrice(pdctSellingPrice);
          setInputSellingPrice(pdctSellingPrice.sellingPrice);
        }
        const cond: QueryConstraint = where('productCode', '==', productCode);
        const q = query(collection(db, productCostPricesPath(shopCode)), cond) as Query<ProductCostPrice>;
        const qsnap = await getDocs(q);
        setInputCostPrices(
          qsnap.docs.map((qdsnap) => {
            const item = qdsnap.data();
            return { supplierCode: item.supplierCode, costPrice: item.costPrice };
          })
        );
        const prices = new Map<string, ProductCostPrice>();
        qsnap.docs.forEach((qdsnap) => {
          const costPrice = qdsnap.data();
          prices.set(costPrice.supplierCode, costPrice);
        });
        setProductCostPrices(prices);
      }
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  const loadProductOptions = async (inputText: string) => {
    if (inputText) {
      const conds: QueryConstraint[] = [];
      if (inputText.match(/^\d+$/)) {
        conds.push(orderBy('code'));
      } else {
        conds.push(orderBy('name'));
      }
      conds.push(startAt(inputText));
      conds.push(endAt(inputText + '\uf8ff'));
      conds.push(limit(20));
      const q = query(collection(db, 'products'), ...conds);
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((item) => {
        const product = item.data() as Product;
        return { label: nameWithCode(product), value: item.id };
      });
    } else {
      return [];
    }
  };

  useEffect(() => {
    loadProduct(shopCode, productCode);
  }, [shopCode, productCode]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (shopCode && product && product.code) {
      try {
        if (inputSellingPrice !== null && inputSellingPrice <= 0) {
          throw Error('売価は0より大きな値に設定してください。');
        }
        InputCostPrices.forEach((costPrice) => {
          if (!costPrice.supplierCode) {
            throw Error('仕入先が指定されていません。');
          }
        });
        for await (const costPrice of InputCostPrices) {
          const productCostPrice = productCostPrices.get(costPrice.supplierCode);
          if (!productCostPrice || productCostPrice.costPrice !== costPrice.costPrice) {
            const supplierCode = costPrice.supplierCode;
            const supplierName = suppliers.get(supplierCode)?.name ?? '';
            const path = productCostPricePath(shopCode, product.code, supplierCode);
            await setDoc(
              doc(db, path),
              {
                shopCode,
                productCode: product.code,
                productName: product.name,
                supplierCode,
                supplierName,
                costPrice: costPrice.costPrice,
                updatedAt: serverTimestamp(),
                // purchasedAt 仕入日
              },
              { merge: true }
            );
          }
        }
        if (!productSellingPrice || productSellingPrice.sellingPrice !== inputSellingPrice) {
          const path = productSellingPricePath(shopCode, product.code);
          await setDoc(
            doc(db, path),
            {
              shopCode,
              productCode: product.code,
              productName: product.name,
              sellingPrice: inputSellingPrice,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
        onUpdate(product.code);
        onClose();
      } catch (error) {
        console.log({ error });
        setError(firebaseError(error));
      }
    }
  };

  const addCostPrice = () => {
    if (product) {
      setInputCostPrices((prev) => [...prev, { supplierCode: '', costPrice: product.costPrice }]);
    }
  };

  const addSellingPrice = () => {
    if (product) {
      setInputSellingPrice(product.sellingPrice);
    }
  };

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-2/3 overflow-visible">
      <Form onSubmit={save} className="space-y-2">
        <Modal.Header centered={false} onClose={onClose}>
          商品編集
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert severity="error" className="my-4">
              {error}
            </Alert>
          )}
          <Grid cols="1 sm:2" gap="0 sm:3" auto_cols="fr" template_cols="1fr 2fr" className="row-end-2">
            <Form.Label>商品名称</Form.Label>
            <AsyncSelect
              className="mb-3 sm:mb-0"
              value={{ label: product?.name ?? '', value: product?.code ?? '' }}
              isDisabled={!!productCode}
              loadOptions={loadProductOptions}
              onChange={setProductCode}
            />
            <Form.Label>商品コード</Form.Label>
            <Form.Number placeholder="商品コード" disabled value={product?.code ?? ''} />
            <Form.Label>売価共通(税抜)</Form.Label>
            <Form.Number placeholder="売価共通(税抜)" disabled value={String(product?.sellingPrice ?? '')} />
            <Form.Label>原価共通(税抜)</Form.Label>
            <Form.Number placeholder="原価共通(税抜)" disabled value={String(product?.costPrice ?? '')} />
            <Form.Label></Form.Label>
            <Flex className="space-x-2">
              <Form.Checkbox label="非稼働" checked={product?.hidden} disabled />
              <Form.Checkbox label="返品不可" checked={product?.noReturn} disabled />
              <Form.Checkbox label="未登録" checked={product?.unregistered} disabled />
            </Flex>
          </Grid>
          <hr className="my-4" />
          <Grid cols="1 sm:2" gap="0 sm:3" auto_cols="fr" template_cols="1fr 2fr" className="row-end-2">
            {inputSellingPrice !== null && (
              <>
                <Form.Label>店舗売価(税抜)</Form.Label>
                <Form.Text
                  placeholder="店舗売価(税抜)"
                  required
                  value={String(inputSellingPrice ?? '')}
                  onChange={(e) => {
                    if (e.target.value === '' || (isNum(e.target.value) && Number(e.target.value) > 0)) {
                      setInputSellingPrice(Number(e.target.value));
                    }
                  }}
                />
              </>
            )}
            {InputCostPrices.length > 0 && <Form.Label>店舗原価(税抜)</Form.Label>}
            <div>
              {InputCostPrices.map((costPrice, index) => (
                <Flex key={index} className="space-x-2 mb-2">
                  <Select
                    value={selectValue(costPrice.supplierCode, supplierOptions)}
                    isDisabled={productCostPrices.has(costPrice.supplierCode)}
                    options={supplierOptions}
                    onChange={setSupplier(index)}
                    className="w-2/3 mb-3 sm:mb-0"
                  />
                  <Form.Text
                    placeholder="店舗原価(税抜)"
                    required
                    value={String(costPrice.costPrice ?? '')}
                    onChange={(e) => {
                      if (e.target.value === '' || (isNum(e.target.value) && Number(e.target.value) > 0)) {
                        setInputCostPrices((prev) => {
                          const values = [...prev];
                          values[index].costPrice = Number(e.target.value);
                          return values;
                        });
                      }
                    }}
                  />
                </Flex>
              ))}
            </div>
          </Grid>
        </Modal.Body>
        <Modal.Footer className="flex justify-between">
          <Flex className="space-x-2">
            {product && inputSellingPrice === null && (
              <Button type="button" color="primary" onClick={addSellingPrice}>
                売価追加
              </Button>
            )}
            {product && (
              <Button type="button" color="primary" onClick={addCostPrice}>
                原価追加
              </Button>
            )}
          </Flex>
          <Flex className="space-x-2">
            <Button type="submit" color="primary">
              保存
            </Button>
            <Button type="button" color="secondary" variant="outlined" className="mr-3" onClick={onClose}>
              Cancel
            </Button>
          </Flex>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default ShopProductEdit;
