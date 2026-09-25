import { writeFileSync } from "node:fs";
const result = {
  label: "Supporting Artifact / Not a Source of Truth",
  at: new Date().toISOString(),
  repositories: [],
  packages: [],
};
for (const repo of [
  "vitejs/vite",
  "remix-run/react-router",
  "TanStack/router",
  "vercel/next.js",
  "honojs/hono",
  "fastify/fastify",
  "nestjs/nest",
  "go-chi/chi",
  "labstack/echo",
  "fastapi/fastapi",
  "rails/rails",
  "tokio-rs/axum",
  "ktorio/ktor",
  "spring-projects/spring-boot",
]) {
  const source = `https://api.github.com/repos/${repo}`;
  try {
    const responses = await Promise.all([
      fetch(source),
      fetch(source + "/releases?per_page=5"),
    ]);
    if (responses.some((r) => !r.ok))
      throw new Error(responses.map((r) => r.status).join("/"));
    const [meta, releases] = await Promise.all(responses.map((r) => r.json()));
    result.repositories.push({
      repo,
      source,
      archived: meta.archived,
      pushedAt: meta.pushed_at,
      releases: releases.map((r) => ({
        tag: r.tag_name,
        prerelease: r.prerelease,
        published: r.published_at,
        url: r.html_url,
      })),
    });
  } catch (error) {
    result.repositories.push({ repo, source, error: String(error) });
  }
}
for (const name of [
  "@tanstack/react-router",
  "@tanstack/react-start",
  "react-router-dom",
  "next",
  "hono",
  "fastify",
  "@nestjs/core",
]) {
  const source = `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`;
  try {
    const r = await fetch(source);
    if (!r.ok) throw new Error(String(r.status));
    const p = await r.json();
    result.packages.push({
      name,
      version: p.version,
      engines: p.engines,
      source,
    });
  } catch (error) {
    result.packages.push({ name, source, error: String(error) });
  }
}
writeFileSync(
  "results/research-releases.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
