// 画面の外側（タイトル・アカウント・404・エラー・読込中）とログイン・新規登録の文言（デザインキャンバス A1〜A5・B-account・B-notfound・B-error）。

export const appCopy = {
  name: 'Future ROI',
  tagline: '今日サボると、ゴールは何日遠ざかる？',
  /** タブ（ブラウザ）のタイトル。画面の名前の後にアプリ名を付ける。 */
  pageTitle: (page?: string) => (page ? `${page} | Future ROI` : 'Future ROI'),
  loading: '読み込んでいます',
  account: {
    open: 'アカウント',
    title: 'アカウント',
    signedInAs: 'ログイン中',
    logout: 'ログアウト',
    loggingOut: 'ログアウトしています…',
    close: '閉じる',
  },
  notFound: {
    title: 'ページが見つかりません',
    panel: 'このページは開けません',
    body: 'URLが正しいか確認してください。Goal一覧から開き直せます。',
    back: 'Goal一覧へ戻る',
  },
  error: {
    unreachableTitle: '接続できませんでした',
    unreachable: '通信に失敗しました。Goalや記録が消えたわけではありません。通信状態を確認して、もう一度お試しください。',
    title: '画面を表示できませんでした',
    body: '予期しない問題が起きました。Goalや記録が消えたわけではありません。再読み込みしてください。',
    retry: '再読み込み',
  },
} as const;

export const authCopy = {
  tabs: 'ログインまたは新規登録',
  login: 'ログイン',
  register: '新規登録',
  email: 'メールアドレス',
  password: 'パスワード',
  showPassword: 'パスワードを表示',
  hidePassword: 'パスワードを隠す',
  passwordHelp: '8文字以上で入力してください',
  submit: { login: 'ログイン', register: '登録する' },
  sending: { login: 'ログインしています…', register: '登録しています…' },
  summary: (n: number) => `${n}つの項目を確認してください`,
  emailRequired: 'メールアドレスを入力してください',
  emailInvalid: 'メールアドレスの形式で入力してください（例：name@example.com）',
  passwordRequired: 'パスワードを入力してください',
  passwordShort: 'パスワードは8文字以上で入力してください',
  waitTitle: 'しばらく待ってからお試しください',
  waitBody: (action: string, minutes: number, clock: string) =>
    `${action}の試行が続いたため、一時的に受け付けを止めています。約${minutes}分後（${clock}ごろ）から、もう一度${action}できます。`,
  waitButton: (clock: string, action: string) => `${clock}から${action}できます`,
  expired: 'ログインの有効期限が切れました。もう一度ログインすると、開いていた画面に戻ります。',
} as const;
