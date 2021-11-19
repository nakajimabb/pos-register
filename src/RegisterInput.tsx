import React, { useState, useEffect } from 'react';
import { Button, Form, Modal, Table } from './components';
import { Product } from './types';

type BasketItem = {
  product: Product;
  quantity: number;
};

type RegisterItem = {
  code: string;
  name: string;
};

type Props = {
  open: boolean;
  registerItem: RegisterItem | undefined;
  basketItems: BasketItem[];
  setBasketItems: React.Dispatch<React.SetStateAction<BasketItem[]>>;
  onClose: () => void;
};

const RegisterInput: React.FC<Props> = ({ open, registerItem, basketItems, setBasketItems, onClose }) => {
  const [price, setPrice] = useState<number>(0);
  useEffect(() => {
    document.getElementById('inputPrice')?.focus(); //非推奨
  }, [open]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerItem && price > 0) {
      const existingIndex = basketItems.findIndex((item) => item.product.code === registerItem.code);
      if (existingIndex >= 0) {
        basketItems[existingIndex].product.price = price;
        setBasketItems([...basketItems]);
      } else {
        const basketItem = {
          product: {
            abbr: '',
            code: registerItem.code,
            kana: '',
            name: registerItem.name,
            price: price,
            categoryRef: null,
            note: '',
          },
          quantity: 1,
        };
        setBasketItems([...basketItems, basketItem]);
      }
    }
    setPrice(0);
    onClose();
  };

  return (
    <Modal open={open && !!registerItem} size="none" onClose={onClose} className="w-1/3">
      <Modal.Header centered={false} onClose={onClose}>
        {`${registerItem?.code}. ${registerItem?.name}`}
      </Modal.Header>
      <Modal.Body>
        <Table border="row" className="table-fixed w-full">
          <Table.Body>
            <Table.Row>
              <Table.Cell type="th">金額</Table.Cell>
              <Table.Cell>
                <Form onSubmit={save} className="space-y-2">
                  <Form.Text
                    id="inputPrice"
                    placeholder="金額"
                    value={price.toString()}
                    onChange={(e) => setPrice(Number(e.target.value.replace(/\D/, '')))}
                    className="text-right w-full"
                  />
                </Form>
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
      </Modal.Body>
      <Modal.Footer className="flex justify-end">
        <Button color="secondary" variant="outlined" className="mr-3" onClick={onClose}>
          キャンセル
        </Button>
        <Button color="primary" onClick={save}>
          OK
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RegisterInput;
