// Goalのtimezoneでの暦日。Engineは時計を読まないため、API層がここで「今日」を決めて渡す。

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = dateFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dateFormatters.set(timeZone, f);
  }
  return f;
}

// 有効なIANA名だけを受け付ける。ICUは略称（"JST"）や固定オフセット（"+09:00"）も解決するが、IANA名ではないので拒否する。
// IANA名は「地域/都市」（Asia/Tokyo、Etc/GMT+9等）か "UTC" の形。ICUの版差（supportedValuesOfの収録差）に依存しない判定にする。
const IANA_NAME = /^(UTC|[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)+)$/;

export function isValidTimeZone(timeZone: string): boolean {
  if (!IANA_NAME.test(timeZone)) return false;
  try {
    const resolved = new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
    return !/^[+-]/.test(resolved);
  } catch {
    return false;
  }
}

/** `instant`をtimezoneの暦日（YYYY-MM-DD）にする。 */
export function localDateIn(instant: Date, timeZone: string): string {
  const parts = formatter(timeZone).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** 実在する暦日（YYYY-MM-DD）か。2026-02-30のような日付は拒否する。 */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = month === 2 && leap ? 29 : DAYS_IN_MONTH[month - 1];
  return year >= 1 && month >= 1 && month <= 12 && days !== undefined && day >= 1 && day <= days;
}

/** 暦日に日数を足す（timezoneに依存しないUTCの日付演算）。昨日は`shiftLocalDate(today, -1)`。 */
export function shiftLocalDate(localDate: string, days: number): string {
  const [y, m, d] = localDate.split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}
