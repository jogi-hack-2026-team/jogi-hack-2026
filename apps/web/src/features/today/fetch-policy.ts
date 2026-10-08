/**
 * Today 画面の取得のやり方（TanStack Query v5）。失敗した取得を自動でやり直す場面を、次のとおり決めている。
 *
 * - 失敗の直後（retry）：やり直さない。通信エラーや404をすぐ表示し、「再読み込み」ボタンで取り直す。
 * - 画面に戻ったとき（focus）：失敗した取得はやり直さない。データのないまま失敗した取得をやり直すと
 *   「読み込み中」に戻るため、何もしていないのにエラーや「Goalが見つかりません」が一瞬消えてしまう。
 *   成功している取得は、最新にするためにやり直す。
 * - 開き直したとき（mount）：やり直す。別の Goal から戻るなど、利用者が自分で画面を開き直した操作のため。
 * - 通信が戻ったとき（reconnect）：やり直す。通信エラーから、ボタンを押さなくても復帰できるようにするため。
 */
export const fetchPolicy = {
  retry: false,
  refetchOnWindowFocus: (query: { state: { status: string } }) => query.state.status !== 'error',
  retryOnMount: true,
  refetchOnReconnect: true,
} as const;
