import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as client from 'cheerio-httpcli';
import * as crypto from 'crypto';

admin.initializeApp();

const auth = admin.auth();
const db = admin.firestore();

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const MAIL_DOMAIN = '@ebondregister.com';
const KKB_URL = 'https://ebondkkb.com';

const emailFromUserCode = (userCode: string) => userCode + MAIL_DOMAIN;

const sleep = (msec: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(undefined);
    }, msec);
  });
};

const getDecryptedString = (encrypted: string, method: string, key: string, iv: string) => {
  const encryptedText = Buffer.from(encrypted, 'hex');
  const decipher = crypto.createDecipheriv(method, Buffer.from(key), Buffer.from(iv));
  const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
  return decrypted.toString();
};

export const getAuthUserByCode = functions.region('asia-northeast1').https.onCall(async (data) => {
  const f = async () => {
    try {
      const email = emailFromUserCode(data.uid);
      const userRecord = await auth.getUserByEmail(email);
      return { userRecord };
    } catch (error) {
      throw new functions.https.HttpsError('unknown', 'error in getAuthUser', error);
    }
  };
  return await f();
});

const loginKkb = async (waitTime = 1000) => {
  const snap = await db.collection('configs').doc('KKB_USER').get();
  const kkbUser = snap.data();
  const snapCrypto = await db.collection('configs').doc('CRYPTO_STRING').get();
  const crypt = snapCrypto.data();
  if (kkbUser && crypt && crypt.method && crypt.key && crypt.iv) {
    const uri = KKB_URL + '/users/sign_in';
    const result = await client.fetch(uri);
    await result.$('#new_user').submit({
      'user[login]': getDecryptedString(kkbUser.code, crypt.method, crypt.key, crypt.iv),
      'user[password]': getDecryptedString(kkbUser.password, crypt.method, crypt.key, crypt.iv),
    });
    if (waitTime > 0) await sleep(waitTime);
    return result;
  } else {
    throw new functions.https.HttpsError('unknown', `KKBログイン情報が存在しません。`);
  }
};

const logoutKkb = async () => {
  const uri = KKB_URL + '/users/sign_out';
  const result = await client.fetch(uri);
  return result;
};

export const updateShopsFromKKb = functions
  .runWith({ timeoutSeconds: 300 })
  .region('asia-northeast1')
  .https.onCall(async () => {
    const f = async () => {
      try {
        // KKBにログイン
        await loginKkb();

        // KKBから店舗情報を取得
        const url = KKB_URL + '/departments/valid_list';
        const params = '?only_login_user=true&except_lunar=true';
        const result = await client.fetch(url + params);
        const shops = JSON.parse(result.body);

        // KKBからログアウト
        await logoutKkb();

        // firesotre 更新
        const BATCH_UNIT = 100;
        const taskSize = Math.ceil(shops.length / BATCH_UNIT);
        const sequential = [...Array(taskSize).keys()];
        const tasks = sequential.map(async (i) => {
          const batch = db.batch();
          const sliced = shops.slice(i * BATCH_UNIT, (i + 1) * BATCH_UNIT);
          sliced.forEach((shop: any) => {
            const ref = db.collection('shops').doc(shop.code);
            batch.set(ref, { ...shop, hidden: false }, { merge: true });
          });
          return await batch.commit();
        });
        await Promise.all(tasks);

        return { shops: shops };
      } catch (error) {
        throw new functions.https.HttpsError('unknown', 'error in updateShopsFromKKb', error);
      }
    };
    return await f();
  });

export const getSequence = functions.region('asia-northeast1').https.onCall(async (data) => {
  const f = async () => {
    try {
      const nextNumber = await db.runTransaction(async (transaction) => {
        const sequenceRef = db.collection('sequences').doc(data.docId);
        const sequenceDoc = await transaction.get(sequenceRef);
        let currentNumber = 0;
        if (sequenceDoc.exists) {
          currentNumber = sequenceDoc.data()?.current as number;
        }
        const newNumber = currentNumber + 1;
        transaction.set(sequenceRef, { current: newNumber });
        return newNumber;
      });
      return nextNumber;
    } catch (error) {
      throw new functions.https.HttpsError('unknown', 'error in getSequence', error);
    }
  };
  return await f();
});

export const updateShopCounts = functions
  .region('asia-northeast1')
  .firestore.document('shops/{docId}')
  .onWrite((change) => {
    const FieldValue = admin.firestore.FieldValue;
    const countsRef = db.collection('counters').doc('shops');

    if (!change.before.exists) {
      // 登録時に件数をインクリメント
      return countsRef.update({ all: FieldValue.increment(1), lastUpdatedAt: FieldValue.serverTimestamp() });
    } else if (change.before.exists && !change.after.exists) {
      // 削除時に件数をデクリメント
      return countsRef.update({ all: FieldValue.increment(-1), lastUpdatedAt: FieldValue.serverTimestamp() });
    } else {
      return countsRef.update({ lastUpdatedAt: FieldValue.serverTimestamp() });
    }
  });

export const updateProductCounts = functions
  .region('asia-northeast1')
  .firestore.document('products/{docId}')
  .onWrite((change) => {
    const FieldValue = admin.firestore.FieldValue;
    const countsRef = db.collection('counters').doc('products');

    if (!change.before.exists) {
      // 登録時に件数をインクリメント
      return countsRef.update({ all: FieldValue.increment(1), lastUpdatedAt: FieldValue.serverTimestamp() });
    } else if (change.before.exists && !change.after.exists) {
      // 削除時に件数をデクリメント
      return countsRef.update({ all: FieldValue.increment(-1), lastUpdatedAt: FieldValue.serverTimestamp() });
    } else {
      return countsRef.update({ lastUpdatedAt: FieldValue.serverTimestamp() });
    }
  });

export const updateSupplierCounts = functions
  .region('asia-northeast1')
  .firestore.document('suppliers/{docId}')
  .onWrite((change) => {
    const FieldValue = admin.firestore.FieldValue;
    const countsRef = db.collection('counters').doc('suppliers');

    if (!change.before.exists) {
      // 登録時に件数をインクリメント
      return countsRef.update({ all: FieldValue.increment(1), lastUpdatedAt: FieldValue.serverTimestamp() });
    } else if (change.before.exists && !change.after.exists) {
      // 削除時に件数をデクリメント
      return countsRef.update({ all: FieldValue.increment(-1), lastUpdatedAt: FieldValue.serverTimestamp() });
    } else {
      return countsRef.update({ lastUpdatedAt: FieldValue.serverTimestamp() });
    }
  });
