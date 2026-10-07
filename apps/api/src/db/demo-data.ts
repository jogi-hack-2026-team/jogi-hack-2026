// #82の合成入力。元のEngine fixtureの2パターン・実績量を保持し、現在時計とDBから独立させる。
import type { PredictionInput } from '@futureroi/prediction';
import { isCalendarDate, isValidTimeZone, localDateIn } from '../goals/local-date.ts';

export type DemoSlot = 'fast-resumption' | 'slow-resumption';
export type DemoSeedGoal = { slot: DemoSlot; timezone: string; recordStartDate: string; input: PredictionInput };

// DSTで24時間の長さが変わっても、移動するのは暦日。西暦1〜99も1900年代へ変換しない。
function shifted(localDate: string, offset: number): string {
  const date = new Date(0);
  date.setUTCFullYear(Number(localDate.slice(0, 4)), Number(localDate.slice(5, 7)) - 1, Number(localDate.slice(8, 10)) + offset);
  const result = `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  if (!isCalendarDate(result)) throw new RangeError('合成履歴が有効な暦日の範囲を超えています');
  return result;
}

/** 同じ固定時刻・timezoneから同じ2履歴を返す。runtimeに含まれないexamplesはimportしない。 */
export function createDemoSeedData(instant: Date, timezone: string): DemoSeedGoal[] {
  if (!Number.isFinite(instant.getTime())) throw new RangeError('基準時刻が不正です');
  if (instant.getUTCFullYear() < 1 || instant.getUTCFullYear() > 9999) throw new RangeError('基準時刻が暦日の範囲外です');
  if (!isValidTimeZone(timezone)) throw new RangeError('timezoneが不正です');
  const era = new Intl.DateTimeFormat('en-US', { timeZone: timezone, era: 'short' }).formatToParts(instant).find(part => part.type === 'era')?.value;
  if (era !== 'AD') throw new RangeError('基準日が暦日の範囲外です');
  // ICUは4桁未満のyearを0埋めしないため、generatorのYYYY-MM-DDへ揃える。
  const today = localDateIn(instant, timezone).replace(/^(\d{1,4})-/, (_, year: string) => `${year.padStart(4, '0')}-`);
  if (!isCalendarDate(today)) throw new RangeError('基準日が不正です');
  const dates = Array.from({ length: 30 }, (_, index) => shifted(today, index - 31));
  const start = dates[0];
  if (!start) throw new Error('合成履歴の開始日がありません');
  const patterns: { slot: DemoSlot; done: (index: number) => boolean }[] = [
    { slot: 'fast-resumption', done: index => index % 2 === 0 },
    { slot: 'slow-resumption', done: index => index < 15 },
  ];
  return patterns.map(({ slot, done }) => ({ slot, timezone, recordStartDate: start, input: {
    goal: { totalRequired: 60, initialProgress: 0, sessionAmount: 1 }, today,
    // 保存は基準日−31〜−2だけ。昨日はUNKNOWN、今日は未記録として通常APIから操作できる。
    logs: dates.map((localDate, index) => ({ localDate, status: done(index) ? 'DONE' : 'SKIPPED', amount: done(index) ? 1 : null })),
  } }));
}
