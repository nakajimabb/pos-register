import { DocumentReference, Timestamp } from 'firebase/firestore';

export type Shop = {
  code: string;
  name: string;
  kana: string;
  hidden: boolean;
  email: string;
  zip: string;
  prefecture: number;
  municipality: string;
  house_number: string;
  building_name: string;
  tel: string;
  fax: string;
};

export type Product = {
  abbr: string;
  code: string;
  kana: string;
  name: string;
  note: string;
  hidden: boolean;
  costPrice: number | null; // 下代（原価）
  sellingPrice: number | null; // 売価(税抜)
  productGroup: 'general' | 'self-med' | null; // 商品設定グループ
  supplierCode?: string;
  supplierRef: DocumentReference<Supplier> | null;
  categoryRef: DocumentReference<ProductCategory> | null;
};

export type ProductCategory = {
  name: string;
  level: 1 | 2 | 3;
  parentRef: null | DocumentReference<ProductCategory>;
  parentId?: string; // for only cache data, don't save
};

export type Supplier = {
  code: string;
  name: string;
};

export type ShortcutItem = {
  index: number;
  color: String;
  productRef: DocumentReference<Product>;
};

export type Sale = {
  code: string;
  createdAt: Timestamp;
  detailsCount: number;
  salesTotal: number;
  taxTotal: number;
  discountTotal: number;
  paymentType: 'Cash' | 'Credit';
  cashAmount: number;
  salesNormalTotal: number;
  salesReductionTotal: number;
  taxNormalTotal: number;
  taxReductionTotal: number;
  status: 'Sales' | 'Cancel' | 'PartialCancel' | 'Return' | 'PartialReturn';
};

export type SaleDetail = {
  salesId: string;
  index: number;
  productCode: string;
  productName: string;
  price: number;
  quantity: number;
  discount: number;
  taxRate: number;
  status: 'Sales' | 'Cancel' | 'Return';
};

export type Stock = {
  storeCode: string;
  productRef: DocumentReference<Product>;
  quantity: number;
};
