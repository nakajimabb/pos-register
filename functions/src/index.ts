import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

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

export const updateCountProducts = functions
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
