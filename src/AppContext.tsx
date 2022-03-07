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
  QueryConstraint,
  QuerySnapshot,
  Timestamp,
  where,
} from 'firebase/firestore';
import { getAuth, User, onAuthStateChanged } from 'firebase/auth';
import { userCodeFromEmail, OTC_DIVISION, hiraToKana } from './tools';
import {
  Product,
  Supplier,
  Shop,
  CounterItem,
  Counters,
  ProductBundle,
  ProductBulk,
  BasketItem,
  FixedCostRate,
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
  suppliers: { [code: string]: Supplier } | null;
  shops: { [code: string]: Shop } | null;
  addBundleDiscount: (basketItems: BasketItem[]) => BasketItem[];
  loadProductOptions: (inputText: string) => Promise<{ label: string; value: string }[]>;
  searchProducts: (inputText: string) => Promise<Product[]>;
  registListner: (name: 'suppliers' | 'shops') => void;
};

const AppContext = createContext({
  currentUser: null,
  currentShop: null,
  counters: null,
  suppliers: null,
  shops: null,
  productBundles: [],
  productBulks: [],
  fixedCostRates: [],
  addBundleDiscount: (basketItems: BasketItem[]) => basketItems,
  loadProductOptions: async (inputText: string) => [],
  searchProducts: async (inputText: string) => [],
  registListner: (name: 'suppliers' | 'shops') => {},
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
  const [suppliers, setSuppliers] = useState<{ [code: string]: Supplier }>({});
  const [shops, setShops] = useState<{ [code: string]: Shop }>({});
  const [listeners, setListeners] = useState<{ suppliers: boolean; shops: boolean }>({
    suppliers: false,
    shops: false,
  });

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setCurrentShop(null);
      if (user && user.email) {
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
        const suppliersData: { [code: string]: Supplier } = {};
        snapshot.docs.forEach((doc) => {
          suppliersData[doc.id] = doc.data() as Supplier;
        });
        setSuppliers(suppliersData);
      });
      console.log('...start realtime listener on suppliers.');
      return () => unsubscribe();
    }
  }, [listeners.suppliers]);

  useEffect(() => {
    if (listeners.shops) {
      const unsubscribe = onSnapshot(collection(db, 'shops'), (snapshot) => {
        const shopsData: { [code: string]: Shop } = {};
        snapshot.docs.forEach((doc) => {
          shopsData[doc.id] = doc.data() as Shop;
        });
        setShops(shopsData);
      });
      console.log('...start realtime listener on shops.');
      return () => unsubscribe();
    }
  }, [listeners.shops]);

  const registListner = (name: 'suppliers' | 'shops') => {
    setListeners((prev) => ({ ...prev, [name]: true }));
  };

  const addBundleDiscount = (basketItems: BasketItem[]) => {
    let filteredBasketItems = basketItems.filter(
      (item) => !productBundles.map((bundle) => bundle.name).includes(item.product.name)
    );
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
        filteredBasketItems.push(discountItem);
      }
    });
    return filteredBasketItems;
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
        addBundleDiscount,
        loadProductOptions,
        searchProducts,
        registListner,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
export default AppContext;
