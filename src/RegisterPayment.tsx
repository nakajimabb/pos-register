import React, { useState, useEffect } from 'react';
import { Button, Form, Modal, Table } from './components';
import { Product } from './types';

type BasketItem = {
  product: Product;
  quantity: number;
};

type Props = {
  open: boolean;
  basketItems: BasketItem[];
  onClose: () => void;
};

const RegisterPayment: React.FC<Props> = ({ open, basketItems, onClose }) => {
  const [cash, setCash] = useState<number>(0);

  useEffect(() => {
    document.getElementById('inputCash')?.focus(); //非推奨
  }, [open]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onClose();
    } catch (error) {
      console.log({ error });
    }
  };

  return (
    <Modal open={open} size="md" onClose={onClose}>
      <Form onSubmit={save} className="space-y-2">
        <Modal.Header centered={false} onClose={onClose}>
          お会計
        </Modal.Header>
        <Modal.Body>
          <Table border="row" className="table-fixed w-full">
            <Table.Body>
              <Table.Row>
                <Table.Cell type="th" className="text-xl bg-red-100">
                  合計
                </Table.Cell>
                <Table.Cell className="text-right text-xl pr-4">
                  ¥
                  {basketItems
                    .reduce(
                      (result, item) =>
                        result + Number(item.product.price) * item.quantity,
                      0
                    )
                    .toLocaleString()}
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell type="th">お預かり</Table.Cell>
                <Table.Cell>
                  <Form.Text
                    id="inputCash"
                    placeholder="金額"
                    value={cash.toString()}
                    onChange={(e) =>
                      setCash(Number(e.target.value.replace(/\D/, '')))
                    }
                    className="text-right w-full"
                  />
                </Table.Cell>
              </Table.Row>
              <Table.Row>
                <Table.Cell type="th">お釣り</Table.Cell>
                <Table.Cell className="text-right pr-4">
                  ¥
                  {(
                    cash -
                    basketItems.reduce(
                      (result, item) =>
                        result + Number(item.product.price) * item.quantity,
                      0
                    )
                  ).toLocaleString()}
                </Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table>
        </Modal.Body>
        <Modal.Footer className="flex justify-end">
          <Button
            color="secondary"
            variant="outlined"
            className="mr-3"
            onClick={onClose}
          >
            キャンセル
          </Button>
          <Button color="primary">完了</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default RegisterPayment;
