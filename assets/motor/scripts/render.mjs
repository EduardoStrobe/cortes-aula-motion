#!/usr/bin/env node
// Full render of ONE composition through the same 3-slot semaphore as scripts/stills.mjs, on a DEDICATED port.
//
//   node scripts/render.mjs <composition-id> <output.mp4 | output.wav> [--concurrency 3] [--frames a-b] [extra remotion flags]
//
// Why: with several Remotion processes on the default port ("first free port from 3000") renders failed with
// "Could not extract frame from compositor / Request closed / ERR_CONNECTION_RESET" on the /proxy video requests.
// A render given its own --port went through. Each semaphore slot therefore owns a fixed port block
// (slot 0: 3511-3520, slot 1: 3521-3530, slot 2: 3531-3540); stills use +0..+3, a full render uses +9.
// The render is retried once (same slot, same port) when the CLI exits with an error.
//
// An output ending in .wav / .mp3 / .aac renders the audio only (used to measure the mix).
//
// AAC priming: Remotion muxes the AAC track without an edit list, so the decoded audio of the MP4 is 2048 samples
// (43 ms, 1.3 frames) LATE against the picture (measured by cross-correlation with public/<id>/audio.wav on every
// v2 file). After a successful .mp4 / .mov render the file is re-muxed (stream copy, no re-encode) with the audio
// timestamps moved 2048 samples earlier: ffmpeg then writes the edit list that skips the priming packets, and the
// decoded lag is 0. Skip with --keep-audio-delay.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCKS = path.join(ROOT, "out", ".locks");
const SLOTS = 2; // measured: 2 parallel processes take 10-13 s for 5 stills each; 3 take 70 s each with font / port time-outs
const STALE_MS = 6 * 60 * 1000;
const PORT_BASE = (slot) => 3511 + 10 * slot;

const argv = process.argv.slice(2);
const comp = argv[0];
const output = argv[1];
if (!comp || !output || comp.startsWith("--") || output.startsWith("--")) {
  console.error("usage: node scripts/render.mjs <composition-id> <output> [--concurrency 3] [--frames a-b] [...remotion flags]");
  process.exit(2);
}
const keepDelay = argv.includes("--keep-audio-delay");
const rest = argv.slice(2).filter((a) => a !== "--keep-audio-delay");
const has = (name) => rest.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let held = null;
let slot = -1;
let beat = null;
const acquire = async () => {
  fs.mkdirSync(LOCKS, { recursive: true });
  let told = 0;
  const t0 = Date.now();
  for (;;) {
    for (let i = 0; i < SLOTS; i++) {
      const dir = path.join(LOCKS, `slot-${i}`);
      try {
        fs.mkdirSync(dir);
        held = dir;
        slot = i;
        try {
          fs.writeFileSync(path.join(dir, "owner.json"), JSON.stringify({ pid: process.pid, comp, render: output, port: PORT_BASE(i) + 9, since: new Date().toISOString() }));
        } catch { /* informational only */ }
        beat = setInterval(() => {
          try {
            const now = new Date();
            fs.utimesSync(dir, now, now);
          } catch { /* ignore */ }
        }, 30000);
        return;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        try {
          if (Date.now() - fs.statSync(dir).mtimeMs > STALE_MS) fs.rmSync(dir, { recursive: true, force: true });
        } catch { /* it vanished meanwhile */ }
      }
    }
    if (Date.now() - told > 20000) {
      told = Date.now();
      console.log(`[render] waiting for a render slot (${SLOTS} busy, ${Math.round((Date.now() - t0) / 1000)} s)...`);
    }
    await sleep(1200 + Math.random() * 800);
  }
};
const release = () => {
  if (beat) clearInterval(beat);
  if (held) {
    try {
      fs.rmSync(held, { recursive: true, force: true });
    } catch { /* ignore */ }
    held = null;
  }
};
process.on("exit", release);
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    release();
    process.exit(130);
  });
}

const run = (args) => new Promise((resolve) => {
  // The Remotion CLI is started with THIS node binary (no npx, no shell): from Git Bash `npx` resolved to a shim
  // that looked for node_modules/npm/bin/npx-cli.js inside the project and died before rendering anything.
  const cli = path.join(ROOT, "node_modules", "@remotion", "cli", "remotion-cli.js");
  const child = spawn(process.execPath, [cli, "render", ...args], { cwd: ROOT, stdio: "inherit", shell: false });
  child.on("exit", (code) => resolve(code ?? 1));
  child.on("error", () => resolve(1));
});

/** Re-mux `file` in place with the audio 2048 samples earlier (see the header). Leaves the file alone on any error. */
const fixAudioDelay = (file) => {
  const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name,sample_rate",
    "-of", "csv=p=0", file], { encoding: "utf8" });
  const [codec, rate] = String(probe.stdout || "").trim().split(",");
  if (probe.status !== 0 || codec !== "aac" || !Number(rate)) {
    console.log(`[render] audio delay: nothing to do (${codec || "no audio"})`);
    return;
  }
  const tmp = file.replace(/(\.[^.]+)$/, ".remux$1");
  const off = (-2048 / Number(rate)).toFixed(9);
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-itsoffset", off, "-i", file, "-map", "0:v:0", "-map", "1:a:0",
    "-c", "copy", "-movflags", "+faststart", tmp], { stdio: "inherit" });
  if (r.status === 0 && fs.existsSync(tmp) && fs.statSync(tmp).size > 0.9 * fs.statSync(file).size) {
    fs.renameSync(tmp, file);
    console.log(`[render] audio delay: AAC priming (2048 samples) compensated with an edit list`);
  } else {
    try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
    console.warn("[render] audio delay: re-mux failed, the file is left as rendered (audio 43 ms late)");
  }
};

const main = async () => {
  await acquire();
  const port = PORT_BASE(slot) + 9;
  const args = [comp, output, `--port=${port}`];
  if (!has("concurrency")) args.push("--concurrency=3");
  args.push(...rest);
  console.log(`[render] ${comp} -> ${output} | slot ${slot} port ${port}`);
  let code = await run(args);
  if (code !== 0) {
    console.warn(`[render] exit code ${code}: retrying once in 3 s`);
    await sleep(3000);
    code = await run(args);
  }
  if (code === 0 && !keepDelay && /\.(mp4|mov)$/i.test(output)) fixAudioDelay(path.resolve(ROOT, output));
  release();
  process.exit(code);
};
main().catch((e) => {
  console.error(`[render] FAILED: ${e && e.stack ? e.stack : e}`);
  release();
  process.exit(1);
});
