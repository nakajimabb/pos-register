import { DocumentReference, Timestamp } from 'firebase/firestore';
import { toDateString } from './tools';

export const CLASS_DELIV = '01';

export type Role = 'shop' | 'manager' | 'admin';

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
  role?: 'shop' | 'manager' | 'admin';
};

export type TaxClass = 'exclusive' | 'inclusive' | 'free'; // 外税、内税、非課税

export type Product = {
  abbr: string;
  code: string;
  kana: string;
  name: string;
  note: string;
  hidden: boolean;
  unregistered?: boolean;
  sellingPrice: number | null; // 売価(税抜)
  costPrice: number | null; // 下代（原価）
  avgCostPrice: number | null; // 移動平均原価
  sellingTaxClass: TaxClass | null; // 税区分(売価)
  stockTaxClass: TaxClass | null; // 税区分(仕入)
  sellingTax: number | null; // 売価消費税
  stockTax: number | null; // 仕入消費税
  selfMedication: boolean;
  supplierRef: DocumentReference<Supplier> | null;
  categoryRef: DocumentReference<ProductCategory> | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ProductCostPrice = {
  shopCode: string; // 店舗コード
  productCode: string; // JANコード
  productName: string;
  supplierCode: string; // 仕入先コード
  supplierName: string;
  costPrice: number | null; // 原価(税抜)
  updatedAt?: Timestamp; // 更新日
};

export type ProductSellingPrice = {
  shopCode: string; // 店舗コード
  productCode: string; // JANコード
  productName: string;
  sellingPrice: number | null; // 売価(税抜)
  updatedAt?: Timestamp;
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
  sortOrder: number;
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
  salesTaxFreeTotal: number;
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
  outputReceipt: boolean;
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

export type FixedCostRate = {
  productCode: string;
  description: string;
  rate: number;
};

// 仕入情報
export type Purchase = {
  purchaseNumber: number; // 社内時 => purchaseNumber <=> deliveryNumber
  shopCode: string; // 店舗コード
  shopName: string; // 店舗名
  srcType: 'supplier' | 'shop';
  srcCode: string; // 仕入元店舗コード、または仕入コード
  srcName: string; // 仕入元店舗名、または仕入先名称
  date: Timestamp; // 仕入日
  fixed: boolean;
  updatedAt?: Timestamp;
};

// 仕入詳細情報
export type PurchaseDetail = {
  productCode: string; // JANコード
  productName: string;
  quantity: number;
  history?: number[];
  costPrice: number | null; // 原価(税抜)
  noReturn?: boolean; // 返品不可
  fixed: boolean;
};

// 出庫情報
export type Delivery = {
  deliveryNumber: number;
  shopCode: string; // 店舗コード
  shopName: string; // 店舗コード
  dstShopCode: string; // 送り先店舗コード
  dstShopName: string;
  date: Timestamp; // 出庫日
  fixed: boolean;
  updatedAt?: Timestamp;
};

// 出庫詳細情報
export type DeliveryDetail = {
  productCode: string; // JANコード
  productName: string;
  quantity: number;
  history?: number[];
  costPrice: number | null; // 原価(税抜)
  fixed: boolean;
};

export type RegisterStatus = {
  date: Timestamp;
  openedAt: Timestamp;
  closedAt: Timestamp | null;
};

// 棚卸し
export type Inventory = {
  shopCode: string; // 店舗コード
  shopName: string; // 店舗コード
  date: Timestamp; // 出庫日時
  fixedAt?: Timestamp;
};

// 出庫詳細情報
export type InventoryDetail = {
  productCode: string; // JANコード
  productName: string;
  quantity: number;
  costPrice?: number;
  stockTax?: number; // 仕入消費税 8 or 10
  stock: number; // 理論値(カウント時在庫)
  countedAt: Timestamp | null; // 最終カウント時刻
};

export const deliveryPath = (shopCode: string, deliveryNumber: number | undefined = undefined) =>
  `shops/${shopCode}/deliveries/${deliveryNumber ?? ''}`;

export const deliveryDetailPath = (
  shopCode: string,
  deliveryNumber: number,
  productCode: string | undefined = undefined
) => deliveryPath(shopCode, deliveryNumber) + `/deliveryDetails/${productCode ?? ''}`;

export const purchasePath = (shopCode: string, purchaseyNumber: number | undefined = undefined) =>
  `shops/${shopCode}/purchases/${purchaseyNumber ?? ''}`;

export const purchaseDetailPath = (
  shopCode: string,
  purchaseyNumber: number,
  productCode: string | undefined = undefined
) => purchasePath(shopCode, purchaseyNumber) + `/purchaseDetails/${productCode ?? ''}`;

export const productCostPricesPath = (shopCode: string) => `shops/${shopCode}/productCostPrices`;
export const productCostPricePath = (shopCode: string, productCode: string, supplierCode: string) =>
  `shops/${shopCode}/productCostPrices/${productCode}|${supplierCode}`;

export const productSellingPricePath = (shopCode: string, productCode: string) =>
  `shops/${shopCode}/productSellingPrices/${productCode}`;

export const stockPath = (shopCode: string, productCode: string | undefined = undefined) =>
  `shops/${shopCode}/stocks/${productCode ?? ''}`;

export const inventoryPath = (shopCode: string, date: Date | undefined = undefined) =>
  `shops/${shopCode}/inventories/${date ? toDateString(date, 'YYYY-MM-DD') : ''}`;

export const inventoryDetailPath = (shopCode: string, date: Date, productCode: string | undefined = undefined) =>
  inventoryPath(shopCode, date) + `/inventoryDetails/${productCode ?? ''}`;
