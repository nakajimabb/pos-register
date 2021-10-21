// cloud Functions のエラー
export const httpsErrorMessage = (error: any): string | undefined => {
  // FunctionsErrorCode
  switch (error.code) {
    case 'ok':
      return error.message;
    case 'cancelled':
      return '操作はキャンセルされました。';
    case 'unknown':
      return '不明なエラーです。';
    case 'invalid-argument':
      return '不正な引数が渡されました。';
    case 'deadline-exceeded':
      return '操作が完了する前に期限が切れました。操作が正常に完了しても、このエラーが返されることがあります。';
    case 'not-found':
      return '要求されたドキュメントが見つかりませんでした。';
    case 'already-exists':
      return 'データを作成しようとしましたが、すでに存在します。';
    case 'permission-denied':
      return '指定された操作を実行する権限がありません。';
    case 'resource-exhausted':
      return 'リソース不足です。';
    case 'failed-precondition':
      return 'オペレーションは拒否されました。';
    case 'aborted':
      return 'オペレーションは中止されました。';
    case 'out-of-range':
      return '有効な範囲を超えています。';
    case 'unimplemented':
      return '操作は実装されていないか、サポートされていないか、有効ではありません。';
    case 'internal':
      return '内部的なエラー。';
    case 'unavailable':
      return 'このサービスは現在使用することができません。';
    case 'data-loss':
      return 'データが壊れています。';
    case 'unauthenticated':
      return '認証されていないユーザーです。';
  }
};

// Admin Authentication API エラー
// https://firebase.google.com/docs/auth/admin/errors?hl=ja
export const adminAuthenticationAPIMessage = (
  error: any
): string | undefined => {
  switch (error.code) {
    case 'auth/email-already-exists':
      // メールアドレス => 社員番号
      return '指定された社員番号はすでに既存のユーザーによって使用されています。';
    case 'auth/id-token-expired':
      return '指定された Firebase ID トークンは期限切れです。';
    case 'auth/id-token-revoked':
      return 'Firebase ID トークンが取り消されました。';
    case 'auth/insufficient-permission':
      return 'リソースにアクセスするための権限がありません。';
    case 'auth/internal-error':
      return 'リクエストの処理中に、予期しないエラーが発生しました。';
    case 'auth/invalid-creation-time':
      return '作成時刻は有効な UTC 日付文字列でなければなりません。';
    case 'auth/invalid-credential':
      return '認証情報は、目的のアクションの実行には使用できません。';
    case 'auth/invalid-disabled-field':
      return 'disabled に指定された値は無効です。';
    case 'auth/invalid-display-name':
      return 'displayName に指定された値は無効です。';
    case 'auth/invalid-email':
      return 'メールアドレスの形式が正しくありません。';
    case 'auth/invalid-email-verified':
      return 'emailVerified に指定された値は無効です。';
    case 'auth/invalid-id-token':
      return '指定された ID トークンは有効な Firebase ID トークンではありません。';
    case 'auth/invalid-last-sign-in-time':
      return '最終ログイン時間は、有効な UTC 日付文字列でなければなりません。';
    case 'auth/invalid-password':
      return '無効なパスワードです。8 文字以上の文字列を指定する必要があります。';
    case 'auth/invalid-phone-number':
      return '無効な携帯番号です。';
    case 'auth/invalid-uid':
      return 'uid は、128 文字以下の空でない文字列を指定する必要があります。';
    case 'auth/missing-uid':
      return '現在のオペレーションには uid 識別子が必要です。';
    case 'auth/operation-not-allowed':
      return '提供されたログイン プロバイダは Firebase プロジェクトで無効になっています。';
    case 'auth/phone-number-already-exists':
      return '携帯番号 はすでに既存のユーザーによって使用されています。';
    case 'auth/project-not-found':
      return 'Firebase プロジェクトが見つかりませんでした。';
    case 'auth/session-cookie-expired':
      return '提供された Firebase セッションの Cookie は期限切れです。';
    case 'auth/session-cookie-revoked':
      return 'Firebase セッション Cookie が取り消されました。';
    case 'auth/uid-already-exists':
      return '提供された uid はすでに既存のユーザーによって使用されています。';
    case 'auth/user-not-found':
      return 'ユーザーが存在しません。';
    case 'auth/wrong-password':
      return 'パスワードが間違っています。';
  }
};

// firebase.auth.Error
// https://firebase.google.com/docs/reference/js/firebase.auth.Error
export const authErrorMessage = (error: any): string | undefined => {
  switch (error.code) {
    case 'auth/too-many-requests':
      return 'リクエストがブロックされています。少し遅れて再試行すると、ブロックが解除されます。';
    case 'auth/user-disabled':
      return 'ユーザーアカウントが無効です。';
  }
};

// FirestoreErrorCode
// https://firebase.google.com/docs/reference/js/firebase.firestore
export const firestoreErrorMessage = (error: any): string | undefined => {
  // FirestoreErrorCode
  switch (error.code) {
    case 'cancelled':
      return '操作はキャンセルされました。';
    case 'deadline-exceeded':
      return '操作が完了する前に期限が切れました。操作が正常に完了しても、このエラーが返されることがあります。';
    case 'not-found':
      return '要求されたドキュメントが見つかりませんでした。';
    case 'permission-denied':
      return '指定された操作を実行する権限がありません。';
    case 'resource-exhausted':
      return 'リソース不足です。';
    case 'unimplemented':
      return '操作は実装されていないか、サポートされていないか、有効ではありません。';
    case 'internal':
      return '内部的なエラー。';
    case 'unauthenticated':
      return '認証されていないユーザーです。';
  }
};

const firebaseError = (error: any, defaultMessage: string = ''): string => {
  if (typeof error === 'string') return error;
  const err = error.details || error;
  // FunctionsErrorCode
  let message = httpsErrorMessage(err);
  if (message) return message;
  // Admin Authentication API Errors
  message = adminAuthenticationAPIMessage(err);
  if (message) return message;
  // firebase.auth.Error
  message = authErrorMessage(err);
  if (message) return message;
  // FirestoreErrorCode
  message = firestoreErrorMessage(err);
  if (message) return message;

  return err?.message || defaultMessage || 'エラーが発生しました。';
};

export default firebaseError;
