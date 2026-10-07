/**
 * Goal の timezone での暦日（YYYY-MM-DD）。端末の timezone ではなく、API が「今日」を決めるのと同じ Goal の timezone で数える。
 * 不正な timezone では null（日付の切り替わりを検出しない）。
 */
export function localDateIn(timezone: string, at: Date): string | null {
  try {
    // en-CA は YYYY-MM-DD の並びで出る
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return null;
  }
}

/**
 * 画面が表示している「今日」から、Goal の timezone で日付が変わったか。
 * 変わった日付ごとに1回だけ取り直すよう、取り直しを始めた日付（triggeredFor）と比べる。
 */
export function shouldRefetchForNewDay(timezone: string, shownToday: string, now: Date, triggeredFor: string | null): string | null {
  const current = localDateIn(timezone, now);
  if (current === null || current === shownToday || current === triggeredFor) return null;
  return current;
}
