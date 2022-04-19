import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as client from 'cheerio-httpcli';
import * as crypto from 'crypto';
import * as FTP from 'ftp';

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

// 日付から文字列に変換する関数
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

export const saveRole = functions.region('asia-northeast1').https.onCall(async ({ uid, role }, context) => {
  const f = async () => {
    try {
      if (!context.auth) throw Error('anonymouse user not authenticated.');

      const current = await admin.auth().getUser(context.auth.uid);
      if (current.customClaims?.role === 'admin') {
        const email = emailFromUserCode(uid);
        const userRecord = await auth.getUserByEmail(email);
        await auth.setCustomUserClaims(userRecord.uid, { role });

        const ref = db.collection('shops').doc(uid);
        await ref.set({ role }, { merge: true });

        return { userRecord: await auth.getUserByEmail(email) };
      } else {
        throw Error(`${role} user not authenticated.`);
      }
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

const createUserIfNotExist = async (email: string, password: string) => {
  try {
    const userRecord = await auth.getUserByEmail(email);
    return { result: false, userRecord };
  } catch (error) {
    try {
      const userParams = {
        email,
        disabled: false,
        password,
      };
      const userRecord = await auth.createUser(userParams);
      await auth.setCustomUserClaims(userRecord.uid, { role: 'shop' });
      return { result: true, userRecord };
    } catch (error) {
      return { result: false };
    }
  }
};

const updateShopsFromKKb = async () => {
  try {
    // KKBにログイン
    await loginKkb();

    // KKBから店舗情報を取得
    const url = KKB_URL + '/departments/valid_list';
    const day = toDateString(new Date(), 'YYYY-MM-DD');
    const params = `?day=${day}&only_login_user=true&except_lunar=true`;
    const resultKkb = await client.fetch(url + params);
    const shops = JSON.parse(resultKkb.body);

    // KKBからログアウト
    await logoutKkb();

    const BATCH_UNIT = 100;
    const taskSize = Math.ceil(shops.length / BATCH_UNIT);
    const sequential = [...Array(taskSize).keys()];

    // アカウント作成
    const createCodes: string[] = [];
    const tasks1 = sequential.map(async (i) => {
      const sliced = shops.slice(i * BATCH_UNIT, (i + 1) * BATCH_UNIT);
      for await (const shop of sliced) {
        const email = emailFromUserCode(shop.code);
        const result = await createUserIfNotExist(email, 'password');
        if (result.result) createCodes.push(shop.code);
      }
    });
    await Promise.all(tasks1);

    // firestore 更新
    const tasks2 = sequential.map(async (i) => {
      const batch = db.batch();
      const sliced = shops.slice(i * BATCH_UNIT, (i + 1) * BATCH_UNIT);
      sliced.forEach((shop: any) => {
        const ref = db.collection('shops').doc(shop.code);
        const p = { ...shop };
        // アカウントが新たに作成されたら権限をshopに設定
        if (createCodes.includes(shop.code)) {
          p.hidden = false;
          p.role = 'shop';
        }
        batch.set(ref, p, { merge: true });
      });
      return await batch.commit();
    });
    const results = await Promise.all(tasks2);
    return { shops, results };
  } catch (error) {
    throw new functions.https.HttpsError('unknown', 'error in updateShopsFromKKb', error);
  }
};

export const updateShops = functions
  .runWith({ timeoutSeconds: 540 })
  .region('asia-northeast1')
  .https.onCall(async () => {
    return await updateShopsFromKKb();
  });

exports.scheduledUpdateShops = functions
  .runWith({ timeoutSeconds: 540 })
  .region('asia-northeast1')
  .pubsub.schedule('0 0 * * *')
  .timeZone('Asia/Tokyo')
  .onRun(() => {
    updateShopsFromKKb();
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

export const updateProducts = functions
  .region('asia-northeast1')
  .firestore.document('products/{productCode}')
  .onUpdate(async (change, context) => {
    const f = async () => {
      try {
        const before = change.before.data();
        const after = change.after.data();
        const productCode = context.params.productCode;
        if (before && after && before.name != after.name) {
          // 店舗原価・売価・在庫
          for await (const docname of ['productCostPrices', 'productSellingPrices', 'stocks']) {
            const q = db.collectionGroup(docname).where('productCode', '==', productCode);
            const qsnap = await q.get();
            const batch = db.batch();
            qsnap.docs.forEach((dsnap) => batch.update(dsnap.ref, { productName: after.name }));
            await batch.commit();
          }
          // 店舗出庫・仕入・棚卸 (未登録商品のみ)
          if (before.unregistered) {
            for await (const docname of ['deliveryDetails', 'purchaseDetails', 'inventoryDetails']) {
              const q = db.collectionGroup(docname).where('productCode', '==', productCode);
              const qsnap = await q.get();
              const batch = db.batch();
              qsnap.docs.forEach((dsnap) => batch.update(dsnap.ref, { productName: after.name }));
              await batch.commit();
            }
          }
        }
      } catch (error) {
        throw new functions.https.HttpsError('unknown', 'error in createAccount', error);
      }
    };
    return await f();
  });

export const createAccount = functions
  .runWith({ timeoutSeconds: 300 })
  .region('asia-northeast1')
  .https.onCall(async (data) => {
    const f = async () => {
      try {
        const email = emailFromUserCode(data.uid);
        const userParams = {
          email,
          disabled: false,
          password: 'password',
        };
        const userRecord = await auth.createUser(userParams);
        await auth.setCustomUserClaims(userRecord.uid, { role: 'shop' });
        return { userRecord };
      } catch (error) {
        throw new functions.https.HttpsError('unknown', 'error in createAccount', error);
      }
    };
    return await f();
  });

export const sendDailyClosingData = functions
  .runWith({ timeoutSeconds: 300 })
  .region('asia-northeast1')
  .https.onCall(async (data) => {
    const f = async () => {
      try {
        let registerStatus: any = null;
        const statusRef = db.collection('shops').doc(data.code).collection('status');
        const statusSnap = await statusRef.orderBy('openedAt', 'desc').limit(1).get();
        if (statusSnap.size > 0) {
          statusSnap.docs.map(async (doc) => {
            registerStatus = doc.data();
          });
        }

        const COPAYMENT_HEALTH = '1';
        const MEDICINE_SALES = '2';
        const CONTAINER_COST = '3';
        const COPAYMENT_ADJUST = '4';
        const OTC = '5';
        const COPAYMENT_CARE = '7';
        const SEND_FEE_RETURN = '8';
        const PLASTIC_BAG = '9';
        const HEARING_AID = '10';

        const reportItemsData = {
          copayment_health: 0,
          medicine_sales: 0,
          container_cost: 0,
          copayment_care: 0,
          send_fee_return: 0,
          otc_normal: 0,
          otc_normal_tax: 0,
          otc_reduced: 0,
          otc_reduced_tax: 0,
          copayment_adjust: [] as [string, number][],
        };

        if (registerStatus) {
          const q = db
            .collection('sales')
            .where('shopCode', '==', data.code)
            .where('createdAt', '>=', registerStatus.openedAt.toDate())
            .where('createdAt', '<', registerStatus.closedAt.toDate())
            .orderBy('createdAt');
          const querySnapshot = await q.get();

          await Promise.all(
            querySnapshot.docs.map(async (doc) => {
              const sale = doc.data();

              const registerSign = sale.status === 'Return' ? -1 : 1;

              let creditTotal = 0;
              let priceNormalTotal = 0;
              let priceReducedTotal = 0;

              const detailsSnapshot = await db
                .collection('sales')
                .doc(doc.id)
                .collection('saleDetails')
                .orderBy('index')
                .get();
              detailsSnapshot.docs.forEach((detailDoc) => {
                const detail = detailDoc.data();
                const amount = Number(detail.product.sellingPrice) * detail.quantity * registerSign;
                switch (detail.division) {
                  case COPAYMENT_HEALTH:
                    reportItemsData['copayment_health'] += amount;
                    break;
                  case MEDICINE_SALES:
                    reportItemsData['medicine_sales'] += amount;
                    break;
                  case CONTAINER_COST:
                    reportItemsData['container_cost'] += amount;
                    break;
                  case COPAYMENT_ADJUST:
                    if (amount >= 0) {
                      reportItemsData['copayment_adjust'].push(['recovery', amount]);
                    } else {
                      reportItemsData['copayment_adjust'].push(['receivable', amount]);
                    }
                    break;
                  case OTC:
                    if (detail.product.sellingTax === 10) {
                      priceNormalTotal += amount;
                    } else if (detail.product.sellingTax === 8) {
                      priceReducedTotal += amount;
                    }
                    break;
                  case COPAYMENT_CARE:
                    reportItemsData['copayment_care'] += amount;
                    break;
                  case SEND_FEE_RETURN:
                    reportItemsData['send_fee_return'] += amount;
                    break;
                  case PLASTIC_BAG:
                    reportItemsData['container_cost'] += amount;
                    break;
                  case HEARING_AID:
                    reportItemsData['copayment_health'] += amount;
                    break;
                }
                creditTotal += amount;
              });

              reportItemsData['otc_normal'] += priceNormalTotal;
              reportItemsData['otc_reduced'] += priceReducedTotal;
              reportItemsData['otc_normal_tax'] += Math.floor((priceNormalTotal * 10) / 100);
              reportItemsData['otc_reduced_tax'] += Math.floor((priceReducedTotal * 8) / 100);
              if (sale.paymentType === 'Credit') {
                const taxNormalCreditTotal = Math.floor((priceNormalTotal * 10) / 100);
                const taxReducedCreditTotal = Math.floor((priceReducedTotal * 8) / 100);
                reportItemsData['copayment_adjust'].push([
                  'credit',
                  -(creditTotal + taxNormalCreditTotal + taxReducedCreditTotal),
                ]);
              }
            })
          );
        }

        const fileName = `${data.code}_${toDateString(new Date(data.date), 'YYYYMMDD')}.json`;
        const buffer = Buffer.from(JSON.stringify(reportItemsData));
        const ftpClient = new FTP();
        ftpClient.on('ready', () => {
          ftpClient.put(buffer, fileName, (err) => {
            if (err) throw err;
            ftpClient.end();
          });
        });

        const snap = await db.collection('configs').doc('FTP_SERVER').get();
        const ftpServer = snap.data();

        // FTPサーバーに送信
        if (ftpServer) {
          ftpClient.connect({
            host: ftpServer['address'],
            user: ftpServer['user'],
            password: ftpServer['password'],
          });
        }

        // KKBにログイン
        await loginKkb();

        const url = KKB_URL + '/daily_closings/trigger';
        const date = toDateString(new Date(data.date), 'YYYYMMDD');
        const params = `?date=${date}&code=${data.code}`;
        const result = client.fetchSync(url + params);

        // KKBからログアウト
        await logoutKkb();
        return result;
      } catch (error) {
        await logoutKkb();
        throw new functions.https.HttpsError('unknown', 'error in sendDailyClosingData', error);
      }
    };
    return await f();
  });
