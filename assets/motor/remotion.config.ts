// Options: https://remotion.dev/docs/config (each one is also a CLI flag).
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Up to seven agents render at once on a 16 GB machine: keep the OffthreadVideo frame cache small (default would be
// half of the free RAM PER render) and do not let one render take every core. scripts/stills.mjs uses the same cap.
Config.setOffthreadVideoCacheSizeInBytes(400 * 1024 * 1024);
Config.setConcurrency(4);
