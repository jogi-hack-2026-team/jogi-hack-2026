import { appCopy } from '../../copy/app.ts';

/**
 * タブ（ブラウザ）のタイトル。React 19 は描画した <title> を <head> へ移すので、画面ごとに置くだけでよい。
 * 画面を移ったことがタブとスクリーンリーダーの両方で分かるよう、画面の名前を先に出す。
 */
export function PageTitle({ title }: { title?: string | undefined }) {
  return <title>{appCopy.pageTitle(title)}</title>;
}
