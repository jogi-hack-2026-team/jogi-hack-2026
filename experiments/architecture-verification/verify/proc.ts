// Supporting Artifact / Not a Source of Truth (Issue #84).
// Runs src/server.ts as a separate OS process (a real restart / a second instance).
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { rootDir } from '../src/pg-embedded.ts';

export type ServerProc = { url: string; child: ChildProcess; startedInMs: number; output: () => string; stop: (signal?: NodeJS.Signals) => Promise<{ code: number | null; lastLine: string }> };

export function startServer(env: Record<string, string>): Promise<ServerProc> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(rootDir, 'src', 'server.ts')], {
      cwd: rootDir,
      env: { PATH: process.env.PATH ?? '', HOST: '127.0.0.1', SPIKE_MIGRATE: '0', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const t0 = performance.now();
    let out = '';
    let err = '';
    let lastLine = '';
    const url = `http://127.0.0.1:${env.PORT}`;
    const stop = (signal: NodeJS.Signals = 'SIGTERM') =>
      new Promise<{ code: number | null; lastLine: string }>((res) => {
        child.once('exit', (code) => res({ code, lastLine }));
        child.kill(signal);
      });
    child.stdout!.on('data', (d) => {
      out += d;
      for (const l of String(d).split('\n')) if (l.trim()) lastLine = l.trim();
      if (out.includes('"event":"listening"')) resolve({ url, child, stop, startedInMs: Math.round(performance.now() - t0), output: () => out });
    });
    child.stderr!.on('data', (d) => (err += d));
    child.once('exit', (code) => reject(new Error(`server exited early (${code}): ${err.slice(-800)}`)));
  });
}
