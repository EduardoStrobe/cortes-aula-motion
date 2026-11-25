# Gera, para o Remotion, o bruto de cada corte (1920x1080, faixas concatenadas) + dados (palavras na linha do tempo do corte) + quadros de referencia
import json, os, subprocess
BASE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(BASE)
SRC = os.path.join(ROOT, "fonte", "gravacao.mp4")
PUB = os.path.join(ROOT, "motion", "public"); DATA = os.path.join(ROOT, "motion", "src", "data")
REF = os.path.join(ROOT, "motion", "ref")
for d in (PUB, DATA, REF): os.makedirs(d, exist_ok=True)
clips = json.load(open(os.path.join(BASE, "cortes.json"), encoding="utf-8"))
FPS = 30
def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode: print(r.stderr[-2000:]); raise SystemExit(1)
for c in clips:
    cid = c["id"]; parts = []; words = []; t0 = 0.0; segs = []
    for i, (a, b) in enumerate(c["ranges"]):
        # arredonda a duracao para quadros inteiros
        n = round((b - a) * FPS); dur = n / FPS
        p = os.path.join(BASE, f"{cid}_p{i}.mp4")
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.3f}", "-i", SRC, "-t", f"{dur:.4f}",
             "-vf", f"fps={FPS},format=yuv420p", "-af", f"aresample=48000,afade=t=in:d=0.03,afade=t=out:st={dur-0.03:.3f}:d=0.03",
             "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-g", "15", "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2",
             p.replace(".mp4", ".mov")])
        parts.append(p.replace(".mp4", ".mov"))
        for w in c["words"]:
            if a - 0.02 <= w["s"] < b:
                words.append({"w": w["w"], "s": round(w["s"] - a + t0, 3), "e": round(min(w["e"], b) - a + t0, 3), "seg": i})
        segs.append({"i": i, "src_start": a, "src_end": a + dur, "out_start": round(t0, 3), "out_dur": round(dur, 3)})
        t0 += dur
    lst = os.path.join(BASE, f"{cid}_list.txt")
    open(lst, "w", encoding="utf-8").write("".join(f"file '{p.replace(os.sep, '/')}'\n" for p in parts))
    out = os.path.join(PUB, cid); os.makedirs(out, exist_ok=True)
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
         "-movflags", "+faststart", os.path.join(out, "video.mp4")])
    for p in parts: os.remove(p)
    # palavras: garante ordem e sem sobreposicao
    words.sort(key=lambda w: w["s"])
    for k in range(len(words) - 1):
        if words[k]["e"] > words[k + 1]["s"]: words[k]["e"] = words[k + 1]["s"]
    data = {"id": cid, "arquivo_v1": c["arquivo"], "fps": FPS, "duracao": round(t0, 3), "frames": round(t0 * FPS),
            "video": f"{cid}/video.mp4", "largura": 1920, "altura": 1080,
            "slide": {"x": 7, "y": 84, "w": 1367, "h": 912}, "cam": {"x": 1503, "y": 389, "w": 417, "h": 302},
            "segmentos": segs, "palavras": words, "texto": " ".join(w["w"] for w in words)}
    json.dump(data, open(os.path.join(DATA, f"{cid}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    # quadros de referencia: slide recortado (tamanho real 1367x912) no inicio de cada segmento e a cada ~6 s
    ts = sorted(set([round(s["out_start"] + 0.5, 1) for s in segs] + [round(x, 1) for x in [t0 * k / 6 for k in range(1, 6)]]))
    for t in ts:
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t}", "-i", os.path.join(out, "video.mp4"), "-frames:v", "1",
             "-vf", "crop=1367:912:7:84", os.path.join(REF, f"{cid}_slide_{t:05.1f}s.png")])
    run(["ffmpeg", "-v", "error", "-y", "-ss", "1", "-i", os.path.join(out, "video.mp4"), "-frames:v", "1", os.path.join(REF, f"{cid}_full_1s.png")])
    print(cid, f"{t0:.2f}s", len(words), "palavras", len(ts), "quadros")
