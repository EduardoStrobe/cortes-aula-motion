#!/usr/bin/env node
// Runs scripts/dump.ts (resolve every storyboard, print caption units / cues / camera) through esbuild.
//   node scripts/dump.mjs [c1 c2 ...] [--units] [--cues] [--cam]
import { buildSync } from "esbuild";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(ROOT, "out", ".dump", `dump-${process.pid}.cjs`);
fs.mkdirSync(path.dirname(out), { recursive: true });
buildSync({
  entryPoints: [path.join(ROOT, "scripts", "dump.ts")], outfile: out, bundle: true, platform: "node", format: "cjs",
  jsx: "automatic", logLevel: "error", loader: { ".json": "json", ".css": "empty", ".woff2": "empty", ".ttf": "empty", ".png": "empty" },
});
const r = spawnSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: "inherit" });
fs.rmSync(out, { force: true });
process.exit(r.status ?? 1);
