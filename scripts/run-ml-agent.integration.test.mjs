import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = dirname(fileURLToPath(import.meta.url));
const issue = (number) => ({ number, title: '[Investigation][ML] ' + number,
  body: '## 完了条件\n- [ ] 確認', state: 'open', labels: [{ name: 'ml' }],
  assignees: [{ login: 'Kaito-Iwase' }] });
const item = (number) => ({ content: { number }, status: 'Ready', scope: 'Must' });

test('runner skips a decision, creates one PR, then avoids replay and audits after completion', () => {
  const tempRoot = realpathSync(tmpdir());
  const root = mkdtempSync(join(tempRoot, 'ml-agent-integration-'));
  try {
    mkdirSync(join(root, 'scripts'));
    for (const name of ['run-ml-agent.mjs', 'ml-agent-core.mjs']) {
      copyFileSync(join(scripts, name), join(root, 'scripts', name));
    }
    const remoteFile = join(root, 'remote.json');
    const logFile = join(root, 'calls.json');
    writeFileSync(remoteFile, JSON.stringify({ issues: [issue(38), issue(40)], items: [item(38), item(40)], prs: [], reviewMode: 'repair-once' }));
    writeFileSync(logFile, '[]');
    const run = (...args) => {
      const result = spawnSync(process.execPath, ['--require', join(scripts, 'ml-agent-command-stub.cjs'),
        join(root, 'scripts', 'run-ml-agent.mjs'), ...args], {
        encoding: 'utf8', timeout: 30000,
        env: { ...process.env, ML_AGENT_FAKE_REMOTE_FILE: remoteFile, ML_AGENT_FAKE_LOG_FILE: logFile },
      });
      assert.equal(result.status, 0, result.stderr + result.stdout);
      return result.stdout;
    };
    const calls = () => JSON.parse(readFileSync(logFile, 'utf8'));
    const remote = () => JSON.parse(readFileSync(remoteFile, 'utf8'));
    run('--dry-run');
    assert.equal(calls().filter((x) => /gh (issue|pr create|project item-edit)/.test(x)).length, 0);

    const firstOutput = run();
    assert.match(firstOutput, /No auto-eligible ML issue\. Blockers:/);
    assert.equal(remote().items[0].status, 'Backlog');
    assert.equal(remote().items[1].status, 'In review');
    assert.equal(remote().prs.length, 1);
    assert.equal(remote().prs[0].headRefName, 'chore/40-ml');
    assert.equal(remote().reviewCalls, 2);
    assert.match(remote().issues[0].comments[0].body, /権利確認待ち/);
    assert.match(remote().issues[1].body, /Pull Request: https:\/\/github.com\/example\/ml\/pull\/1/);
    const state = JSON.parse(readFileSync(join(root, '.codex', 'ml-agent', 'state.json'), 'utf8'));
    assert.equal(state.issues[38].phase, 'decision');
    assert.equal(state.issues[40].phase, 'pr_created');
    assert.equal(state.issues[40].branch, 'chore/40-ml');
    assert.equal(state.issues[40].synced, true);
    assert.equal(state.issues[40].review.status, 'PASS');
    assert.equal(state.issues[40].repairs, 1);
    assert.match(remote().prs[0].body, /合成データ10件で完了/);
    assert.ok(calls().some((x) => x.startsWith('pwsh -NoProfile -File scripts/check-foundation.ps1')));

    run();
    assert.equal(calls().filter((x) => x.startsWith('gh pr create')).length, 1);
    assert.equal(calls().filter((x) => x.startsWith('git push')).length, 1);
    const completed = remote();
    for (const entry of completed.issues) { entry.state = 'closed'; entry.state_reason = 'completed'; }
    writeFileSync(remoteFile, JSON.stringify(completed));
    run();
    assert.equal(JSON.parse(readFileSync(join(root, '.codex', 'ml-agent', 'state.json'), 'utf8')).audit.done, true);
  } finally {
    if (!realpathSync(root).startsWith(tempRoot + sep)) throw new Error('Unexpected temp path');
    rmSync(root, { recursive: true, force: true });
  }
});

test('runner stops after three failed repairs without creating a PR', () => {
  const tempRoot = realpathSync(tmpdir());
  const root = mkdtempSync(join(tempRoot, 'ml-agent-repairs-'));
  try {
    mkdirSync(join(root, 'scripts'));
    for (const name of ['run-ml-agent.mjs', 'ml-agent-core.mjs']) {
      copyFileSync(join(scripts, name), join(root, 'scripts', name));
    }
    const remoteFile = join(root, 'remote.json');
    const logFile = join(root, 'calls.json');
    writeFileSync(remoteFile, JSON.stringify({ issues: [issue(40)], items: [item(40)], prs: [], reviewMode: 'exhaust' }));
    writeFileSync(logFile, '[]');
    const result = spawnSync(process.execPath, ['--require', join(scripts, 'ml-agent-command-stub.cjs'),
      join(root, 'scripts', 'run-ml-agent.mjs')], {
      encoding: 'utf8', timeout: 30000,
      env: { ...process.env, ML_AGENT_FAKE_REMOTE_FILE: remoteFile, ML_AGENT_FAKE_LOG_FILE: logFile },
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const remote = JSON.parse(readFileSync(remoteFile, 'utf8'));
    const calls = JSON.parse(readFileSync(logFile, 'utf8'));
    const state = JSON.parse(readFileSync(join(root, '.codex', 'ml-agent', 'state.json'), 'utf8'));
    assert.equal(remote.reviewCalls, 4);
    assert.equal(calls.filter((x) => x.startsWith('codex exec') && x.includes('repair-')).length, 3);
    assert.equal(calls.filter((x) => x.startsWith('gh pr create')).length, 0);
    assert.equal(remote.items[0].status, 'Backlog');
    assert.equal(state.issues[40].phase, 'decision');
    assert.match(remote.issues[0].comments[0].body, /修正上限の3回/);
  } finally {
    if (!realpathSync(root).startsWith(tempRoot + sep)) throw new Error('Unexpected temp path');
    rmSync(root, { recursive: true, force: true });
  }
});
