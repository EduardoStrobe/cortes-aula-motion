#!/usr/bin/env node
// Render a list of frames of ONE composition to PNG stills. Bundles once, then renders every frame.
//
//   node scripts/stills.mjs <composition-id> --frames 0,30,60,100-120:4 [--scale 0.5] [--out out/stills/<comp>]
//                                             [--parallel 2] [--jpeg]
//
//   --frames   comma list of frames and ranges "a-b" or "a-b:step" (inclusive). "last" = last frame, "all:N" = every
//              N-th frame of the whole composition. Default: 0.
//   --scale    output scale (default 0.5 -> 540x960).
//   output     out/stills/<comp>/f<frame, 5 digits>.png
//
// Up to seven agents render at the same time on a 16 GB machine, so:
//   * a 2-slot semaphore (it was 3: three processes at once overload this machine; lock DIRECTORIES out/.locks/slot-N, atomic mkdir, wait + retry, stale after 6 minutes,
//     heart-beat every 30 s while alive) wraps bundling + rendering;
//   * every slot has its OWN fixed HTTP ports (slot 0: 3511.., slot 1: 3521.., slot 2: 3531..; one per worker).
//     With the default "first free port from 3000" several Remotion processes raced for the same port and the
//     /proxy video requests died with "Could not extract frame from compositor / Request closed /
//     ERR_CONNECTION_RESET";
//   * a frame that fails is retried up to 2 times (after 1.5 s / 3 s) before the run is declared failed;
//   * the OffthreadVideo frame cache is capped at 400 MB;
//   * the bundle is written to out/.bundles/<pid> WITHOUT copying public/ (241 MB): the bundle's public folder is a
//     directory junction to the project's public/ (removed, never followed, on exit).
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const LOCKS = path.join(OUT, ".locks");
const SLOTS = 2; // measured: 2 parallel processes take 10-13 s for 5 stills each; 3 take 70 s each with font / port time-outs
const STALE_MS = 6 * 60 * 1000;
const CACHE_BYTES = 400 * 1024 * 1024;
/** first HTTP port of a slot; worker w of the slot serves on PORT_BASE(slot) + w (w = 0 is also used for
 *  selectComposition, which runs before the workers start). scripts/render.mjs uses + 9 of its slot. */
const PORT_BASE = (slot) => 3511 + 10 * slot;
const RETRIES = 2;

// ---- args -----------------------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const comp = argv[0]; // the composition id is always the first argument
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def;
};
if (!comp || comp.startsWith("--")) {
  console.error("usage: node scripts/stills.mjs <composition-id> --frames 0,30,60 | a-b:step [--scale 0.5]");
  process.exit(2);
}
const scale = Number(opt("scale", "0.5"));
const parallel = Math.max(1, Math.min(4, Number(opt("parallel", "2"))));
const jpeg = argv.includes("--jpeg");
const outDir = path.resolve(ROOT, opt("out", path.join("out", "stills", comp)));
const framesArg = String(opt("frames", "0"));

const parseFrames = (spec, total) => {
  const out = new Set();
  for (const part of spec.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (part === "last") {
      out.add(total - 1);
      continue;
    }
    let m = /^all(?::(\d+))?$/.exec(part);
    if (m) {
      for (let f = 0; f < total; f += Number(m[1] ?? 30)) out.add(f);
      continue;
    }
    m = /^(\d+)(?:-(\d+))?(?::(\d+))?$/.exec(part);
    if (!m) throw new Error(`bad --frames part "${part}"`);
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    const step = Math.max(1, Number(m[3] ?? 1));
    for (let f = a; f <= b; f += step) out.add(f);
  }
  return [...out].filter((f) => f >= 0 && f < total).sort((x, y) => x - y);
};

// ---- semaphore ------------------------------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let heldLock = null;
let heldSlot = -1;
let beat = null;
const acquire = async () => {
  fs.mkdirSync(LOCKS, { recursive: true });
  const t0 = Date.now();
  let told = 0;
  for (;;) {
    for (let i = 0; i < SLOTS; i++) {
      const dir = path.join(LOCKS, `slot-${i}`);
      try {
        fs.mkdirSync(dir); // atomic: fails with EEXIST when another process holds the slot
        heldLock = dir;
        heldSlot = i;
        try {
          fs.writeFileSync(path.join(dir, "owner.json"), JSON.stringify({ pid: process.pid, comp, port: PORT_BASE(i), since: new Date().toISOString() }));
        } catch { /* informational only */ }
        beat = setInterval(() => {
          try {
            const now = new Date();
            fs.utimesSync(dir, now, now);
          } catch { /* ignore */ }
        }, 30000);
        beat.unref();
        return;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        try {
          const age = Date.now() - fs.statSync(dir).mtimeMs;
          if (age > STALE_MS) {
            fs.rmSync(dir, { recursive: true, force: true }); // stale: its owner died; next loop retries the mkdir
          }
        } catch { /* it vanished meanwhile */ }
      }
    }
    if (Date.now() - told > 20000) {
      told = Date.now();
      console.log(`[stills] waiting for a render slot (${SLOTS} busy, ${Math.round((Date.now() - t0) / 1000)} s)...`);
    }
    await sleep(1200 + Math.random() * 800);
  }
};
const release = () => {
  if (beat) clearInterval(beat);
  if (heldLock) {
    try {
      fs.rmSync(heldLock, { recursive: true, force: true });
    } catch { /* ignore */ }
    heldLock = null;
  }
};

// ---- bundle without copying public/ ---------------------------------------------------------------------------
let bundleDir = null;
const removeBundle = () => {
  if (!bundleDir) return;
  const link = path.join(bundleDir, "public");
  try {
    // remove the junction itself (never recurse through it into the real public/)
    const st = fs.lstatSync(link);
    if (st.isSymbolicLink()) fs.unlinkSync(link);
  } catch { /* not there */ }
  try {
    if (!fs.existsSync(link)) fs.rmSync(bundleDir, { recursive: true, force: true });
  } catch { /* ignore */ }
  bundleDir = null;
};
const makeBundle = async () => {
  bundleDir = path.join(OUT, ".bundles", String(process.pid));
  fs.mkdirSync(bundleDir, { recursive: true });
  const emptyPublic = fs.mkdtempSync(path.join(os.tmpdir(), "rp-empty-public-"));
  await bundle({
    entryPoint: path.join(ROOT, "src", "index.ts"),
    outDir: bundleDir,
    publicDir: emptyPublic,
    enableCaching: false,
    onProgress: () => undefined,
  });
  fs.rmSync(emptyPublic, { recursive: true, force: true });
  const link = path.join(bundleDir, "public");
  fs.rmSync(link, { recursive: true, force: true }); // the (empty) copy made by the bundler
  fs.symlinkSync(path.join(ROOT, "public"), link, "junction");
  return bundleDir;
};

const cleanup = () => {
  removeBundle();
  release();
};
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    cleanup();
    process.exit(130);
  });
}

// ---- main -----------------------------------------------------------------------------------------------------
const main = async () => {
  const t0 = Date.now();
  await acquire();
  const tLock = Date.now();
  const serveUrl = await makeBundle();
  const tBundle = Date.now();
  const browser = await openBrowser("chrome");
  try {
    const port0 = PORT_BASE(heldSlot);
    const composition = await selectComposition({
      serveUrl, id: comp, inputProps: {}, puppeteerInstance: browser, offthreadVideoCacheSizeInBytes: CACHE_BYTES,
      logLevel: "warn", port: port0,
    });
    const frames = parseFrames(framesArg, composition.durationInFrames);
    if (!frames.length) throw new Error(`no frame of "${framesArg}" is inside 0..${composition.durationInFrames - 1}`);
    fs.mkdirSync(outDir, { recursive: true });
    const ext = jpeg ? "jpg" : "png";
    let next = 0;
    let retried = 0;
    const worker = async (w) => {
      for (;;) {
        const i = next++;
        if (i >= frames.length) return;
        const f = frames[i];
        const output = path.join(outDir, `f${String(f).padStart(5, "0")}.${ext}`);
        for (let attempt = 0; ; attempt++) {
          try {
            await renderStill({
              composition, serveUrl, output, frame: f, scale, imageFormat: jpeg ? "jpeg" : "png", inputProps: {},
              puppeteerInstance: browser, offthreadVideoCacheSizeInBytes: CACHE_BYTES, overwrite: true, logLevel: "warn",
              port: port0 + w,
            });
            break;
          } catch (e) {
            if (attempt >= RETRIES) throw e;
            retried++;
            const msg = String(e && e.message ? e.message : e).split(String.fromCharCode(10))[0].slice(0, 200);
            console.warn(`[stills] ${comp} f${f} failed (attempt ${attempt + 1} of ${RETRIES + 1}): ${msg} -- retrying`);
            await sleep(1500 * (attempt + 1));
          }
        }
        console.log(`[stills] ${comp} f${f} -> ${path.relative(ROOT, output)}`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, frames.length) }, (_, w) => worker(w)));
    if (retried) console.log(`[stills] ${retried} retry(ies) were needed`);
    console.log(`[stills] ${frames.length} still(s) of ${comp} (${composition.durationInFrames} f) in ${path.relative(ROOT, outDir)}`
      + ` | wait ${((tLock - t0) / 1000).toFixed(1)} s, bundle ${((tBundle - tLock) / 1000).toFixed(1)} s,`
      + ` render ${((Date.now() - tBundle) / 1000).toFixed(1)} s`);
  } finally {
    await browser.close({ silent: true }).catch(() => undefined);
  }
};

main().then(() => {
  cleanup();
  process.exit(0);
}).catch((e) => {
  console.error(`[stills] FAILED: ${e && e.stack ? e.stack : e}`);
  cleanup();
  process.exit(1);
});
