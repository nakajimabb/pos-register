import { ProductCategory } from './types';
import { QuerySnapshot } from 'firebase/firestore';

export const MAIL_DOMAIN = '@ebondregister.com';

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
  const names: { [key: number]: string } = {
    0: '全国',
    1: '北海道',
    2: '青森県',
    3: '岩手県',
    4: '宮城県',
    5: '秋田県',
    6: '山形県',
    7: '福島県',
    8: '茨城県',
    9: '栃木県',
    10: '群馬県',
    11: '埼玉県',
    12: '千葉県',
    13: '東京都',
    14: '神奈川県',
    15: '新潟県',
    16: '富山県',
    17: '石川県',
    18: '福井県',
    19: '山梨県',
    20: '長野県',
    21: '岐阜県',
    22: '静岡県',
    23: '愛知県',
    24: '三重県',
    25: '滋賀県',
    26: '京都府',
    27: '大阪府',
    28: '兵庫県',
    29: '奈良県',
    30: '和歌山県',
    31: '鳥取県',
    32: '島根県',
    33: '岡山県',
    34: '広島県',
    35: '山口県',
    36: '徳島県',
    37: '香川県',
    38: '愛媛県',
    39: '高知県',
    40: '福岡県',
    41: '佐賀県',
    42: '長崎県',
    43: '熊本県',
    44: '大分県',
    45: '宮崎県',
    46: '鹿児島県',
    47: '沖縄県',
  };

  return names[code];
};

// カタカナをひらがなに変換
export const kanaToHira = (str: string) => {
  return str.replace(/[\u30a1-\u30f6]/g, function (match) {
    var chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
};

// ひらがなをカタカナに変換する
export const hiraToKana = (str: string) => {
  return str.replace(/[\u3041-\u3096]/g, function (match) {
    var chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
};

// 半角変換
export const toAscii = (str: string) => {
  const halfStr = str.replace(/[！-～]/g, (s) => {
    // 文字コードをシフト
    return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
  });

  // 文字コードシフトで対応できない文字の変換
  return halfStr
    .replace(/”/g, '"')
    .replace(/’/g, "'")
    .replace(/‘/g, '`')
    .replace(/￥/g, '\\')
    .replace(/　/g, ' ')
    .replace(/〜/g, '~')
    .replace(/[－−]/g, '-');
};

// 数値変換
export const toNumber = (str: string) => {
  const ret = toAscii(str).replace(/,/g, '');
  const num = ret ? parseInt(ret) : 0;
  return isNaN(num) ? 0 : num;
};

// JANコードのチェックデジット
export const checkDigit = (str: string) => {
  if (str.match(/^\d{8}$|^\d{13}$/)) {
    const jan = str.padStart(13, '0'); // 13桁
    const nums = Array.from(jan)
      .reverse()
      .map((i) => +i); // 逆順にして、数値の配列に変換
    const sum_evens = nums.filter((_, i) => i % 2 === 1).reduce((sum, i) => sum + i); // 偶数の桁の数字の和
    const sum_odds = nums
      .slice(1)
      .filter((_, i) => i % 2 === 1)
      .reduce((sum, i) => sum + i); // CD(0桁)を除く奇数の桁の数字の和
    const sum = 3 * sum_evens + sum_odds;
    return (10 - (sum % 10)) % 10 === nums[0]; // 合計数の下1桁の数字の補数（10から引いた数）がチェックデジット
  }
};

export const nameWithCode = (obj: { code: string; name: string }) => {
  let result = '';
  if ('name' in obj) result += obj['name'];
  if ('code' in obj) result += '(' + obj['code'] + ')';
  return result;
};

export const userCodeFromEmail = (email: string) => {
  const reg = new RegExp(`(.+)${MAIL_DOMAIN}`);
  const m = email.match(reg);
  if (m && m[1]) {
    return m[1];
  } else {
    return null;
  }
};

//日付から文字列に変換する関数
export const toDateString = (date: Date, format: string) => {
  let result = format;
  result = result.replace(/YYYY/g, String(date.getFullYear()).padStart(4, '0'));
  result = result.replace(/YY/g, String(date.getFullYear() - 2000).padStart(2, '0'));
  result = result.replace(/MM/g, String(date.getMonth() + 1).padStart(2, '0'));
  result = result.replace(/DD/g, String(date.getDate()).padStart(2, '0'));
  result = result.replace(/hh/g, String(date.getHours()).padStart(2, '0'));
  result = result.replace(/mm/g, String(date.getMinutes()).padStart(2, '0'));
  result = result.replace(/ss/g, String(date.getSeconds()).padStart(2, '0'));
  return result;
};

export const OTC_DIVISION = '5';
