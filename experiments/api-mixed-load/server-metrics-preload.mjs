// Supporting Artifact / Not a Source of Truth (Issue #161).
// `node --import` で現行 apps/api/src/server.ts と同じprocessに読み込む計測専用のpreload。
// 製品コードを変更せず、event-loop遅延・CPU・RSSを同じevent loop上で観測し、loopbackの別portで返す。
// event-loop遅延の最大値は「1回の同期ブロックの最長時間」の近似で、予測計算の所要時間そのものではない。
import { createServer } from 'node:http';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

const port = Number(process.env.MIXED_LOAD_METRICS_PORT);
if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
  throw new Error('MIXED_LOAD_METRICS_PORT must be a loopback port for the measurement preload');
}

const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();
let cpuBase = process.cpuUsage();
let wallBase = performance.now();
const ms = (ns) => Math.round((ns / 1e6) * 100) / 100;

function snapshot() {
  const cpu = process.cpuUsage(cpuBase);
  const wallMs = performance.now() - wallBase;
  return {
    wallMs: Math.round(wallMs),
    cpuUserMs: Math.round(cpu.user / 1000),
    cpuSystemMs: Math.round(cpu.system / 1000),
    cpuUtilization: Math.round(((cpu.user + cpu.system) / 1000 / wallMs) * 100) / 100,
    rssMb: Math.round((process.memoryUsage().rss / 1048576) * 10) / 10,
    eventLoopDelay: {
      count: loop.count,
      meanMs: ms(loop.mean),
      p50Ms: ms(loop.percentile(50)),
      p99Ms: ms(loop.percentile(99)),
      maxMs: ms(loop.max),
    },
  };
}

function reset() {
  loop.reset();
  cpuBase = process.cpuUsage();
  wallBase = performance.now();
}

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/reset') {
    reset();
    res.writeHead(204).end();
    return;
  }
  if (req.method === 'GET' && req.url === '/snapshot') {
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(snapshot()));
    return;
  }
  res.writeHead(404).end();
});
server.unref();
server.listen(port, '127.0.0.1');
