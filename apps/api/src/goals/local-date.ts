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
