import React, { useState, useEffect, useContext, createContext } from 'react';

import { collection, doc, getDoc, getFirestore, onSnapshot, Timestamp, Bytes } from 'firebase/firestore';
import { getAuth, User, onAuthStateChanged } from 'firebase/auth';
import { userCodeFromEmail } from './tools';
import { Supplier, Shop, CounterItem, Counters, Product, ProductBundle } from './types';

const zlib = require('zlib');

const db = getFirestore();
const auth = getAuth();

export type ContextType = {
  currentUser: User | null;
  currentShop: Shop | null;
  counters: Counters | null;
  productBundles: ProductBundle[];
  suppliers: { [code: string]: Supplier } | null;
  addBundleDiscount: (basketItems: BasketItem[]) => BasketItem[];
  loadProductOptions: (inputText: string) => Promise<{ label: string; value: string }[]>;
  registListner: (name: 'suppliers') => void;
};

const AppContext = createContext({
  currentUser: null,
  currentShop: null,
  counters: null,
  suppliers: null,
  productBundles: [],
  addBundleDiscount: (basketItems: BasketItem[]) => basketItems,
  loadProductOptions: async (inputText: string) => [],
  registListner: (name: 'suppliers') => {},
} as ContextType);

type FullTextSearch = {
  texts: string[];
  updatedAt: Timestamp;
};

type BasketItem = {
  product: Product;
  quantity: number;
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
  const [suppliers, setSuppliers] = useState<{ [code: string]: Supplier }>({});
  const [listeners, setListeners] = useState<{ suppliers: boolean }>({ suppliers: false });

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

  const registListner = (name: 'suppliers') => {
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
            stockTax: productBundle.sellingTax,
            sellingTax: 8,
            selfMedication: false,
            supplierRef: null,
            categoryRef: null,
            note: '',
          },
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
    inputText = inputText.trim();
    const isNumber = inputText.match(/^\d+$/);
    // 数字で3文字以下、数字以外で1文字以下だと空を返す
    if ((isNumber && inputText.length < 3) || (!isNumber && inputText.length < 1)) {
      return [];
    }

    const fullTextSearch = await updateProductTextSearch();
    const texts = fullTextSearch.texts;
    const targetWords = texts.filter((word) => word.indexOf(inputText) >= 0);
    return targetWords.map((word) => {
      const words = word.split('|');
      return { label: words[1], value: words[0] };
    });
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        currentShop,
        counters,
        suppliers,
        productBundles,
        addBundleDiscount,
        loadProductOptions,
        registListner,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
export default AppContext;
