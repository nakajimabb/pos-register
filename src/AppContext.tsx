import React, { useState, useEffect, useContext, createContext } from 'react';

import {
  Bytes,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  limit,
  query,
  orderBy,
  startAt,
  endAt,
  increment,
  Timestamp,
  where,
  Transaction,
  Query,
  QueryConstraint,
  QuerySnapshot,
  serverTimestamp,
  setDoc,
  DocumentSnapshot,
} from 'firebase/firestore';
import { getAuth, User, onAuthStateChanged } from 'firebase/auth';
import { userCodeFromEmail, OTC_DIVISION, hiraToKana, isNum } from './tools';
import {
  Role,
  Product,
  Supplier,
  Shop,
  CounterItem,
  Counters,
  ProductBundle,
  ProductBulk,
  BasketItem,
  FixedCostRate,
  stockPath,
  productCostPricePath,
  ProductCostPrice,
  ProductSellingPrice,
  productCostPricesPath,
  productSellingPricePath,
} from './types';

const zlib = require('zlib');

const db = getFirestore();
const auth = getAuth();

export type ContextType = {
  currentUser: User | null;
  currentShop: Shop | null;
  counters: Counters | null;
  productBundles: ProductBundle[];
  productBulks: ProductBulk[];
  fixedCostRates: FixedCostRate[];
  suppliers: Map<string, Supplier>;
  shops: Map<string, Supplier>;
  role: Role | null;
  addBundleDiscount: (basketItems: BasketItem[]) => BasketItem[];
  loadProductOptions: (inputText: string) => Promise<{ label: string; value: string }[]>;
  searchProducts: (inputText: string) => Promise<Product[]>;
  registListner: (name: 'suppliers' | 'shops') => void;
  incrementStock: (
    shopCode: string,
    productCode: string,
    productName: string,
    incr: number,
    transaction?: Transaction
  ) => void;
  getProductPrice: (
    shopCode: string,
    productCode: string,
    types: ('CostPrice' | 'SellingPrice' | 'AvgCostPrice' | 'StockTax')[]
  ) => Promise<{ costPrice?: number; sellingPrice?: number; avgCostPrice?: number; stockTax?: number }>;
  getProductCostPrice: (
    shopCode: string,
    productCode: string,
    supplierCode: string
  ) => Promise<{ productName: string; costPrice: number | null; noReturn?: boolean } | undefined>;
};

const AppContext = createContext({
  currentUser: null,
  currentShop: null,
  counters: null,
  suppliers: new Map(),
  shops: new Map(),
  productBundles: [],
  productBulks: [],
  fixedCostRates: [],
  role: null,
  addBundleDiscount: (basketItems: BasketItem[]) => basketItems,
  loadProductOptions: async (inputText: string) => [],
  searchProducts: async (inputText: string) => [],
  registListner: (name: 'suppliers' | 'shops') => {},
  incrementStock: (
    shopCode: string,
    productCode: string,
    productName: string,
    incr: number,
    transaction?: Transaction
  ) => {},
  getProductPrice: async (
    shopCode: string,
    productCode: string,
    types: ('CostPrice' | 'SellingPrice' | 'AvgCostPrice' | 'StockTax')[]
  ) => ({}),
  getProductCostPrice: async (shopCode: string, productCode: string, supplierCode: string) => undefined,
} as ContextType);

type FullTextSearch = {
  texts: string[];
  updatedAt: Timestamp;
};

export const AppContextProvider: React.FC = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [productFullTextSearch, setProductFullTextSearch] = useState<FullTextSearch>({
    texts: [],
    updatedAt: new Timestamp(0, 0),
  });
  const [counters, setCounters] = useState<Counters>({
    products: { all: 0, lastUpdatedAt: new Timestamp(0, 0) },
    shops: { all: 0, lastUpdatedAt: new Timestamp(0, 0) },
    suppliers: { all: 0, lastUpdatedAt: new Timestamp(0, 0) },
  });
  const [productBundles, setProductBundles] = useState<ProductBundle[]>([]);
  const [productBulks, setProductBulks] = useState<ProductBulk[]>([]);
  const [fixedCostRates, setFixedCostRates] = useState<FixedCostRate[]>([]);
  const [suppliers, setSuppliers] = useState<Map<string, Supplier>>(new Map());
  const [shops, setShops] = useState<Map<string, Shop>>(new Map());
  const [listeners, setListeners] = useState<{ suppliers: boolean; shops: boolean }>({
    suppliers: false,
    shops: false,
  });
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setCurrentShop(null);
      setRole(null);
      if (user && user.email) {
        // set role
        const token = await user.getIdTokenResult();
        const role = token.claims.role;
        if (typeof role === 'string') setRole(role as Role);
        // set currentShop
        const shopCode = userCodeFromEmail(user.email);
        if (shopCode) {
          const snap = await getDoc(doc(db, 'shops', shopCode));
          const shop = snap.data();
          if (shop) setCurrentShop(shop as Shop);
        }
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'counters'), (snapshot) => {
      const cnts: Counters = {
        products: { all: 0, lastUpdatedAt: new Timestamp(0, 0) },
        shops: { all: 0, lastUpdatedAt: new Timestamp(0, 0) },
        suppliers: { all: 0, lastUpdatedAt: new Timestamp(0, 0) },
      };
      snapshot.docs.forEach((item) => {
        const name = item.id;
        if (name === 'products' || name === 'shops' || name === 'suppliers') {
          cnts[name] = item.data() as CounterItem;
        }
      });
      setCounters(cnts);
    });
    console.log('...start realtime listener on counters.');
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'productBundles'), (snapshot) => {
      const bundlesData: ProductBundle[] = [];
      snapshot.docs.forEach((doc) => {
        bundlesData.push(doc.data() as ProductBundle);
      });
      setProductBundles(bundlesData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'productBulks'), (snapshot) => {
      const bulksData: ProductBulk[] = [];
      snapshot.docs.forEach((doc) => {
        bulksData.push(doc.data() as ProductBulk);
      });
      setProductBulks(bulksData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'fixedCostRates'), (snapshot) => {
      const ratesData: FixedCostRate[] = [];
      snapshot.docs.forEach((doc) => {
        ratesData.push(doc.data() as FixedCostRate);
      });
      setFixedCostRates(ratesData);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (listeners.suppliers) {
      const unsubscribe = onSnapshot(collection(db, 'suppliers'), (snapshot) => {
        const supps = new Map<string, Supplier>();
        snapshot.docs.forEach((doc) => {
          const sup = doc.data() as Supplier;
          supps.set(sup.code, sup);
        });
        setSuppliers(supps);
      });
      console.log('...start realtime listener on suppliers.');
      return () => unsubscribe();
    }
  }, [listeners.suppliers]);

  useEffect(() => {
    if (listeners.shops) {
      const unsubscribe = onSnapshot(collection(db, 'shops'), (snapshot) => {
        const shps = new Map<string, Shop>();
        snapshot.docs.forEach((doc) => {
          const shop = doc.data() as Shop;
          shps.set(shop.code, shop);
        });
        setShops(shps);
      });
      console.log('...start realtime listener on shops.');
      return () => unsubscribe();
    }
  }, [listeners.shops]);

  const registListner = (name: 'suppliers' | 'shops') => {
    setListeners((prev) => ({ ...prev, [name]: true }));
  };

  const incrementStock = (
    shopCode: string,
    productCode: string,
    productName: string,
    incr: number,
    transaction?: Transaction
  ) => {
    const productBulk = productBulks.find((bulk) => bulk.parentProductCode === productCode);
    const code = productBulk ? productBulk.childProductCode : productCode;
    const name = productBulk ? productBulk.childProductName : productName;
    const path = stockPath(shopCode, code);
    const ref = doc(db, path);
    const incmnt = productBulk ? productBulk.quantity * incr : incr;
    const data = {
      shopCode,
      productCode: code,
      productName: name,
      quantity: increment(incmnt),
      updatedAt: serverTimestamp(),
    };
    if (transaction) {
      transaction.set(ref, data, { merge: true });
    } else {
      setDoc(ref, data, { merge: true });
    }
  };

  // 商品マスタ（共通）取得メソッド
  const pdct = async (productCode: string) => {
    const snap = (await getDoc(doc(db, 'products', productCode))) as DocumentSnapshot<Product>;
    if (snap.exists()) return snap.data();
  };

  // 店舗原価、返品不可属性を取得
  const getProductCostPrice = async (shopCode: string, productCode: string, supplierCode: string) => {
    const dsnap = (await getDoc(
      doc(db, productCostPricePath(shopCode, productCode, supplierCode))
    )) as DocumentSnapshot<ProductCostPrice>;

    if (dsnap.exists()) {
      const price = dsnap.data();
      if (price.costPrice !== null && isNum(price.costPrice)) {
        return { costPrice: price.costPrice, noReturn: price.noReturn, productName: price.productName };
      }
    }

    const product = await pdct(productCode);
    if (product) {
      return { costPrice: product.costPrice, noReturn: product.noReturn, productName: product.name };
    }
  };

  // 店舗最終原価、店舗売価、移動平均原価を取得
  const getProductPrice = async (
    shopCode: string,
    productCode: string,
    types: ('CostPrice' | 'SellingPrice' | 'AvgCostPrice' | 'StockTax' | 'noReturn')[]
  ) => {
    let product: Product | undefined = undefined;
    const prices: {
      costPrice?: number;
      sellingPrice?: number;
      avgCostPrice?: number;
      stockTax?: number;
      noReturn?: boolean;
    } = {};
    // 店舗最終原価
    if (types.find((type) => type === 'CostPrice')) {
      const conds = [where('productCode', '==', productCode)];
      const q = query(collection(db, productCostPricesPath(shopCode)), ...conds) as Query<ProductCostPrice>;
      const qsnap = await getDocs(q);
      if (qsnap.size > 0) {
        const costPrices = qsnap.docs
          .map((dsnap) => dsnap.data())
          .sort((p1, p2) => {
            if (!p1.updatedAt) {
              return 1;
            } else if (!p2.updatedAt) {
              return -1;
            } else {
              return Number(p2.updatedAt.toDate()) - Number(p1.updatedAt.toDate());
            }
          });
        const costPrice = costPrices[0];
        if (costPrice.costPrice) {
          prices.costPrice = costPrice.costPrice;
        } else {
          if (!product) product = await pdct(productCode);
          if (product && product.costPrice) prices.costPrice = product.costPrice;
        }
      } else {
        if (!product) product = await pdct(productCode);
        if (product && product.costPrice) prices.costPrice = product.costPrice;
      }
    }
    // 店舗売価
    if (types.find((type) => type === 'SellingPrice')) {
      const dsnap = (await getDoc(
        doc(db, productSellingPricePath(shopCode, productCode))
      )) as DocumentSnapshot<ProductSellingPrice>;
      if (dsnap.exists()) {
        const sellingPrice = dsnap.data();
        if (sellingPrice.sellingPrice) {
          prices.sellingPrice = sellingPrice.sellingPrice;
        } else {
          if (!product) product = await pdct(productCode);
          if (product && product.sellingPrice) prices.sellingPrice = product.sellingPrice;
        }
      } else {
        if (!product) product = await pdct(productCode);
        if (product && product.sellingPrice) prices.sellingPrice = product.sellingPrice;
      }
    }
    // 店舗売価
    if (types.find((type) => type === 'AvgCostPrice')) {
      if (!product) product = await pdct(productCode);
      if (product && product.avgCostPrice) prices.avgCostPrice = product.avgCostPrice;
    }
    // 仕入消費税
    if (types.find((type) => type === 'StockTax')) {
      if (!product) product = await pdct(productCode);
      if (product && product.stockTax) prices.stockTax = product.stockTax;
    }
    return prices;
  };

  const addBundleDiscount = (basketItems: BasketItem[]) => {
    productBundles.forEach((productBundle) => {
      let count = 0;
      basketItems.forEach((item) => {
        if (productBundle.productCodes.includes(item.product.code)) {
          count += item.quantity;
        }
      });
      if (count >= productBundle.quantity) {
        const discountPrice = -Math.floor(count / productBundle.quantity) * productBundle.discount;
        const discountItem = {
          product: {
            abbr: '',
            code: '',
            kana: '',
            name: productBundle.name,
            hidden: false,
            costPrice: null,
            avgCostPrice: null,
            sellingPrice: discountPrice,
            stockTaxClass: null,
            sellingTaxClass: productBundle.sellingTaxClass,
            stockTax: null,
            sellingTax: productBundle.sellingTax,
            selfMedication: false,
            supplierRef: null,
            categoryRef: null,
            note: '',
          },
          division: OTC_DIVISION,
          outputReceipt: true,
          quantity: 1,
        };
        const existingIndex = basketItems.findIndex((item) => item.product.name === productBundle.name);
        if (existingIndex >= 0) {
          basketItems.splice(existingIndex, 1, discountItem);
        } else {
          basketItems.push(discountItem);
        }
      }
    });
    return basketItems;
  };

  const updateProductTextSearch = async () => {
    const productCounter = counters.products;
    if (productCounter.searchUpdatedAt && productCounter.searchUpdatedAt > productFullTextSearch.updatedAt) {
      const snap = await getDoc(doc(db, 'searches', 'products'));
      const searchItem = snap.data();
      if (searchItem) {
        const blob = searchItem.blob as Bytes;
        const json = decodeURIComponent(zlib.unzipSync(Buffer.from(blob.toUint8Array())));
        const texts: string[] = JSON.parse(json);
        const fullTextSearch = { texts, updatedAt: productCounter.searchUpdatedAt };
        setProductFullTextSearch(fullTextSearch);
        console.log('updated fullTextSearch');
        return fullTextSearch;
      }
    }
    return productFullTextSearch;
  };

  const loadProductOptions = async (inputText: string) => {
    const text = hiraToKana(inputText).trim();
    const isNumber = text.match(/^\d+$/);
    // 数字で3文字以下、数字以外で1文字以下だと空を返す
    if ((isNumber && text.length < 3) || (!isNumber && text.length < 1)) {
      return [];
    }

    const fullTextSearch = await updateProductTextSearch();
    const texts = fullTextSearch.texts;
    const targetWords = texts.filter((word) => hiraToKana(word).indexOf(text) >= 0);
    return targetWords.map((word) => {
      const words = word.split('|');
      return { label: words[1], value: words[0] };
    });
  };

  const searchProducts = async (inputText: string, maxSearch = 50) => {
    const text = hiraToKana(inputText).trim();
    if (text) {
      const conds: QueryConstraint[] = [];
      const isNumber = text.match(/^\d+$/);
      if (isNumber) {
        conds.push(orderBy('code'));
      } else {
        conds.push(orderBy('name'));
      }
      conds.push(startAt(text));
      conds.push(endAt(text + '\uf8ff'));
      conds.push(limit(maxSearch));
      const q = query(collection(db, 'products'), ...conds);
      const snapshot = (await getDocs(q)) as QuerySnapshot<Product>;
      const products = snapshot.docs.map((item) => item.data());
      if (!isNumber && products.length < maxSearch) {
        const productCodes = products.map((product) => product.code);
        const fullTextSearch = await updateProductTextSearch();
        const texts = fullTextSearch.texts;
        const targetWords = texts.filter((word) => hiraToKana(word).indexOf(text) >= 0);
        const codes = targetWords
          .map((word) => {
            return { word: word.split('|')[0], index: hiraToKana(word).indexOf(text) };
          })
          .filter((item) => !productCodes.includes(item.word))
          .sort((item1, item2) => item1.index - item2.index)
          .map((item) => item.word)
          .slice(0, 10);
        if (codes.length > 0) {
          const conds2: QueryConstraint[] = [];
          conds2.push(where('code', 'in', codes));
          const q = query(collection(db, 'products'), ...conds2);
          const snapshot = (await getDocs(q)) as QuerySnapshot<Product>;
          const pds = snapshot.docs.map((item) => item.data());
          products.push(...pds);
        }
      }
      return [...products.filter((item) => !item.hidden), ...products.filter((item) => item.hidden)];
    }
    return [];
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentShop,
        counters,
        suppliers,
        shops,
        productBundles,
        productBulks,
        fixedCostRates,
        role,
        addBundleDiscount,
        loadProductOptions,
        searchProducts,
        registListner,
        incrementStock,
        getProductPrice,
        getProductCostPrice,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
export default AppContext;
