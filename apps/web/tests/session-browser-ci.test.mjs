import { test } from 'node:test';

// 既存Application CIの npm test から呼ぶ。ローカル・Dockerにブラウザを要求しない。
// 個別実行は npm run test:browser。未実行をPASSに見せずskipとして知らせる。
if (process.env.GITHUB_ACTIONS === 'true') {
  await import('./session-cache.browser-check.mjs');
} else {
  test('session browser regression: run test:browser explicitly outside GitHub Actions', {
    skip: 'requires an installed browser; run npm run test:browser --workspace=@futureroi/web',
  }, () => {});
}
