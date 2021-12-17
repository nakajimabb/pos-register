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

export type ProductCostPrice = {
  shopCode: string; // 店舗コード
  productCode: string; // JANコード
  productName: string;
  costPrice: number | null; // 売価(税抜)
  supplierRef: DocumentReference<Supplier> | null;
};

export type ProductSellingPrice = {
  shopCode: string; // 店舗コード
  productCode: string; // JANコード
  productName: string;
  sellingPrice: number | null; // 売価(税抜)
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

export type RegisterItem = {
  index: number;
  code: string;
  name: string;
  taxClass: TaxClass | null;
  tax: number | null;
};

export type ShortcutItem = {
  index: number;
  color: string;
  productRef: DocumentReference<Product>;
};

export type Sale = {
  receiptNumber: number;
  code: string;
  createdAt: Timestamp;
  detailsCount: number;
  salesTotal: number;
  taxTotal: number;
  discountTotal: number;
  paymentType: 'Cash' | 'Credit';
  cashAmount: number;
  salesNormalTotal: number;
  salesReducedTotal: number;
  taxNormalTotal: number;
  taxReducedTotal: number;
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
  shopCode: string;
  productCode: string;
  productName: string;
  quantity: number;
  updatedAt: Timestamp;
};

export type ProductFullTextSearch = {
  productCode: string[];
  productName: string[];
  updatedAt?: Timestamp;
};

export type CounterItem = {
  all: number;
  lastUpdatedAt: Timestamp;
  searchUpdatedAt?: Timestamp;
};

export type Counters = {
  products: CounterItem;
  shops: CounterItem;
  suppliers: CounterItem;
};
