// Process-level CLI stub for the runner integration test. Never used by the runner itself.
const { spawn: realSpawn } = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { dirname } = require('node:path');

const remoteFile = process.env.ML_AGENT_FAKE_REMOTE_FILE;
const logFile = process.env.ML_AGENT_FAKE_LOG_FILE;
if (!remoteFile || !logFile) throw new Error('Fake CLI files are required');

function record(exe, argv) {
  const remote = JSON.parse(readFileSync(remoteFile, 'utf8'));
  const operation = [exe, ...argv].join(' ');
  const log = JSON.parse(readFileSync(logFile, 'utf8'));
  log.push(operation);
  writeFileSync(logFile, JSON.stringify(log));
  const arg = (flag) => argv[argv.indexOf(flag) + 1];
  const issue = (number) => remote.issues.find((item) => item.number === Number(number));
  const store = () => writeFileSync(remoteFile, JSON.stringify(remote));
  let output = '';

  if (exe === 'git') {
    if (operation.includes('remote get-url origin')) output = 'https://github.com/example/ml.git';
    else if (operation.includes('branch --show-current')) output = 'main';
    else if (operation.includes('rev-parse origin/main') || operation.includes('merge-base origin/main HEAD')) output = 'base-sha';
    else if (operation.includes('rev-list --count')) output = '1';
    else if (operation.includes('log --format=%s')) output = 'feat: #40 合成評価を追加';
    else if (operation.includes('diff --name-only')) output = 'docs/ML/README.md';
    else if (argv[0] === 'worktree' && argv[1] === 'add') {
      const path = argv[2] === '-b' ? argv[4] : argv[2];
      mkdirSync(path, { recursive: true });
    }
  } else if (exe === 'gh') {
    if (argv[0] === 'api' && argv.includes('user')) output = JSON.stringify({ login: 'Kaito-Iwase' });
    else if (argv[0] === 'api' && argv.some((item) => item.includes('/issues?'))) output = JSON.stringify([remote.issues]);
    else if (argv[0] === 'api' && argv.some((item) => item.includes('/dependencies/') || item.includes('/sub_issues'))) output = '[[]]';
    else if (argv[0] === 'project' && argv[1] === 'item-list') output = JSON.stringify({ items: remote.items });
    else if (argv[0] === 'project' && argv[1] === 'item-edit') {
      const number = Number(arg('--url').split('/').at(-1));
      remote.items.find((item) => item.content.number === number).status = arg('--value');
      store();
    } else if (argv[0] === 'pr' && argv[1] === 'list') {
      output = JSON.stringify(argv.includes('--head') ? remote.prs.filter((pr) => pr.headRefName === arg('--head')) : remote.prs);
    } else if (argv[0] === 'pr' && argv[1] === 'create') {
      output = 'https://github.com/example/ml/pull/1';
      remote.prs.push({ number: 1, url: output, headRefName: arg('--head'), body: readFileSync(arg('--body-file'), 'utf8') });
      store();
    } else if (argv[0] === 'issue' && argv[1] === 'view') {
      const item = issue(argv[2]);
      output = JSON.stringify({ body: item.body, comments: item.comments ?? [] });
    } else if (argv[0] === 'issue' && argv[1] === 'edit') {
      const item = issue(argv[2]);
      if (argv.includes('--body-file')) item.body = readFileSync(arg('--body-file'), 'utf8');
      if (argv.includes('--add-label')) item.labels.push({ name: arg('--add-label') });
      store();
    } else if (argv[0] === 'issue' && argv[1] === 'comment') {
      const item = issue(argv[2]);
      (item.comments ??= []).push({ body: readFileSync(arg('--body-file'), 'utf8') });
      store();
    }
  } else if (exe === 'codex') {
    const outputPath = arg('--output-last-message');
    const role = require('node:path').basename(outputPath).split('-')[0];
    let result;
    if (role === 'plan' && outputPath.includes('-38.')) {
      result = { status: 'NEEDS_HUMAN', problem: '権利確認待ち', evidence: ['提供元の回答未確認'],
        options: ['回答を待つ'], recommendation: '確認後に判断', tradeoffs: ['実録音は保留'], requiredDecision: '利用範囲' };
    } else if (role === 'plan') {
      result = { status: 'READY', goal: '合成評価', scope: ['#40'], acceptance: ['評価結果'],
        verification: ['Foundation'], mlEvaluation: ['合成データで計測'] };
    } else if (role === 'implementation' || role === 'repair') {
      result = { status: 'DONE', summary: '合成評価を追加', changes: ['評価を追加'], designDecisions: [],
        mlEvaluationResults: ['合成データ10件で完了'], risks: [], followups: [], notVerified: ['実データ'],
        documentationImpact: ['ML README'], reviewFocus: ['評価範囲'] };
    } else if (role === 'review') {
      remote.reviewCalls = (remote.reviewCalls ?? 0) + 1;
      store();
      result = remote.reviewMode === 'exhaust' ||
        (remote.reviewMode === 'repair-once' && remote.reviewCalls === 1)
        ? { status: 'CHANGES_REQUESTED', findings: ['評価境界を修正'] }
        : { status: 'PASS', findings: [] };
    } else {
      result = { status: 'PASS', findings: [] };
    }
    writeFileSync(outputPath, JSON.stringify(result));
  } else if (exe !== 'pwsh' && exe !== 'node') {
    throw new Error('Unexpected executable: ' + exe);
  }
  return output;
}

require('node:child_process').spawn = function fakeSpawn(exe, argv, options) {
  if (!['git', 'gh', 'codex', 'pwsh', 'node'].includes(exe)) return realSpawn(exe, argv, options);
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  setImmediate(() => {
    try {
      const output = record(exe, argv);
      child.stdout.end(output ? output + '\n' : '');
      child.stderr.end();
      setImmediate(() => child.emit('close', 0));
    } catch (error) {
      child.stderr.end(String(error));
      child.stdout.end();
      setImmediate(() => child.emit('close', 1));
    }
  });
  return child;
};
syncBuiltinESMExports();
