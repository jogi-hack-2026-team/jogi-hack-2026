import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

type StopCommand = (
  file: string,
  args: string[],
  options: { windowsHide: true; timeout: number },
) => Promise<unknown>;

const run = promisify(execFile);

/** Windowsのtaskkillによる親だけの終了を避け、所有cluster自身に全workerの停止を待たせる。 */
export function createWindowsEmbeddedStop(
  pgCtl: string,
  dataDir: string,
  command: StopCommand = run,
): () => Promise<void> {
  let stopping: Promise<void> | undefined;
  return () => {
    // 通常closeと依存の終了hookが重なっても再停止せず、失敗したPromiseも保持する。
    stopping ??= Promise.resolve()
      .then(() => command(pgCtl, ['stop', '-D', dataDir, '-m', 'fast', '-w', '-t', '30'], {
        windowsHide: true,
        timeout: 35_000,
      }))
      .then(() => undefined);
    return stopping;
  };
}
