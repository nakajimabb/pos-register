import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore, doc, getDoc, collection, onSnapshot } from 'firebase/firestore';

import { Button, Card, Flex, Form, Grid, Icon, Table } from './components';
import { Brand } from './components/type';
import RegisterPayment from './RegisterPayment';
import RegisterInput from './RegisterInput';
import RegisterModify from './RegisterModify';
import { Product, ShortcutItem } from './types';

const db = getFirestore();

const RegisterMain: React.FC = () => {
  type BasketItem = {
    product: Product;
    quantity: number;
  };

  type Shortcut = {
    index: number;
    color: String;
    product: Product;
  };

  type RegisterItem = {
    code: string;
    name: string;
  };

  const [productCode, setProductCode] = useState<string>('');
  const [basketItem, setBasketItem] = useState<BasketItem>();
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
  const [registerItem, setRegisterItem] = useState<RegisterItem>();
  const [registerItems, setRegisterItems] = useState<RegisterItem[]>([]);
  const [shortcuts, setShortcuts] = useState<(Shortcut | null)[]>([]);
  const [openPayment, setOpenPayment] = useState<boolean>(false);
  const [openInput, setOpenInput] = useState<boolean>(false);
  const [openModify, setOpenModify] = useState<boolean>(false);

  const findProduct = async (code: string) => {
    try {
      const docRef = doc(db, 'products', code);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const product = docSnap.data() as Product;
        const existingIndex = basketItems.findIndex((item) => item.product.code === code);
        if (existingIndex >= 0) {
          basketItems[existingIndex].quantity += 1;
          setBasketItems([...basketItems]);
        } else {
          const basketItem = { product, quantity: 1 };
          setBasketItems([...basketItems, basketItem]);
        }
        setProductCode('');
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
    } else {
      setOpenPayment(true);
    }
  };

  useEffect(() => {
    const unsubRegisterItems = onSnapshot(collection(db, 'registerItems'), async (snapshot) => {
      const items = new Array<RegisterItem>();
      snapshot.forEach((doc) => {
        items.push(doc.data() as RegisterItem);
      });
      setRegisterItems(items);
    });

    const unsubShortcutItems = onSnapshot(collection(db, 'shops', '05', 'shortcutItems'), async (snapshot) => {
      const shortcutArray = new Array<Shortcut | null>(20);
      const shortcutItemArray = new Array<ShortcutItem>();
      shortcutArray.fill(null);
      snapshot.forEach((doc) => {
        const item = doc.data() as ShortcutItem;
        shortcutItemArray.push(item);
      });
      for (let item of shortcutItemArray) {
        if (item.productRef) {
          const productSnap = await getDoc(item.productRef);
          if (productSnap.exists()) {
            const product = productSnap.data() as Product;
            shortcutArray[item.index] = { index: item.index, color: item.color, product };
          }
        }
      }
      setShortcuts(shortcutArray);
    });

    document.getElementById('productCode')?.focus();

    return () => {
      unsubRegisterItems();
      unsubShortcutItems();
    };
  }, []);

  return (
    <Flex direction="col" justify_content="center" align_items="center" className="h-screen">
      <RegisterPayment
        open={openPayment}
        basketItems={basketItems}
        setBasketItems={setBasketItems}
        onClose={() => {
          setOpenPayment(false);
          document.getElementById('productCode')?.focus();
        }}
      />
      <RegisterInput
        open={openInput}
        registerItem={registerItem}
        basketItems={basketItems}
        setBasketItems={setBasketItems}
        onClose={() => {
          setOpenInput(false);
          document.getElementById('productCode')?.focus();
        }}
      />
      <RegisterModify
        open={openModify}
        basketItem={basketItem}
        basketItems={basketItems}
        setBasketItems={setBasketItems}
        onClose={() => {
          setOpenModify(false);
          document.getElementById('productCode')?.focus();
        }}
      />
      <Grid cols="2" rows="1" gap="0" flow="col" className="h-full">
        <Card className="container justify-center m-2">
          <Card.Body>
            <Form className="mt-16 ml-4" onSubmit={handleSubmit}>
              <Form.Text
                id="productCode"
                size="md"
                placeholder="商品コード"
                className="mb-3 sm:mb-0"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value.trim())}
              />
            </Form>

            <div className="mt-8 h-96 overflow-y-scroll">
              <Table border="row" className="table-fixed w-full text-xs">
                <Table.Head>
                  <Table.Row>
                    <Table.Cell type="th" className="w-1/12">
                      No.
                    </Table.Cell>
                    <Table.Cell type="th" className="w-2/12">
                      コード
                    </Table.Cell>
                    <Table.Cell type="th" className="w-3/12">
                      商品名
                    </Table.Cell>
                    <Table.Cell type="th" className="w-2/12">
                      単価
                    </Table.Cell>
                    <Table.Cell type="th" className="w-2/12">
                      数量
                    </Table.Cell>
                    <Table.Cell type="th" className="w-2/12" />
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {basketItems?.map((basketItem, index) => (
                    <Table.Row key={index} className={index % 2 === 1 ? 'bg-blue-50' : ''}>
                      <Table.Cell>{index + 1}</Table.Cell>
                      <Table.Cell>{basketItem.product.code}</Table.Cell>
                      <Table.Cell className="truncate">{basketItem.product.name}</Table.Cell>
                      <Table.Cell className="text-right">¥{basketItem.product.price?.toLocaleString()}</Table.Cell>
                      <Table.Cell className="text-right">{basketItem.quantity}</Table.Cell>
                      <Table.Cell className="text-center">
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={(e) => {
                            setBasketItem(basketItem);
                            setOpenModify(true);
                          }}
                        >
                          <Icon name="pencil-alt" />
                        </Button>
                        <Button
                          variant="icon"
                          size="xs"
                          color="none"
                          className="hover:bg-gray-300"
                          onClick={(e) => {
                            setBasketItems(basketItems.filter((item) => item.product.code !== basketItem.product.code));
                          }}
                        >
                          <Icon name="trash" />
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>

            <Table border="row" className="table-fixed w-2/3 mt-8">
              <Table.Body>
                <Table.Row>
                  <Table.Cell type="th" className="text-xl bg-red-100">
                    合計
                  </Table.Cell>
                  <Table.Cell className="text-right text-xl pr-4">
                    ¥
                    {basketItems
                      .reduce((result, item) => result + Number(item.product.price) * item.quantity, 0)
                      .toLocaleString()}
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table>
          </Card.Body>
        </Card>

        <Card className="m-2">
          <div className="mt-16 p-2">
            <Grid cols="4" gap="2">
              {registerItems.map((registerItem, index) => (
                <Button
                  variant="contained"
                  size="xs"
                  color="info"
                  className="h-14"
                  onClick={(e) => {
                    setRegisterItem(registerItem);
                    setOpenInput(true);
                  }}
                  key={index}
                >
                  {`${registerItem.code}. ${registerItem.name}`}
                </Button>
              ))}
            </Grid>
          </div>

          <div className="mt-4 p-2">
            <Grid cols="4" gap="2">
              <div>
                <Link to="/shortcut_edit">
                  <Button color="light" size="xs" disabled={basketItems.length > 0} className="w-full">
                    ショートカット登録
                  </Button>
                </Link>
              </div>
            </Grid>
          </div>
          <div className="mt-4 p-2">
            <Grid cols="4" gap="2">
              {shortcuts.map((shortcut, index) => (
                <Button
                  variant={shortcut ? 'contained' : 'outlined'}
                  size="xs"
                  color={shortcut ? (shortcut.color as Brand) : 'info'}
                  className="h-14 truncate"
                  onClick={(e) => {
                    if (shortcut) {
                      const existingIndex = basketItems.findIndex(
                        (basketItem) => basketItem.product.code === shortcut.product.code
                      );
                      if (existingIndex >= 0) {
                        basketItems[existingIndex].quantity += 1;
                        setBasketItems([...basketItems]);
                      } else {
                        const basketItem = {
                          product: shortcut.product,
                          quantity: 1,
                        };
                        setBasketItems([...basketItems, basketItem]);
                      }
                    }
                  }}
                  key={index}
                >
                  {shortcut?.product.name}
                  <br />
                  {shortcut ? `¥${Number(shortcut.product.price).toLocaleString()}` : null}
                </Button>
              ))}
            </Grid>
          </div>
        </Card>
      </Grid>
    </Flex>
  );
};
export default RegisterMain;
