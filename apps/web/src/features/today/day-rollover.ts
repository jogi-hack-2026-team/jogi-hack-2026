/**
 * Goal の timezone での暦日（YYYY-MM-DD）。端末の timezone ではなく、API が「今日」を決めるのと同じ Goal の timezone で数える。
 * 不正な timezone では null（日付の切り替わりを検出しない）。
 */
import { localDateIn } from '../../calendar.ts';
export { localDateIn } from '../../calendar.ts';

/**
 * 画面が表示している「今日」から、Goal の timezone で日付が変わったか（変わっていれば新しい日付）。
 * 取り直したのに API の「今日」がまだ前日のまま（端末の時計がサーバーより少し進んでいる）こともあるので、
 * 「取り直しを始めた」ことでは止めず、API の日付が進んで表示の「今日」が変わるまで、確かめるたびに取り直す。
 */
export function shouldRefetchForNewDay(timezone: string, shownToday: string, now: Date): string | null {
  const current = localDateIn(timezone, now);
  if (current === null || current <= shownToday) return null;
  return current;
}
