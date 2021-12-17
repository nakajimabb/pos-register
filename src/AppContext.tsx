import React, { useState, useEffect, useContext, createContext } from 'react';

import { collection, doc, getDoc, getFirestore, onSnapshot, Timestamp, Bytes } from 'firebase/firestore';
import { getAuth, User, onAuthStateChanged } from 'firebase/auth';
import { userCodeFromEmail } from './tools';
import { Shop, CounterItem, Counters } from './types';

const zlib = require('zlib');

const db = getFirestore();
const auth = getAuth();

export type ContextType = {
  currentUser: User | null;
  currentShop: Shop | null;
  counters: Counters | null;
  loadProductOptions: (inputText: string) => Promise<{ label: string; value: string }[]>;
};

const AppContext = createContext({
  currentUser: null,
  currentShop: null,
  counters: null,
  loadProductOptions: async (inputText: string) => [],
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
    console.log('...start realtime listener about counters.');
    return () => unsubscribe();
  }, []);

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
        loadProductOptions,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
export default AppContext;
