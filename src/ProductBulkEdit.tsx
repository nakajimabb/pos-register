import React, { useState, useEffect } from 'react';
import { Link, RouteComponentProps } from 'react-router-dom';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';
import { Alert, Button, Card, Flex, Form, Grid } from './components';
import firebaseError from './firebaseError';
import { ProductBulk, Product } from './types';
import { toNumber } from './tools';
import RegisterSearch from './RegisterSearch';

const db = getFirestore();

interface Props extends RouteComponentProps<{ id: string }> {
  open: boolean;
  docId: string | null;
  onClose: () => void;
  onUpdate: (productBulk: ProductBulk) => void;
}

const ProductBulkEdit: React.FC<Props> = (props: Props) => {
  const [productBulk, setProductBulk] = useState<ProductBulk>({
    parentProductCode: '',
    parentProductName: '',
    childProductCode: '',
    childProductName: '',
    quantity: 0,
  });
  const [quantityText, setQuantityText] = useState<string>('0');
  const [parentProductCode, setParentProductCode] = useState<string>('');
  const [childProductCode, setChildProductCode] = useState<string>('');
  const [openParentSearch, setOpenParentSearch] = useState<boolean>(false);
  const [openChildSearch, setOpenChildSearch] = useState<boolean>(false);
  const [error, setError] = useState('');
  const docId = props.match.params.id;

  useEffect(() => {
    const f = async () => {
      if (docId) {
        const ref = doc(db, 'productBulks', docId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const bulk = snap.data() as ProductBulk;
          setProductBulk(bulk);
          setQuantityText(bulk.quantity.toString());
        } else {
          resetProductBulk();
        }
      } else {
        resetProductBulk();
      }
      setError('');
    };
    f();
  }, [docId]);

  const resetProductBulk = () => {
    setProductBulk({
      parentProductCode: '',
      parentProductName: '',
      childProductCode: '',
      childProductName: '',
      quantity: 0,
    });
    setQuantityText('0');
  };

  const findParentProduct = async (code: string) => {
    try {
      const docRef = doc(db, 'products', code);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const product = docSnap.data() as Product;
        setProductBulk({ ...productBulk, parentProductCode: product.code, parentProductName: product.name });
      } else {
        setProductBulk({ ...productBulk, parentProductCode: '', parentProductName: '' });
      }
    } catch (error) {
      console.log(error);
    }
  };

  const findChildProduct = async (code: string) => {
    try {
      const docRef = doc(db, 'products', code);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const product = docSnap.data() as Product;
        setProductBulk({ ...productBulk, childProductCode: product.code, childProductName: product.name });
      } else {
        setProductBulk({ ...productBulk, childProductCode: '', childProductName: '' });
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleSubmitParent = (e: React.FormEvent) => {
    e.preventDefault();
    if (productBulk.parentProductCode) {
      findParentProduct(productBulk.parentProductCode);
    }
  };

  const handleSubmitChild = (e: React.FormEvent) => {
    e.preventDefault();
    if (productBulk.childProductCode) {
      findChildProduct(productBulk.childProductCode);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      productBulk.quantity = toNumber(quantityText);
      if (productBulk.parentProductCode === productBulk.childProductCode) throw Error('?????????????????????????????????????????????');
      if (productBulk.quantity < 1) throw Error('?????????1??????????????????????????????????????????');
      const parentProductRef = doc(db, 'products', productBulk.parentProductCode);
      const parentProductSnap = await getDoc(parentProductRef);
      if (!parentProductSnap.exists()) throw Error('????????????????????????????????????????????????');
      const childProductRef = doc(db, 'products', productBulk.childProductCode);
      const childProductSnap = await getDoc(childProductRef);
      if (!childProductSnap.exists()) throw Error('????????????????????????????????????????????????');
      productBulk.parentProductName = parentProductSnap.data().name;
      productBulk.childProductName = childProductSnap.data().name;
      if (docId) {
        await setDoc(doc(db, 'productBulks', docId), productBulk);
      } else {
        const ref = doc(db, 'productBulks', productBulk.parentProductCode);
        const snap = await getDoc(ref);
        if (snap.exists()) throw Error('????????????????????????????????????');
        await setDoc(doc(db, 'productBulks', productBulk.parentProductCode), productBulk);
      }
      window.location.href = '/product_bulk_list';
    } catch (error) {
      console.log({ error });
      setError(firebaseError(error));
    }
  };

  return (
    <Flex direction="col" justify_content="center" align_items="center" className="h-screen">
      <RegisterSearch
        open={openParentSearch}
        setProductCode={setParentProductCode}
        findProduct={findParentProduct}
        onClose={() => {
          setOpenParentSearch(false);
        }}
      ></RegisterSearch>
      <RegisterSearch
        open={openChildSearch}
        setProductCode={setChildProductCode}
        findProduct={findChildProduct}
        onClose={() => {
          setOpenChildSearch(false);
        }}
      ></RegisterSearch>
      <Card className="mt-16 mb-2 w-1/2">
        <Card.Body>
          <div>
            {error && (
              <Alert severity="error" className="my-4">
                {error}
              </Alert>
            )}
            <Grid cols="2" gap="3" className="p-3">
              <Form.Label>????????????</Form.Label>
              <Flex>
                <Form onSubmit={handleSubmitParent}>
                  <Form.Text
                    id="productCode"
                    size="md"
                    placeholder="???????????????"
                    className="mb-3 sm:mb-0"
                    value={productBulk.parentProductCode}
                    onChange={(e) => setProductBulk({ ...productBulk, parentProductCode: e.target.value })}
                  />
                </Form>
                <Button color="light" size="xs" className="ml-4" onClick={() => setOpenParentSearch(true)}>
                  ????????????
                </Button>
              </Flex>
              <Form.Label>?????????</Form.Label>
              <Form.Text disabled={true} placeholder="?????????" value={productBulk.parentProductName} />
              <Form.Label>????????????</Form.Label>
              <Flex>
                <Form onSubmit={handleSubmitChild}>
                  <Form.Text
                    id="productCode"
                    size="md"
                    placeholder="???????????????"
                    className="mb-3 sm:mb-0"
                    value={productBulk.childProductCode}
                    onChange={(e) => setProductBulk({ ...productBulk, childProductCode: e.target.value })}
                  />
                </Form>
                <Button color="light" size="xs" className="ml-4" onClick={() => setOpenChildSearch(true)}>
                  ????????????
                </Button>
              </Flex>
              <Form.Label>?????????</Form.Label>
              <Form.Text disabled={true} placeholder="?????????" value={productBulk.childProductName} />
              <Form.Label>??????</Form.Label>
              <Form.Text
                value={quantityText}
                onChange={(e) => setQuantityText(e.target.value)}
                onBlur={() => setQuantityText(toNumber(quantityText).toString())}
                className="text-right"
              />
            </Grid>
          </div>
          <Flex justify_content="center" align_items="center" className="m-4">
            <Link to="/product_bulk_list">
              <Button color="secondary" variant="outlined" className="ml-8 mr-3">
                ???????????????
              </Button>
            </Link>
            <Button
              color="primary"
              disabled={!productBulk.parentProductCode || !productBulk.childProductCode}
              onClick={save}
            >
              ??????
            </Button>
          </Flex>
        </Card.Body>
      </Card>
    </Flex>
  );
};

export default ProductBulkEdit;
