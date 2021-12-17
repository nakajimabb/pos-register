import React, { useState, useEffect, useContext, createContext } from 'react';

import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot, Timestamp } from 'firebase/firestore';
import { getAuth, User, onAuthStateChanged } from 'firebase/auth';
import { userCodeFromEmail } from './tools';
import { Shop, ProductFullTextSearch, CounterItem, Counters } from './types';

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

export const AppContextProvider: React.FC = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [productFullTextSearch, setProductFullTextSearch] = useState<ProductFullTextSearch | null>(null);
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
    if (
      !productFullTextSearch ||
      (productCounter.searchUpdatedAt &&
        productFullTextSearch.updatedAt &&
        productCounter.searchUpdatedAt > productFullTextSearch.updatedAt)
    ) {
      const fullTextSearch: ProductFullTextSearch = {
        productCode: [],
        productName: [],
        updatedAt: productCounter.searchUpdatedAt,
      };

      const snap = await getDocs(collection(db, 'searches'));
      snap.docs.forEach((item) => {
        if (item.id === 'productCode' || item.id === 'productName') {
          const search = item.data();
          fullTextSearch[item.id] = search.words;
        }
      });
      setProductFullTextSearch(fullTextSearch);
      console.log('updated fullTextSearch');
      console.log({ fullTextSearch });

      return fullTextSearch;
    } else {
      return productFullTextSearch;
    }
  };

  const loadProductOptions = async (inputText: string) => {
    inputText = inputText.trim();
    const isNumber = inputText.match(/^\d+$/);
    // 数字3文字以下、数字以外２文字以下だと空を返す
    if ((isNumber && inputText.length < 3) || (!isNumber && inputText.length < 2)) {
      return [];
    }

    const fullTextSearch = await updateProductTextSearch();
    const words = isNumber ? fullTextSearch.productCode : fullTextSearch.productName;
    const targetWords = words.filter((word) => word.indexOf(inputText) >= 0);
    return targetWords.map((word) => ({ label: word, value: word }));
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
