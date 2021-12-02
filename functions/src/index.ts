import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as client from 'cheerio-httpcli';

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

const loginKkb = async () => {
  const snap = await db.collection('configs').doc('KKB_USER').get();
  const kkbUser = snap.data();
  if (kkbUser) {
    const uri = KKB_URL + '/users/sign_in';
    const result = await client.fetch(uri);
    await result.$('#new_user').submit({
      'user[login]': kkbUser.code,
      'user[password]': kkbUser.password,
    });
    return result;
  } else {
    throw new functions.https.HttpsError('unknown', `KKBログイン情報が存在しません。`);
  }
};

const sleep = (msec: number) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(undefined);
    }, msec);
  });
};

export const updateShopsFromKKb = functions
  .runWith({ timeoutSeconds: 300 })
  .region('asia-northeast1')
  .https.onCall(async () => {
    const f = async () => {
      try {
        // KKBにログイン
        await loginKkb();
        await sleep(5000);

        // KKBから店舗情報を取得
        const url = KKB_URL + '/departments/valid_list';
        const params = '?only_login_user=true&except_lunar=true';
        const result = await client.fetch(url + params);
        const shops = JSON.parse(result.body);

        // firesotre 更新
        const BATCH_UNIT = 100;
        const taskSize = Math.ceil(shops.length / BATCH_UNIT);
        const sequential = [...Array(taskSize).keys()];
        const tasks = sequential.map(async (i) => {
          const batch = db.batch();
          for await (const shop of shops.slice(i * BATCH_UNIT, (i + 1) * BATCH_UNIT)) {
            const snap = await db.collection('shops').doc(shop.code).get();
            batch.set(snap.ref, { ...shop, hidden: false });
          }
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

export const updateShopCounts = functions
  .region('asia-northeast1')
  .firestore.document('shops/{docId}')
  .onWrite((change) => {
    const FieldValue = admin.firestore.FieldValue;
    const countsRef = db.collection('shopCounts').doc('all');

    if (!change.before.exists) {
      // 登録時に件数をインクリメント
      return countsRef.update({ count: FieldValue.increment(1) });
    } else if (change.before.exists && !change.after.exists) {
      // 削除時に件数をデクリメント
      return countsRef.update({ count: FieldValue.increment(-1) });
    }
    return;
  });

export const updateProductCounts = functions
  .region('asia-northeast1')
  .firestore.document('products/{docId}')
  .onWrite((change) => {
    const FieldValue = admin.firestore.FieldValue;
    const countsRef = db.collection('productCounts').doc('all');

    if (!change.before.exists) {
      // 登録時に件数をインクリメント
      return countsRef.update({ count: FieldValue.increment(1) });
    } else if (change.before.exists && !change.after.exists) {
      // 削除時に件数をデクリメント
      return countsRef.update({ count: FieldValue.increment(-1) });
    }
    return;
  });

export const updateSupplierCounts = functions
  .region('asia-northeast1')
  .firestore.document('suppliers/{docId}')
  .onWrite((change) => {
    const FieldValue = admin.firestore.FieldValue;
    const countsRef = db.collection('supplierCounts').doc('all');

    if (!change.before.exists) {
      // 登録時に件数をインクリメント
      return countsRef.update({ count: FieldValue.increment(1) });
    } else if (change.before.exists && !change.after.exists) {
      // 削除時に件数をデクリメント
      return countsRef.update({ count: FieldValue.increment(-1) });
    }
    return;
  });

export const createSale = functions.region('asia-northeast1').https.onCall(async (data) => {
  const f = async () => {
    try {
      await db.runTransaction(async (transaction) => {
        const items = data.items as Array<any>;
        const sale = {
          code: '05',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          detailsCount: items.length,
          salesTotal: items.reduce((result, item) => result + Number(item.price) * item.quantity, 0),
          taxTotal: 0,
          discountTotal: 0,
          paymentType: 'Cash',
          cashAmount: data.cash,
          salesNormalTotal: 0,
          salesReductionTotal: 0,
          taxNormalTotal: 0,
          taxReductionTotal: 0,
          status: 'Sales',
        };
        const saleRef = db.collection('sales').doc();
        transaction.set(saleRef, sale);

        items.map(async (item, index) => {
          const detail = {
            salesId: saleRef.id,
            index: index,
            productCode: item.code,
            price: Number(item.price),
            quantity: item.quantity,
            discount: 0,
            taxRate: 0,
            status: 'Sales',
          };
          const detailRef = db.collection('sales').doc(saleRef.id).collection('saleDetails').doc(index.toString());
          transaction.set(detailRef, detail);
        });
      });
    } catch (error) {
      throw new functions.https.HttpsError('unknown', 'error in createSale', error);
    }
  };
  return await f();
});
