import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, getFirestore, serverTimestamp, DocumentSnapshot } from 'firebase/firestore';
import Select, { SingleValue } from 'react-select';
import { Alert, Button, Flex, Form, Grid, Modal } from './components';
import firebaseError from './firebaseError';
import { Shop } from './types';
import { prefectureOptions } from './prefecture';
import { isNum } from './tools';

const db = getFirestore();
const ROLE_NAMES = { shop: '店舗', manager: '管理者', admin: 'ｼｽﾃﾑ' };

type Props = {
  mode: 'edit' | 'show';
  open: boolean;
  shopCode: string;
  onClose: () => void;
  onUpdate: (shop: Shop) => void;
};

const ShopEdit: React.FC<Props> = ({ mode, open, shopCode, onClose, onUpdate }) => {
  const [shop, setShop] = useState<Shop | undefined>(undefined);
  const [error, setError] = useState('');
  const prefOptions = prefectureOptions();

  useEffect(() => {
    const f = async () => {
      if (shopCode) {
        const snap = (await getDoc(doc(db, 'shops', shopCode))) as DocumentSnapshot<Shop>;
        if (snap.exists()) {
          setShop(snap.data());
        } else {
          setShop(undefined);
        }
      } else {
        setShop(undefined);
      }
    };
    f();
  }, [shopCode]);

  const selectValue = (value: string | undefined, options: { label: string; value: string }[]) => {
    return value ? options.find((option) => option.value === value) : { label: '', value: '' };
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'edit') {
      setError('');
      try {
        if (shopCode) {
          await setDoc(doc(db, 'shops', shopCode), { ...shop, updatedAt: serverTimestamp() });
          if (shop) onUpdate(shop);
          onClose();
        }
      } catch (error) {
        console.log({ error });
        setError(firebaseError(error));
      }
    }
  };

  if (!shop) return null;

  return (
    <Modal open={open} size="none" onClose={onClose} className="w-2/3 overflow-visible">
      <Form onSubmit={save} className="space-y-2">
        <Modal.Header centered={false} onClose={onClose}>
          店舗{mode === 'edit' ? '編集' : '情報'}
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert severity="error" className="my-4">
              {error}
            </Alert>
          )}
          <Grid cols="1 sm:2" gap="0 sm:3" auto_cols="fr" template_cols="1fr 3fr" className="row-end-2">
            <Form.Label>店舗コード</Form.Label>
            <Form.Text placeholder="店舗コード" disabled required value={shopCode} />
            <Form.Label>店内呼称</Form.Label>
            <Form.Text
              disabled={mode !== 'edit'}
              placeholder="店内呼称"
              required
              value={shop.name}
              onChange={(e) => setShop({ ...shop, name: e.target.value })}
            />
            <Form.Label>店舗名カナ</Form.Label>
            <Form.Text
              disabled={mode !== 'edit'}
              placeholder="店内呼称(カナ)"
              value={shop.kana}
              onChange={(e) => setShop({ ...shop, kana: e.target.value })}
            />
            <Form.Label>薬局名</Form.Label>
            <Form.Text
              disabled={mode !== 'edit'}
              placeholder="薬局名"
              value={shop.formalName}
              onChange={(e) => setShop({ ...shop, formalName: e.target.value })}
            />
            <Form.Label>薬局名(カナ)</Form.Label>
            <Form.Text
              disabled={mode !== 'edit'}
              placeholder="薬局名(カナ)"
              value={shop.formalKana}
              onChange={(e) => setShop({ ...shop, formalKana: e.target.value })}
            />
            <Form.Label>住所</Form.Label>
            <div className="space-y-2">
              <hr />
              <Flex className="space-x-2">
                <span className="my-2"> 〒</span>
                <Form.Text
                  disabled={mode !== 'edit'}
                  placeholder="郵便番号"
                  value={shop.zip}
                  onChange={(e) => setShop({ ...shop, zip: e.target.value })}
                />
                <Select
                  isDisabled={mode !== 'edit'}
                  className="mb-3 sm:mb-0"
                  value={selectValue(String(shop.prefecture), prefOptions)}
                  options={prefOptions}
                  onChange={(e: SingleValue<{ label: string; value: string }>) => {
                    if (isNum(e?.value)) setShop({ ...shop, prefecture: Number(e?.value) });
                  }}
                />
              </Flex>
              <Flex className="space-x-2">
                <Form.Text
                  disabled={mode !== 'edit'}
                  placeholder="市区町村"
                  value={shop.municipality}
                  onChange={(e) => setShop({ ...shop, municipality: e.target.value })}
                  className="w-2/3"
                />
                <Form.Text
                  disabled={mode !== 'edit'}
                  placeholder="番地"
                  value={shop.houseNumber}
                  onChange={(e) => setShop({ ...shop, houseNumber: e.target.value })}
                  className="w-1/3"
                />
              </Flex>
              <Form.Text
                disabled={mode !== 'edit'}
                placeholder="建物名など"
                value={shop.buildingName}
                onChange={(e) => setShop({ ...shop, buildingName: e.target.value })}
                className="w-full"
              />
              <hr />
            </div>
            <Form.Label>電話番号</Form.Label>
            <Form.Text
              disabled={mode !== 'edit'}
              placeholder="電話番号"
              value={shop.tel}
              onChange={(e) => setShop({ ...shop, tel: e.target.value })}
            />
            <Form.Label>FAX番号</Form.Label>
            <Form.Text
              disabled={mode !== 'edit'}
              placeholder="FAX番号"
              value={shop.fax}
              onChange={(e) => setShop({ ...shop, fax: e.target.value })}
            />
            <Form.Label>権限</Form.Label>
            <Form.Text placeholder="権限" disabled value={shop.role && ROLE_NAMES[shop.role]} />
            <Form.Label></Form.Label>
            <Form.Checkbox
              disabled={mode !== 'edit'}
              label="非表示"
              checked={shop.hidden}
              onChange={(e) => setShop({ ...shop, hidden: e.target.checked })}
            />
          </Grid>
        </Modal.Body>
        {mode === 'edit' && (
          <Modal.Footer className="flex justify-end space-x-2">
            <Button type="submit" color="primary">
              保存
            </Button>
            <Button type="button" color="secondary" variant="outlined" onClick={onClose}>
              Cancel
            </Button>
          </Modal.Footer>
        )}
      </Form>
    </Modal>
  );
};

export default ShopEdit;
