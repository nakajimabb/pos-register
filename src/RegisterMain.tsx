import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getFirestore, doc, getDoc, collection, onSnapshot } from 'firebase/firestore';

import { Button, Card, Flex, Form, Grid, Icon, Table } from './components';
import { Brand } from './components/type';
import RegisterPayment from './RegisterPayment';
import RegisterInput from './RegisterInput';
import RegisterModify from './RegisterModify';
import RegisterSearch from './RegisterSearch';
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
  const [openSearch, setOpenSearch] = useState<boolean>(false);
  const [registerMode, setRegisterMode] = useState<'Sales' | 'Return'>('Sales');
  const [paymentType, setPaymentType] = useState<'Cash' | 'Credit'>('Cash');

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

  const calcTotal = (items: BasketItem[]) => {
    return (
      items.reduce((result, item) => result + Number(item.product.sellingPrice) * item.quantity, 0) + calcTax(items)
    );
  };

  const calcTax = (items: BasketItem[]) => {
    let normalTaxTotal = 0;
    let reducedTaxTotal = 0;
    items.forEach((item) => {
      if (item.product.sellingTax === 10) {
        normalTaxTotal += Number(item.product.sellingPrice) * item.quantity;
      } else if (item.product.sellingTax === 8) {
        reducedTaxTotal += Number(item.product.sellingPrice) * item.quantity;
      }
    });
    return Math.floor(normalTaxTotal * 0.1 + reducedTaxTotal * 0.08);
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
      await Promise.all(
        shortcutItemArray.map(async (item) => {
          if (item.productRef) {
            const productSnap = await getDoc(item.productRef);
            if (productSnap.exists()) {
              const product = productSnap.data() as Product;
              shortcutArray[item.index] = { index: item.index, color: item.color, product };
            }
          }
        })
      );
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
        paymentType={paymentType}
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
      <RegisterSearch
        open={openSearch}
        basketItems={basketItems}
        setBasketItems={setBasketItems}
        onClose={() => {
          setOpenSearch(false);
          document.getElementById('productCode')?.focus();
        }}
      ></RegisterSearch>
      <Grid cols="2" rows="1" gap="0" flow="col" className="h-full">
        <Card className="container justify-center m-2">
          <Card.Body>
            <Flex>
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
              <Button color="light" size="xs" className="mt-16 ml-4" onClick={() => setOpenSearch(true)}>
                商品検索
              </Button>
              <Button
                variant={registerMode === 'Sales' ? 'contained' : 'outlined'}
                color={registerMode === 'Sales' ? 'info' : 'light'}
                size="xs"
                className="w-16 mt-16 ml-16"
                onClick={() => setRegisterMode('Sales')}
              >
                売上
              </Button>
              <Button
                variant={registerMode === 'Return' ? 'contained' : 'outlined'}
                color={registerMode === 'Return' ? 'info' : 'light'}
                size="xs"
                className="w-16 mt-16"
                onClick={() => setRegisterMode('Return')}
              >
                返品
              </Button>
            </Flex>

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
                      <Table.Cell className="text-right">
                        ¥{basketItem.product.sellingPrice?.toLocaleString()}
                      </Table.Cell>
                      <Table.Cell className="text-right">{basketItem.quantity}</Table.Cell>
                      <Table.Cell className="text-center">
                        {basketItem.product.code ? (
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
                        ) : null}
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

            <Flex className="mt-4">
              <Table border="row" className="table-fixed w-3/5">
                <Table.Body>
                  <Table.Row>
                    <Table.Cell type="th" className="text-xl bg-red-100">
                      合計
                    </Table.Cell>
                    <Table.Cell className="text-right text-xl pr-4">
                      ¥{calcTotal(basketItems).toLocaleString()}
                    </Table.Cell>
                  </Table.Row>
                  <Table.Row>
                    <Table.Cell type="th" className="bg-red-100">
                      消費税
                    </Table.Cell>
                    <Table.Cell className="text-right pr-4">¥{calcTax(basketItems).toLocaleString()}</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table>
              <div className="mt-1 ml-4">
                <Grid cols="2" gap="2">
                  <Button
                    color="info"
                    size="xs"
                    disabled={basketItems.length === 0}
                    className="h-20"
                    onClick={() => {
                      setPaymentType('Cash');
                      setOpenPayment(true);
                    }}
                  >
                    現金会計
                  </Button>
                  <Button
                    color="info"
                    size="xs"
                    disabled={basketItems.length === 0}
                    className="h-20"
                    onClick={() => {
                      setPaymentType('Credit');
                      setOpenPayment(true);
                    }}
                  >
                    クレジット会計
                  </Button>
                </Grid>
              </div>
            </Flex>
          </Card.Body>
        </Card>
        {registerItems.length > 0 && shortcuts.length > 0 && (
          <Card className="m-2">
            <Card.Body>
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
                  <div>
                    <Link to="/receipt_list">
                      <Button color="light" size="xs" disabled={basketItems.length > 0} className="w-full">
                        レシート再発行
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
                      disabled={!shortcut}
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
                      {shortcut ? `¥${Number(shortcut.product.sellingPrice).toLocaleString()}` : null}
                    </Button>
                  ))}
                </Grid>
              </div>
            </Card.Body>
          </Card>
        )}
      </Grid>
    </Flex>
  );
};
export default RegisterMain;
