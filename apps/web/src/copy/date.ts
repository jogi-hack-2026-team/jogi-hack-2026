// 日付の表示。基準日は API が返す today（Goal の timezone での暦日 YYYY-MM-DD）で、ブラウザの時計は使わない。
// 暦日だけを扱うので、UTC の日付として計算して時差の影響を受けないようにする。

const DAY_MS = 24 * 60 * 60 * 1000;

function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new TypeError(`Invalid local date: ${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** today に days 日を足した日。Engine の日数は「明日が1日目」。 */
export function addDays(today: string, days: number): Date {
  return new Date(parseLocalDate(today).getTime() + days * DAY_MS);
}

/** その日を含む週の月曜日。 */
export function mondayOf(date: Date): Date {
  const offset = (date.getUTCDay() + 6) % 7; // 月曜＝0
  return new Date(date.getTime() - offset * DAY_MS);
}

/** 「10月5日の週」。日数が null（3年を超える）なら null を返す。 */
export function weekLabel(today: string, days: number | null): string | null {
  if (days === null) return null;
  const monday = mondayOf(addDays(today, days));
  return `${monday.getUTCMonth() + 1}月${monday.getUTCDate()}日の週`;
}

/** 「10/5」。図の短いラベル用。 */
export function shortDate(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

/** 「10月5日（月）」。 */
export function longDate(value: string): string {
  const date = parseLocalDate(value);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getUTCDay()] ?? '';
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日（${weekday}）`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / DAY_MS);
}

export { parseLocalDate };
