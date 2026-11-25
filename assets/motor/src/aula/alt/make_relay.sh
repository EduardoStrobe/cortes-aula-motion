#!/usr/bin/env bash
# ALT relay click (spec/ALT.md 5.2), synthesised with ffmpeg (no downloads): a 14 ms 2200 Hz tick mixed with a
# 50 ms 320 Hz body that decays. 48 kHz stereo like the other cues. Run from the project root:
#   bash src/aula/alt/make_relay.sh
# Review round 1: the first version measured -33 dBFS peak (ffmpeg's sine source is already at -18 dBFS, so
# "volume=-20dB" gave -38 dBFS) with its body at 140 Hz, which a phone speaker does not reproduce: the switch-on
# and switch-off were inaudible. Now about -18 dBFS peak, level with pop.wav / whoosh.wav (-21 / -20 dBFS), i.e.
# still 16 dB under the speech peak.
set -euo pipefail
out="public/sfx/relay.wav"
ffmpeg -y -v error -f lavfi -i "sine=f=2200:d=0.014" -f lavfi -i "sine=f=320:d=0.05" \
  -filter_complex "[0:a]volume=-6dB[a];[1:a]volume=-6dB,afade=t=out:st=0.01:d=0.04[b];[a][b]amix=inputs=2:duration=longest:normalize=0" \
  -ar 48000 -ac 2 -c:a pcm_s16le "$out"
echo "written $out"
