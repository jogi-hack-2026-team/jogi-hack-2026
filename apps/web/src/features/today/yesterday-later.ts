import type { Today } from '@contracts';

/**
 * 「昨日はどうでしたか？」を出すか。
 * 「後で答える」は、押したときの対象日（today.yesterday）だけに効かせる。日付が変われば、新しい対象日の問いかけを出す。
 * 別の Goal へ持ち越さないよう、TodayPage は Goal ごとに作り直す（key={goalId}）。
 */
export function showYesterdayPrompt(today: Pick<Today, 'yesterdayMissing' | 'yesterday'> | undefined, laterFor: string | null): boolean {
  return today?.yesterdayMissing === true && laterFor !== today.yesterday;
}
