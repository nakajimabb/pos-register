import React, { useState, useEffect } from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';
import { Alert, Button, Card, Flex, Form, Grid, Icon, Table } from './components';
import firebaseError from './firebaseError';
import { ProductBundle, Product, TaxClass } from './types';
import { toNumber, toAscii } from './tools';
import RegisterSearch from './RegisterSearch';

const db = getFirestore();

const TAX_CLASS_OPTIONS = [
  { value: '', label: '' },
  { value: 'exclusive', label: '外税' },
  { value: 'inclusive', label: '内税' },
  { value: 'free', label: '非課税' },
];

const TAX_OPTIONS = [
  { value: '', label: '' },
  { value: '8', label: '8%' },
  { value: '10', label: '10%' },
];

interface Props extends RouteComponentProps<{ id: string }> {
  open: boolean;
  docId: string | null;
  onClose: () => void;
  onUpdate: (productBundle: ProductBundle) => void;
}

const ProductBundleEdit: React.FC<Props> = (props: Props) => {
  const [productBundle, setProductBundle] = useState<ProductBundle>({
    code: '',
    name: '',
    sellingTaxClass: null,
    sellingTax: null,
    quantity: 0,
    discount: 0,
    productCodes: [],
  });
  const [quantityText, setQuantityText] = useState<string>('0');
  const [discountText, setDiscountText] = useState<string>('0');
  const [productCode, setProductCode] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [openSearch, setOpenSearch] = useState<boolean>(false);
  const [error, setError] = useState('');
  const docId = props.match.params.id;

  useEffect(() => {
    const f = async () => {
      if (docId) {
        const ref = doc(db, 'productBundles', docId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const bundle = snap.data() as ProductBundle;
          setProductBundle(bundle);
          setQuantityText(bundle.quantity.toString());
          setDiscountText(bundle.discount.toString());
          const productsData: Product[] = [];
          await Promise.all(
            bundle.productCodes.map(async (productCode) => {
              const productSnapshot = await getDoc(doc(db, 'products', productCode));
              productsData.push(productSnapshot.data() as Product);
            })
          );
          setProducts(productsData);
        } else {
          resetProductBundle();
        }
      } else {
        resetProductBundle();
      }
      setError('');
    };
    f();
  }, [docId]);

  const resetProductBundle = () => {
    setProductBundle({
      code: '',
      name: '',
      sellingTaxClass: null,
      sellingTax: null,
      quantity: 0,
      discount: 0,
      productCodes: [],
    });
    setQuantityText('0');
    setDiscountText('0');
  };

  const findProduct = async (code: string) => {
    try {
      const docRef = doc(db, 'products', code);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProducts([...products, docSnap.data() as Product]);
      } else {
        console.log('no such product');
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productCode) {
      findProduct(toAscii(productCode));
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      productBundle.productCodes = products.map((product) => product.code);
      productBundle.quantity = toNumber(quantityText);
      productBundle.discount = toNumber(discountText);
      if (docId) {
        await setDoc(doc(db, 'productBundles', docId), productBundle);
      } else {
        const ref = doc(db, 'productBundles', productBundle.code);
        const snap = await getDoc(ref);
        if (snap.exists()) throw Error('コードが既に存在します。');
        await setDoc(doc(db, 'productBundles', productBundle.code), productBundle);
      }
      window.location.href = '/product_bundle_list';
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  return (
    <Flex direction="col" justify_content="center" align_items="center" className="h-screen">
      <RegisterSearch
        open={openSearch}
        setProductCode={setProductCode}
        findProduct={findProduct}
        onClose={() => {
          setOpenSearch(false);
          document.getElementById('productCode')?.focus();
        }}
      ></RegisterSearch>
      <Card className="mt-16 mb-2 w-1/2 h-full">
        <Card.Body>
          <div>
            {error && (
              <Alert severity="error" className="my-4">
                {error}
              </Alert>
            )}
            <Grid cols="2" gap="3" className="p-3">
              <Form.Label>コード</Form.Label>
              <Form.Text
                placeholder="コード"
                disabled={!!docId}
                required
                value={docId ? docId : productBundle.code}
                onChange={(e) => setProductBundle({ ...productBundle, code: e.target.value })}
              />
              <Form.Label>名称</Form.Label>
              <Form.Text
                placeholder="名称"
                value={productBundle.name}
                onChange={(e) => setProductBundle({ ...productBundle, name: e.target.value })}
              />
              <Form.Label>税区分</Form.Label>
              <Form.Select
                className="mb-3 sm:mb-0"
                value={String(productBundle.sellingTaxClass)}
                options={TAX_CLASS_OPTIONS}
                onChange={(e) => setProductBundle({ ...productBundle, sellingTaxClass: e.target.value as TaxClass })}
              />
              <Form.Label>消費税</Form.Label>
              <Form.Select
                className="mb-3 sm:mb-0"
                value={String(productBundle.sellingTax)}
                options={TAX_OPTIONS}
                onChange={(e) =>
                  setProductBundle({ ...productBundle, sellingTax: e.target.value ? +e.target.value : null })
                }
              />
              <Form.Label>成立数量</Form.Label>
              <Form.Text
                value={quantityText}
                onChange={(e) => setQuantityText(e.target.value)}
                onBlur={() => setQuantityText(toNumber(quantityText).toString())}
                className="text-right"
              />
              <Form.Label>値引き</Form.Label>
              <Form.Text
                value={discountText}
                onChange={(e) => setDiscountText(e.target.value)}
                onBlur={() => setDiscountText(toNumber(discountText).toString())}
                className="text-right"
              />
              <Form.Label>対象商品</Form.Label>
              <Flex>
                <Form onSubmit={handleSubmit}>
                  <Form.Text
                    id="productCode"
                    size="md"
                    placeholder="商品コード"
                    className="mb-3 sm:mb-0"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value.trim())}
                  />
                </Form>
                <Button color="light" size="xs" className="ml-4" onClick={() => setOpenSearch(true)}>
                  商品検索
                </Button>
              </Flex>
            </Grid>

            <Table border="row" className="table-fixed w-full text-xs">
              <Table.Head>
                <Table.Row>
                  <Table.Cell type="th" className="w-4/12">
                    コード
                  </Table.Cell>
                  <Table.Cell type="th" className="w-4/12">
                    商品名
                  </Table.Cell>
                  <Table.Cell type="th" className="w-2/12">
                    単価
                  </Table.Cell>
                  <Table.Cell type="th" className="w-2/12" />
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {products.map((product, index) =>
                  product ? (
                    <Table.Row key={index}>
                      <Table.Cell>{product.code}</Table.Cell>
                      <Table.Cell>{product.name}</Table.Cell>
                      <Table.Cell className="text-right">¥{product.sellingPrice?.toLocaleString()}</Table.Cell>
                      <Table.Cell className="text-center">
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={(e) => {
                            if (window.confirm('削除してもよろしいですか？')) {
                              setProducts(products.filter((item) => item.code !== product.code));
                            }
                          }}
                        >
                          <Icon name="trash" />
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ) : null
                )}
              </Table.Body>
            </Table>
          </div>
          <Flex justify_content="center" align_items="center" className="m-4">
            <Link to="/product_bundle_list">
              <Button color="secondary" variant="outlined" className="ml-8 mr-3">
                キャンセル
              </Button>
            </Link>
            <Button color="primary" onClick={save}>
              保存
            </Button>
          </Flex>
        </Card.Body>
      </Card>
    </Flex>
  );
};

export default ProductBundleEdit;
