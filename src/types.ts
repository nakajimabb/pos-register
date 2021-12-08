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

export type TaxClass = 'exclusive' | 'inclusive' | 'free'; // 外税、内税、非課税

export type Product = {
  abbr: string;
  code: string;
  kana: string;
  name: string;
  note: string;
  hidden: boolean;
  sellingPrice: number | null; // 売価(税抜)
  costPrice: number | null; // 下代（原価）
  sellingTaxClass: TaxClass | null; // 税区分(売価)
  stockTaxClass: TaxClass | null; // 税区分(仕入)
  sellingTax: number | null; // 売価消費税
  stockTax: number | null; // 仕入消費税
  selfMedication: boolean;
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
  product: Product;
  quantity: number;
  discount: number;
  status: 'Sales' | 'Cancel' | 'Return';
};

export type Stock = {
  storeCode: string;
  productRef: DocumentReference<Product>;
  quantity: number;
};
