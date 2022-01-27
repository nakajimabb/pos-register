import { DocumentReference, Timestamp } from 'firebase/firestore';
import { toDateString } from './tools';

export type Shop = {
  code: string;
  name: string;
  kana: string;
  formalName: string;
  formalKana: string;
  hidden: boolean;
  email: string;
  zip: string;
  prefecture: number;
  municipality: string;
  houseNumber: string;
  buildingName: string;
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
  supplierCode: string; // 仕入先コード
  supplierName: string;
  costPrice: number | null; // 原価(税抜)
};

export const productCostPricePath = (data: { shopCode: string; productCode: string; supplierCode: string }) =>
  `shops/${data.shopCode}/productCostPrices/${data.productCode}|${data.supplierCode}`;

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
  division: string;
  defaultPrice: number;
  outputReceipt: boolean;
  taxClass: TaxClass | null;
  tax: number | null;
};

export type BasketItem = {
  product: Product;
  division: string;
  outputReceipt: boolean;
  quantity: number;
};

export type ShortcutItem = {
  index: number;
  color: string;
  productRef: DocumentReference<Product>;
};

export type Sale = {
  receiptNumber: number;
  shopCode: string;
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
  division: string;
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

export type ProductBundle = {
  code: string;
  name: string;
  sellingTaxClass: TaxClass | null; // 税区分
  sellingTax: number | null; // 消費税
  quantity: number;
  discount: number;
  productCodes: string[];
};

export type ProductBulk = {
  parentProductCode: string;
  parentProductName: string;
  childProductCode: string;
  childProductName: string;
  quantity: number;
};

// 仕入れ情報
export type Purchase = {
  shopCode: string; // 店舗コード
  supplierCode: string;
  date: Timestamp; // 仕入れ日
};

export const purchasePath = (data: { shopCode: string; date: Date; supplierCode: string }) =>
  `shops/${data.shopCode}/purchases/${toDateString(data.date, 'YYYY-MM-DD')}|${data.supplierCode}`;

// 仕入情報
export type PurchaseDetail = {
  productCode: string; // JANコード
  productName: string;
  quantity: number;
  costPrice: number | null; // 原価(税抜)
  noReturn?: boolean; // 返品不可
};

export const purchaseDetailPath = (data: { shopCode: string; date: Date; supplierCode: string; productCode: string }) =>
  `shops/${data.shopCode}/purchases/${toDateString(data.date, 'YYYY-MM-DD')}|${data.supplierCode}/purchaseDetails/${
    data.productCode
  }`;
