import React, { useState, useEffect } from 'react';
import { Button, Form, Modal, Table } from './components';
import { useAppContext } from './AppContext';
import { Product, RegisterItem } from './types';
import { toNumber } from './tools';

type BasketItem = {
  product: Product;
  quantity: number;
};

type Props = {
  open: boolean;
  registerItem: RegisterItem | undefined;
  basketItems: BasketItem[];
  setBasketItems: React.Dispatch<React.SetStateAction<BasketItem[]>>;
  onClose: () => void;
};

const RegisterInput: React.FC<Props> = ({ open, registerItem, basketItems, setBasketItems, onClose }) => {
  const [priceText, setPriceText] = useState<string>('0');
  const { addBundleDiscount } = useAppContext();

  useEffect(() => {
    setPriceText('0');
    const inputPrice = document.getElementById('inputPrice') as HTMLInputElement;
    inputPrice?.focus();
    inputPrice?.select();
  }, [open]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const price = toNumber(priceText);
    if (registerItem && price > 0) {
      const existingIndex = basketItems.findIndex((item) => item.product.code === registerItem.code);
      if (existingIndex >= 0) {
        basketItems[existingIndex].product.sellingPrice = price;
        setBasketItems(addBundleDiscount(basketItems));
      } else {
        const basketItem = {
          product: {
            abbr: '',
            code: registerItem.code,
            kana: '',
            name: registerItem.name,
            hidden: false,
            costPrice: null,
            sellingPrice: price,
            stockTaxClass: null,
            sellingTaxClass: registerItem.taxClass,
            stockTax: null,
            sellingTax: registerItem.tax,
            selfMedication: false,
            supplierRef: null,
            categoryRef: null,
            note: '',
          },
          quantity: 1,
        };
        setBasketItems(addBundleDiscount([...basketItems, basketItem]));
      }
    }
    setPriceText('0');
    onClose();
  };

  return (
    <Modal open={open && !!registerItem} size="none" onClose={onClose} className="w-1/3">
      <Modal.Header centered={false} onClose={onClose}>
        {`${registerItem?.index}. ${registerItem?.name}`}
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
                    value={priceText}
                    onChange={(e) => setPriceText(e.target.value)}
                    onBlur={() => setPriceText(toNumber(priceText).toString())}
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
