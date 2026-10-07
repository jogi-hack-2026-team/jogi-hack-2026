import { isValidTimeZone } from '../goals/local-date.ts';

// 操作対象は明示する。メール検索・既定user・未知／重複optionによる曖昧なresetを許さない。
export function parseDemoSeedArgs(args: readonly string[]): { userId: string; timezone: string } | null {
  if (args.length !== 4) return null;
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i], value = args[i + 1];
    if (!name || (name !== '--user-id' && name !== '--timezone') || !value || value !== value.trim() || values.has(name)) return null;
    values.set(name, value);
  }
  const userId = values.get('--user-id'), timezone = values.get('--timezone');
  return userId && timezone && isValidTimeZone(timezone) ? { userId, timezone } : null;
}
