import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  readdirSync,
  statSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
const root = process.cwd();
mkdirSync("results", { recursive: true });
function run(script) {
  const start = performance.now();
  const r = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", script],
    {
      cwd: root,
      shell: process.platform === "win32",
      encoding: "utf8",
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    },
  );
  const ms = performance.now() - start;
  writeFileSync(
    `results/local-${script.replaceAll(":", "-")}.log`,
    r.stdout + "\n" + r.stderr,
  );
  if (r.status !== 0) throw new Error(`${script} failed; inspect results log`);
  return Number(ms.toFixed(2));
}
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    ["node_modules", ".next", "dist"].includes(e.name)
      ? []
      : e.isDirectory()
        ? files(path.join(dir, e.name))
        : [path.join(dir, e.name)],
  );
}
function bytes(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce(
    (sum, e) =>
      sum +
      (e.isDirectory()
        ? bytes(path.join(dir, e.name))
        : statSync(path.join(dir, e.name)).size),
    0,
  );
}
const result = {
  label: "Supporting Artifact / Not a Source of Truth",
  at: new Date().toISOString(),
  node: process.version,
  os: os.release(),
  cpu: os.cpus()[0].model,
  logicalCpu: os.cpus().length,
  conditions:
    "Same Windows host, one warm-up then three sequential incremental builds each; cache retained; excludes npm install. Source counts include code/config only, not Markdown or generated declarations. Build output bytes are NOT network transfer bytes.",
  typecheckMs: run("typecheck"),
  frontend: {},
};
for (const candidate of ["vite", "next"]) {
  run(`build:${candidate}`);
  const elapsed = Array.from({ length: 3 }, () => run(`build:${candidate}`));
  const sources = files(`frontend/${candidate}`).filter(
    (p) =>
      /\.(tsx?|[cm]?js|json|html|css)$/.test(p) && !p.endsWith("next-env.d.ts"),
  );
  result.frontend[candidate] = {
    buildMs: elapsed,
    medianMs: [...elapsed].sort((a, b) => a - b)[1],
    sourceFiles: sources.length,
    sourceLines: sources.reduce(
      (n, p) => n + readFileSync(p, "utf8").split("\n").length - 1,
      0,
    ),
    outputBytes: bytes(
      `frontend/${candidate}/${candidate === "vite" ? "dist" : ".next"}`,
    ),
  };
}
const shared = files("frontend/shared");
result.shared = {
  files: shared.length,
  lines: shared.reduce(
    (n, p) => n + readFileSync(p, "utf8").split("\n").length - 1,
    0,
  ),
};
writeFileSync(
  "results/build-metrics.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
