import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { Button, Card, Flex, Form, Grid, Icon, Table } from './components';
import { Product } from './types';

const ShortcutEdit: React.FC = () => {
  type ShortcutItem = {
    index: number;
    product: Product;
    color: String;
  };

  const [itemIndex, setItemIndex] = useState<number | null>();
  const [productCode, setProductCode] = useState<string>('');
  const [product, setProduct] = useState<Product | null>();
  const [shortcutItems, setShortcutItems] = useState<(ShortcutItem | null)[]>(
    []
  );

  const db = getFirestore();

  const queryShortcutItems = async () => {
    const q = query(collection(db, 'shops', '05', 'shortcutItems'));
    const querySnapshot = await getDocs(q);
    const items = new Array<ShortcutItem | null>(20);
    items.fill(null);
    querySnapshot.forEach((doc) => {
      const item = doc.data() as ShortcutItem;
      items[item.index] = item;
    });
    setShortcutItems(items);
  };

  const findProduct = async (code: string) => {
    try {
      const docRef = doc(db, 'products', code);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProduct(docSnap.data() as Product);
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
      findProduct(productCode);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (itemIndex != null) {
        const item = { color: '', index: itemIndex, product };
        await setDoc(
          doc(db, 'shops', '05', 'shortcutItems', itemIndex.toString()),
          item
        );
        setItemIndex(null);
        setProductCode('');
        setProduct(null);
        queryShortcutItems();
      }
    } catch (error) {
      console.log({ error });
    }
  };

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (itemIndex != null) {
        await deleteDoc(
          doc(db, 'shops', '05', 'shortcutItems', itemIndex.toString())
        );
        setItemIndex(null);
        setProductCode('');
        setProduct(null);
        queryShortcutItems();
      }
    } catch (error) {
      console.log({ error });
    }
  };

  useEffect(() => {
    queryShortcutItems();
    document.getElementById('productCode')?.focus();
  }, [itemIndex]);

  return (
    <Flex
      direction="col"
      justify_content="center"
      align_items="center"
      className="h-screen"
    >
      <Card className="m-2 w-1/2">
        <Card.Header className="p-2">
          商品を登録する枠を選択してください。
        </Card.Header>
        <Card.Body className="p-2">
          <Grid cols="4" gap="2">
            {shortcutItems.map((item, index) => (
              <Button
                variant={item || index === itemIndex ? 'contained' : 'outlined'}
                size="xs"
                color="info"
                className="h-14 hover:bg-blue-300 truncate"
                onClick={(e) => {
                  setItemIndex(index);

                  if (item) {
                    setProductCode(item.product.code);
                    setProduct(item.product);
                  } else {
                    setProductCode('');
                    setProduct(null);
                  }
                }}
                key={index}
              >
                {item ? (
                  <>
                    {index + 1}. {item?.product.name}
                    <br />
                    {`¥${Number(item.product.price).toLocaleString()}`}
                  </>
                ) : (
                  index + 1
                )}
              </Button>
            ))}
          </Grid>
        </Card.Body>
      </Card>
      <Card className="m-2 w-1/2 h-48">
        {itemIndex != null ? (
          <Card.Body className="p-2">
            <Flex className="items-center h-12">
              <div>No. {itemIndex + 1}</div>
              {shortcutItems[itemIndex] ? null : (
                <Form className="m-2" onSubmit={handleSubmit}>
                  <Form.Text
                    id="productCode"
                    size="md"
                    placeholder="商品コード"
                    className="mb-3 sm:mb-0"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value.trim())}
                  />
                </Form>
              )}
            </Flex>
            {product ? (
              <Table border="row" className="table-fixed w-full text-xs">
                <Table.Head>
                  <Table.Row>
                    <Table.Cell type="th" className="w-8/12">
                      商品名
                    </Table.Cell>
                    <Table.Cell type="th" className="w-2/12">
                      単価
                    </Table.Cell>
                    <Table.Cell type="th" className="w-2/12" />
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  <Table.Row>
                    <Table.Cell>{product.name}</Table.Cell>
                    <Table.Cell className="text-right">
                      ¥{product.price?.toLocaleString()}
                    </Table.Cell>
                    <Table.Cell className="text-center">
                      {shortcutItems[itemIndex] ? (
                        <Button
                          variant="contained"
                          size="xs"
                          color="danger"
                          className="ml-2"
                          onClick={remove}
                        >
                          削除
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          size="xs"
                          color="primary"
                          onClick={save}
                        >
                          登録
                        </Button>
                      )}
                    </Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table>
            ) : null}
          </Card.Body>
        ) : null}
      </Card>
      <div className="mt-2 p-2">
        <Link to="/">
          <Button color="light" size="sm">
            戻る
          </Button>
        </Link>
      </div>
    </Flex>
  );
};

export default ShortcutEdit;
