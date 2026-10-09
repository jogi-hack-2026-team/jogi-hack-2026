// Supporting Artifact / Not a Source of Truth (Issue #161).
import type { ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:net';

export type Stop = () => Promise<unknown>;

// 1つ目を保持したまま2つ目を選び、自分の2 listenerが同じportを選ぶのを防ぐ。
// 返却後の他processとのbind競合は残る。その場合もmainのfinallyで後始末する。
export async function distinctLoopbackPorts(): Promise<[number, number]> {
  const probes = [createServer(), createServer()];
  const listen = (server: Server) => new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') reject(new Error('loopback port was not assigned'));
      else resolve(address.port);
    });
  });
  try {
    const first = await listen(probes[0]!);
    const second = await listen(probes[1]!);
    return [first, second];
  } finally {
    await Promise.all(probes.map(server => server.listening
      ? new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      : Promise.resolve()));
  }
}

// killの戻り値は終了確認ではない。spawn直後からexit/errorを監視し、stopを冪等にする。
export function monitorChild(child: ChildProcess, graceMs = 5_000) {
  let spawnError: Error | undefined;
  const exited = child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve(child.exitCode)
    : new Promise<number | null>(resolve => {
      child.once('exit', code => resolve(code));
      child.on('error', error => {
        // spawn後のkill/send errorはprocessの終了を証明しない。
        if (!child.pid) { spawnError = error; resolve(null); }
      });
    });
  const timeout = Symbol('timeout');
  async function wait() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([exited, new Promise<typeof timeout>(resolve => {
        timer = setTimeout(() => resolve(timeout), graceMs);
      })]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  let stopping: Promise<number | null> | undefined;
  return {
    spawnError: () => spawnError,
    stop: () => stopping ??= (async () => {
      if (child.exitCode === null && child.signalCode === null && !spawnError) child.kill('SIGTERM');
      const graceful = await wait();
      if (graceful !== timeout) return graceful;
      child.kill('SIGKILL'); // このharnessがspawnしたchildだけを対象にする。
      const forced = await wait();
      if (forced === timeout) throw new Error('owned server did not exit after SIGKILL');
      return forced;
    })(),
  };
}

// seed/wiring/scenario、起動待ち、結果保存のどこで失敗しても全child→DBの順でcleanupを試みる。
export async function withHarnessCleanup<T>(stops: Stop[], closeDatabase: Stop, work: () => Promise<T>): Promise<T> {
  let failed = false;
  let original: unknown;
  try {
    return await work();
  } catch (error) {
    failed = true;
    original = error;
    throw error;
  } finally {
    const errors: unknown[] = [];
    for (const stop of [...stops].reverse()) {
      try { await stop(); } catch (error) { errors.push(error); }
    }
    try { await closeDatabase(); } catch (error) { errors.push(error); }
    if (errors.length) throw new AggregateError(failed ? [original, ...errors] : errors, 'harness cleanup failed');
  }
}
