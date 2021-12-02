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

export const getAuthUserByCode = functions
  .region('asia-northeast1')
  .https.onCall(async (data) => {
    const f = async () => {
      try {
        const email = emailFromUserCode(data.uid);
        const userRecord = await auth.getUserByEmail(email);
        return { userRecord };
      } catch (error) {
        throw new functions.https.HttpsError(
          'unknown',
          'error in getAuthUser',
          error
        );
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
    throw new functions.https.HttpsError(
      'unknown',
      `KKBログイン情報が存在しません。`
    );
  }
};

export const updateShopsFromKKb = functions
  .region('asia-northeast1')
  .https.onCall(async () => {
    const f = async () => {
      try {
        await loginKkb();
        const url = KKB_URL + '/departments/valid_list';
        const params = '?only_login_user=true&except_lunar=true';
        const result = await client.fetch(url + params);
        const shops = JSON.parse(result.body);
        for await (const shop of shops) {
          await db
            .collection('shops')
            .doc(shop.code)
            .set({ ...shop, hidden: false });
        }
        return { shops: shops, result };
      } catch (error) {
        throw new functions.https.HttpsError(
          'unknown',
          'error in updateShopsFromKKb',
          error
        );
      }
    };
    return await f();
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
