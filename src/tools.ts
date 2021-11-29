import { ProductCategory } from './types';
import { QuerySnapshot } from 'firebase/firestore';

export const sortedProductCategories = (snapshot: QuerySnapshot<ProductCategory>) => {
  const flatten = (
    id: string,
    childrenIds: Map<string, string[]>,
    categories: Map<string, ProductCategory>,
    result: { id: string; productCategory: ProductCategory }[]
  ) => {
    const ids = childrenIds.get(id);
    const productCategory = categories.get(id);
    if (productCategory) result.push({ id, productCategory });
    if (ids) {
      ids.forEach((id) => {
        flatten(id, childrenIds, categories, result);
      });
    }
    return result;
  };

  const childrenIds = new Map<string, string[]>(); // parent_id, child_ids
  const categories = new Map<string, ProductCategory>(); // id, ProductCategory
  snapshot.docs.forEach((doc, i) => {
    const productCategory = doc.data();
    const docId = doc.id;
    const parentRef = productCategory.parentRef;
    const parentId = parentRef ? parentRef.id : '';
    const tmp = childrenIds.get(parentId);
    const ids = tmp ? tmp : [];
    ids.push(docId);
    categories.set(docId, productCategory);
    childrenIds.set(parentId, ids);
  });

  return flatten('', childrenIds, categories, []);
};

export const prefectureName = (code: number) => {
  const names: {[key: number]: string} = 
{ 0: '全国', 1: '北海道', 2: '青森県', 3: '岩手県', 4: '宮城県', 5: '秋田県',
  6: '山形県', 7: '福島県', 8: '茨城県', 9: '栃木県', 10: '群馬県',
  11: '埼玉県', 12: '千葉県', 13: '東京都', 14: '神奈川県', 15: '新潟県',
  16: '富山県', 17: '石川県', 18: '福井県', 19: '山梨県', 20: '長野県',
  21: '岐阜県', 22: '静岡県', 23: '愛知県', 24: '三重県', 25: '滋賀県',
  26: '京都府', 27: '大阪府', 28: '兵庫県', 29: '奈良県', 30: '和歌山県',
  31: '鳥取県', 32: '島根県', 33: '岡山県', 34: '広島県', 35: '山口県',
  36: '徳島県', 37: '香川県', 38: '愛媛県', 39: '高知県', 40: '福岡県',
  41: '佐賀県', 42: '長崎県', 43: '熊本県', 44: '大分県', 45: '宮崎県',
  46: '鹿児島県', 47: '沖縄県' };

  return names[code];
}

// カタカナをひらがなに変換
export const kanaToHira = (str: string) => {
  return str.replace(/[\u30a1-\u30f6]/g, function(match) {
      var chr = match.charCodeAt(0) - 0x60;
      return String.fromCharCode(chr);
  });
}

// ひらがなをカタカナに変換する
export const hiraToKana = (str: string) => {
  return str.replace(/[\u3041-\u3096]/g, function(match) {
      var chr = match.charCodeAt(0) + 0x60;
      return String.fromCharCode(chr);
  });
}
