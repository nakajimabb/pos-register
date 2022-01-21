import React, { useState, useEffect } from 'react';
import { Button, Form, Modal, Table } from './components';
import { useAppContext } from './AppContext';
import { Product } from './types';
import { toNumber } from './tools';

type BasketItem = {
  product: Product;
  quantity: number;
};

type Props = {
  open: boolean;
  itemIndex: number;
  basketItems: BasketItem[];
  setBasketItems: React.Dispatch<React.SetStateAction<BasketItem[]>>;
  onClose: () => void;
};

const RegisterModify: React.FC<Props> = ({ open, itemIndex, basketItems, setBasketItems, onClose }) => {
  const [quantityText, setQuantityText] = useState<string>('1');
  const [discountText, setDiscountText] = useState<string>('0');
  const [rateText, setRateText] = useState<string>('0');
  const { addBundleDiscount } = useAppContext();

  useEffect(() => {
    // setQuantityText(Number(basketItem?.quantity).toString());
    const inputQuantity = document.getElementById('inputQuantity') as HTMLInputElement;
    if (inputQuantity) inputQuantity.value = String(basketItems[itemIndex]?.quantity);
    inputQuantity?.focus();
    inputQuantity?.select();
  }, [open, basketItems, itemIndex]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (basketItems[itemIndex]) {
      const existingIndex = basketItems.findIndex((item) => item.product.code === basketItems[itemIndex].product.code);
      if (existingIndex >= 0) {
        basketItems[existingIndex].quantity = toNumber(quantityText);
        if (toNumber(discountText) > 0 || toNumber(rateText) > 0) {
          let discountName = '値引き';
          let discountPrice = 0;
          if (toNumber(discountText) > 0) {
            discountPrice = -toNumber(discountText);
          } else {
            discountName += `(${toNumber(rateText)}%)`;
            discountPrice = -Math.floor(
              (Number(basketItems[itemIndex].product.sellingPrice) * toNumber(rateText)) / 100.0
            );
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
              sellingTaxClass: basketItems[itemIndex].product.sellingTaxClass,
              stockTax: null,
              sellingTax: basketItems[itemIndex].product.sellingTax,
              selfMedication: false,
              supplierRef: null,
              categoryRef: null,
              note: '',
            },
            quantity: 1,
          };

          if (basketItems[existingIndex + 1] && !basketItems[existingIndex + 1].product.code) {
            basketItems.splice(existingIndex + 1, 1, discountItem);
          } else {
            basketItems.splice(existingIndex + 1, 0, discountItem);
          }
        }
        setBasketItems(addBundleDiscount(basketItems));
      }
    }
    setDiscountText('0');
    setRateText('0');
    onClose();
  };

  return (
    <Modal open={open && !!basketItems[itemIndex]} size="none" onClose={onClose} className="w-1/2">
      <Modal.Header centered={false} onClose={onClose}>
        明細修正
      </Modal.Header>
      <Modal.Body>
        <Table border="row" className="table-fixed w-full">
          <Table.Body>
            <Table.Row>
              <Table.Cell type="th">商品名</Table.Cell>
              <Table.Cell>{basketItems[itemIndex]?.product.name}</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell type="th">単価</Table.Cell>
              <Table.Cell>{basketItems[itemIndex]?.product.sellingPrice?.toLocaleString()}</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell type="th">数量</Table.Cell>
              <Table.Cell>
                <Form onSubmit={save} className="space-y-2">
                  <Form.Text
                    id="inputQuantity"
                    placeholder="数量"
                    value={quantityText}
                    onChange={(e) => setQuantityText(e.target.value)}
                    onBlur={() => setQuantityText(toNumber(quantityText).toString())}
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
                    value={discountText}
                    onChange={(e) => setDiscountText(e.target.value)}
                    onBlur={() => setDiscountText(toNumber(discountText).toString())}
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
                    value={rateText}
                    onChange={(e) => setRateText(e.target.value)}
                    onBlur={() => setRateText(toNumber(rateText).toString())}
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
        <Button color="primary" disabled={toNumber(quantityText) <= 0} onClick={save}>
          OK
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default RegisterModify;
