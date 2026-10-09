// Goal の一覧・作成・編集・削除の画面（R-02、#78）の文言。デザインキャンバス「B案：画面と状態」のB・Cに合わせる。
// 文言を変えるときは、このファイルだけを直す。

export const goalsCopy = {
  appTitle: 'Future ROI',
  listTitle: 'あなたのGoal',
  /** デスクトップ幅の戻り先（デザイン Desk-create）。 */
  crumbList: 'Goal一覧',
  loading: 'Goalを読み込んでいます',
  loadingVisible: '読み込んでいます',
  add: 'Goalを追加',
  todayStatus: {
    DONE: '今日：やった',
    SKIPPED: '今日：休んだ',
    UNRECORDED: '今日：まだ記録していません',
  },
  /** 一覧の累計の進捗バーの読み上げ名（デザイン B-home）。 */
  progressLabel: (title: string) => `${title}の累計`,
  empty: {
    title: '最初のGoalをつくりましょう',
    body: '毎日1回、量で表せる行動を1つ登録します。記録がたまると、今日やらなかった場合にゴールが何日遠ざかるかの目安を表示します。',
    examples: '例：英単語アプリ（1回20分）、筋トレ（1回20回）、読書（1回30分）',
    action: '最初のGoalをつくる',
  },
  loadError: {
    title: 'Goalを読み込めませんでした',
    body: '通信に失敗しました。Goalや記録が消えたわけではありません。通信状態を確認して、もう一度お試しください。',
    serverBody: 'サーバーで問題が起きました。Goalや記録が消えたわけではありません。少し待ってから、もう一度お試しください。',
    retry: '再読み込み',
  },
  signedOut: {
    title: 'ログインが切れました',
    body: '続けるには、もう一度ログインしてください。',
    formBody: '保存されていません。入力内容はこの画面に残っています。別のタブでログインし直してから、もう一度保存してください。',
    action: 'ログインする',
  },
  notFound: {
    heading: 'Goalが見つかりません',
    title: 'このGoalは開けません',
    body: '削除されたか、このアカウントでは開けないGoalです。Goal一覧から開き直してください。',
    back: 'Goal一覧へ戻る',
  },
  form: {
    createTitle: 'Goalを作成',
    /** 初期質問の見出し（開閉の見出し。PR #120 の部品と同じ文言）。 */
    priorTitle: '最初の見通しを調整する（任意）',
    editTitle: 'Goalを編集',
    close: '閉じる',
    /** デスクトップ幅で、保存の横に置く取りやめ（スマートフォン幅の「×」の代わり。デザイン Desk-create・Desk-edit）。 */
    cancel: 'キャンセル',
    title: 'タイトル',
    unit: '単位',
    units: { minutes: '分', sessions: '回' },
    totalRequired: '投資すると決めた総量',
    sessionAmount: '1回の量',
    initialProgress: '記録開始日の前日までに終えた量',
    initialProgressHelp: (start: string) =>
      `記録開始日：${start}。この日以降の実績は日々の記録に入力してください。開始日前の分はこの累計に含め、日々の記録には追加しません`,
    initialProgressHelpNew: '記録開始日は、作成した日（選んだタイムゾーンでの今日）です。開始日前の分はこの累計に含め、日々の記録には追加しません',
    timezone: 'タイムゾーン',
    timezoneHelp: '「今日」「昨日」の区切りに使います',
    browserTimezone: (tz: string) => `${tz}（ブラウザの設定）`,
    lockedInitialProgress: '記録が1件以上あるため、初期量は変更できません。変えると、これまでの記録の日付や累計の計算がずれるためです。',
    lockedTimezone: '記録が1件以上あるため、タイムゾーンは変更できません。変えると、これまでの記録の日付や累計の計算がずれるためです。',
    save: '保存する',
    saveEdit: '変更を保存',
    saving: '保存しています…',
    noChanges: '変更はありません。',
    summary: (count: number) => `${count}つの項目を確認してください`,
    saveFailed: {
      title: '保存できませんでした',
      createBody: '作成結果を確認できませんでした。入力内容と作成操作は保持しています。もう一度保存すると、同じ操作の結果を確認します。',
      editBody: '変更はまだ保存されていません。入力内容はそのまま残っています。通信状態を確認して、もう一度お試しください。',
      retry: 'もう一度保存',
    },
    delete: 'このGoalを削除',
    // R-11 の初期質問（#137）。質問文・選択肢は PR #120 の QuestionPriorFields にある
    answersNotRecords: '回答は実績や記録には加えません',
    answersWithdrawn: '単位か1回の量を変えると、質問の回答は取り消されます。保存した後に、もう一度答えられます。',
    answersNotSavedWithContext: '単位か1回の量を変えるときは、質問の回答を一緒に保存できません。保存した後に、もう一度開いて答えられます。',
    answerConflict: {
      title: 'ほかの画面で内容が変わりました',
      body: '質問の回答や単位が、別の画面で変更されています。変更はまだ保存されていません。入力内容はそのまま残っています。最新の内容を読み込んでから、もう一度保存してください。',
      reload: '最新の内容を読み込む',
    },
    latestAnswers: (a: string, b: string) =>
      `最新の回答は、取り組めた日の翌日：「${a}」、休んだ日の翌日：「${b}」です。入力中の回答で上書きする場合は、確かめてからもう一度保存してください。`,
    answerLabels: { LOW: '少なかった', MID: '半分くらい', HIGH: '多かった', UNKNOWN: '経験がない・思い出せない', none: '回答しない' },
    refreshFailed: {
      title: '最新のGoalを読み込めませんでした',
      body: '入力内容はそのまま残っています。通信状態を確認して、再読み込みしてください。保存はこのままできます。',
      conflictBody: '入力内容はそのまま残っています。最新の内容を取得できるまで、変更は保存できません。通信状態を確認して、再読み込みしてください。',
      notFound: 'このGoalは、別の画面で削除された可能性があります。入力内容は残っていますが、保存はできません。Goal一覧から開き直してください。',
    },
  },
  errors: {
    titleRequired: 'タイトルを入力してください',
    titleTooLong: '100文字以内で入力してください',
    positiveInteger: '1以上の整数を入力してください',
    nonNegativeInteger: '0以上の整数を入力してください',
    tooLarge: '大きすぎる数です',
    timezone: '有効なタイムゾーンを選んでください',
    locked: '記録が1件以上あるため変更できません',
    unitLocked: '過去の量や現在の初期量の意味を保つため、単位を変更できません。別単位は新しいGoalで始めてください。',
    server: '入力内容を確認してください',
  },
  deleteDialog: {
    title: 'Goalの削除',
    body: (title: string) => `「${title}」を削除すると、`,
    bodyStrong: 'これまでの記録もすべて消えます',
    irreversible: '削除したGoalと記録は元に戻せません。',
    confirm: '記録ごと削除する',
    cancel: 'キャンセル',
    failed: '削除できませんでした。Goalと記録は残っています。通信状態を確認して、もう一度お試しください。',
  },
} as const;
