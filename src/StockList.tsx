import React, { useState, useEffect } from 'react';
import { truncate } from 'lodash';
import { collection, getDocs, getFirestore, QuerySnapshot } from 'firebase/firestore';
import Select from 'react-select';

import { Alert, Button, Card, Flex, Table } from './components';
import firebaseError from './firebaseError';
import { useAppContext } from './AppContext';
import { Stock, stockPath } from './types';
import { nameWithCode } from './tools';

const db = getFirestore();

const StockList: React.FC = () => {
  const [shopCode, setShopCode] = useState<string | undefined>(undefined);
  const [shopOptions, setShopOptions] = useState<{ label: string; value: string }[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [error, setError] = useState<string>('');
  const { role, registListner, shops, currentShop } = useAppContext();

  useEffect(() => {
    if (currentShop) {
      const options = [{ label: currentShop.name, value: currentShop.code }];
      setShopOptions(options);
      setShopCode(currentShop.code);
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
  }, [shops]);

  const readStocks = async () => {
    if (shopCode) {
      const qSnap = (await getDocs(collection(db, stockPath(shopCode)))) as QuerySnapshot<Stock>;
      setStocks(qSnap.docs.map((snap) => snap.data()));
    }
  };

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  return (
    <div className="pt-12">
      <h1 className="text-xl text-center font-bold mx-8 mt-4 mb-2">在庫確認</h1>
      <Card className="mx-8 mb-4 overflow-visible">
        <Flex justify_content="between" align_items="center" className="p-4">
          <Flex>
            <Select
              className="mr-2 w-64"
              value={selectValue(shopCode, shopOptions)}
              options={shopOptions}
              onMenuOpen={() => {
                if (role === 'manager') {
                  registListner('shops');
                }
              }}
              isDisabled={role !== 'manager'}
              onChange={(e) => setShopCode(String(e?.value))}
            />
            <Button variant="outlined" onClick={readStocks} className="mr-2">
              検索
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
                <Table.Cell type="th">在庫数</Table.Cell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {stocks.map((stock, i) => {
                return (
                  <Table.Row key={i}>
                    <Table.Cell>{stock.productCode}</Table.Cell>
                    <Table.Cell>{stock.productName}</Table.Cell>
                    <Table.Cell className="text-right">{stock.quantity}</Table.Cell>
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

export default StockList;
