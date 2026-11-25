import sys, json
from faster_whisper import WhisperModel
wav, out, model, t0, t1 = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5])
m = WhisperModel(model, device="cpu", compute_type="int8", cpu_threads=8)
kw = dict(language="pt", word_timestamps=True, vad_filter=True, beam_size=5,
          initial_prompt=""  # termos do assunto da gravacao, para ajudar a transcricao)
if len(sys.argv)>6: kw["clip_timestamps"] = [float(x) for x in sys.argv[6].split(",")]
import wave, numpy as np
w_=wave.open(wav,"rb"); audio=np.frombuffer(w_.readframes(w_.getnframes()),dtype=np.int16).astype(np.float32)/32768.0
segs, info = m.transcribe(audio, **kw)
res = []
with open(out + ".txt", "w", encoding="utf-8") as ft:
    for s in segs:
        res.append({"start": s.start, "end": s.end, "text": s.text.strip(),
                    "words": [{"w": w.word, "s": w.start, "e": w.end} for w in (s.words or [])]})
        ft.write(f"[{s.start:8.2f} - {s.end:8.2f}] {s.text.strip()}\n"); ft.flush()
json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)
print("done", len(res))
