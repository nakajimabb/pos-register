import React, { useState, useEffect } from 'react';
import { Button, Form, Modal, Table } from './components';
import { Product } from './types';

type BasketItem = {
  product: Product;
  quantity: number;
};

type Props = {
  open: boolean;
  basketItem: BasketItem | undefined;
  basketItems: BasketItem[];
  setBasketItems: React.Dispatch<React.SetStateAction<BasketItem[]>>;
  onClose: () => void;
};

const RegisterModify: React.FC<Props> = ({ open, basketItem, basketItems, setBasketItems, onClose }) => {
  const [quantity, setQuantity] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);

  useEffect(() => {
    setQuantity(Number(basketItem?.quantity));
    const inputQuantity = document.getElementById('inputQuantity') as HTMLInputElement;
    inputQuantity?.focus(); //非推奨
    inputQuantity?.select(); //非推奨
  }, [open, basketItem]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (basketItem) {
      const existingIndex = basketItems.findIndex((item) => item.product.code === basketItem.product.code);
      if (existingIndex >= 0) {
        basketItems[existingIndex].quantity = quantity;
        if (discount > 0 || rate > 0) {
          let discountName = '値引き';
          let discountPrice = 0;
          if (discount > 0) {
            discountPrice = -discount;
          } else {
            discountName += `(${rate}%)`;
            discountPrice = -Math.floor((Number(basketItem.product.sellingPrice) * rate) / 100.0);
          }
          const discountItem = {
            product: {
              abbr: '',
              code: '',
              kana: '',
              name: discountName,
              hidden: false,
              costPrice: null,
              sellingPrice: discountPrice,
              stockTaxClass: null,
              sellingTaxClass: null,
              stockTax: null,
              sellingTax: null,
              selfMedication: false,
              supplierRef: null,
              categoryRef: null,
              note: '',
            },
            quantity: 1,
          };
          basketItems.splice(existingIndex + 1, 0, discountItem);
        }
        setBasketItems([...basketItems]);
      }
    }
    setDiscount(0);
    setRate(0);
    onClose();
  };

  return (
    <Modal open={open && !!basketItem} size="none" onClose={onClose} className="w-1/2">
      <Modal.Header centered={false} onClose={onClose}>
        明細修正
      </Modal.Header>
      <Modal.Body>
        <Table border="row" className="table-fixed w-full">
          <Table.Body>
            <Table.Row>
              <Table.Cell type="th">商品名</Table.Cell>
              <Table.Cell>{basketItem?.product.name}</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell type="th">単価</Table.Cell>
              <Table.Cell>{basketItem?.product.sellingPrice?.toLocaleString()}</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell type="th">数量</Table.Cell>
              <Table.Cell>
                <Form onSubmit={save} className="space-y-2">
                  <Form.Text
                    id="inputQuantity"
                    placeholder="数量"
                    value={quantity.toString()}
                    onChange={(e) => setQuantity(Number(e.target.value.replace(/\D/, '')))}
                    className="text-right w-full"
                  />
                </Form>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell type="th">値引き(金額)</Table.Cell>
              <Table.Cell>
                <Form onSubmit={save} className="space-y-2">
                  <Form.Text
                    id="inputDiscount"
                    placeholder="値引き(金額)"
                    value={discount.toString()}
                    onChange={(e) => setDiscount(Number(e.target.value.replace(/\D/, '')))}
                    className="text-right w-full"
                  />
                </Form>
              </Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell type="th">値引き(%)</Table.Cell>
              <Table.Cell>
                <Form onSubmit={save} className="space-y-2">
                  <Form.Text
                    id="inputRate"
                    placeholder="値引き(%)"
                    value={rate.toString()}
                    onChange={(e) => setRate(Number(e.target.value.replace(/\D/, '')))}
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

export default RegisterModify;
