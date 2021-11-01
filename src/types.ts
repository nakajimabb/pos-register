import { DocumentReference } from 'firebase/firestore';

export type Product = {
  abbr: string;
  code: string;
  kana: string;
  name: string;
  note: string;
  price: number | null;
};

export type ProductCategory = {
  name: string;
  level: 1 | 2 | 3;
  parentRef: null | DocumentReference<ProductCategory>;
};

export type Supplier = {
  code: string;
  name: string;
};
