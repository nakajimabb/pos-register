import { DocumentReference } from 'firebase/firestore';

export type Product = {
  abbr: string;
  code: string;
  kana: string;
  name: string;
  note: string;
  price: number | null; // 売価(税抜)
  categoryRef: DocumentReference<ProductCategory> | null;
};

export type ProductCategory = {
  name: string;
  level: 1 | 2 | 3;
  parentRef: null | DocumentReference<ProductCategory>;
  parentId?: string;    // for only cache data, don't save
};

export type Supplier = {
  code: string;
  name: string;
};
