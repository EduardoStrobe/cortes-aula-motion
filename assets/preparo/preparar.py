# Gera cortes.json: faixas ajustadas ao silencio + legendas corrigidas alinhadas as palavras do Whisper
import json, re, wave, difflib
import numpy as np
segs = json.load(open('janelas.json', encoding='utf-8'))
W = [dict(w=w['w'].strip(), s=w['s'], e=w['e']) for s in segs for w in s['words']]
wv = wave.open('audio16k.wav', 'rb'); SR = wv.getframerate()
def db(t0, t1):
    wv.setpos(max(int(t0 * SR), 0)); a = np.frombuffer(wv.readframes(int((t1 - t0) * SR)), dtype=np.int16).astype(np.float32) / 32768
    n = len(a) // 160; e = (a[:n * 160].reshape(n, 160) ** 2).mean(axis=1)
    return 10 * np.log10(e + 1e-10)
def snap(t, direction):
    """procura o ponto mais silencioso perto de t (para tras no inicio, para frente no fim)"""
    span = 0.35 if direction < 0 else 0.45
    t0, t1 = (t - span, t + 0.02) if direction < 0 else (t - 0.02, t + span)
    d = db(t0, t1); k = np.convolve(d, np.ones(5) / 5, mode='same')
    i = int(np.argmin(k)); return round(t0 + i * 0.01 + 0.01, 3), float(k[i])
norm = lambda x: re.sub(r'[^\wà-ú]', '', x.lower())
def align(ws, text):
    new = text.split(); a = [norm(w['w']) for w in ws]; b = [norm(x) for x in new]; out = []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == 'equal':
            for i, j in zip(range(i1, i2), range(j1, j2)): out.append(dict(w=new[j], s=ws[i]['s'], e=ws[i]['e']))
        elif tag in ('replace', 'insert'):
            if i2 > i1: s, e = ws[i1]['s'], ws[i2 - 1]['e']
            else:
                s = ws[i1 - 1]['e'] if i1 > 0 else ws[0]['s']; e = ws[i1]['s'] if i1 < len(ws) else s + 0.3
            n = j2 - j1
            for k in range(n): out.append(dict(w=new[j1 + k], s=s + (e - s) * k / n, e=s + (e - s) * (k + 1) / n))
    return out
# Um item por corte: id, nome do arquivo, titulo (2 linhas, *palavra* = destaque) e as partes do bruto que entram:
# (inicio em segundos, fim em segundos, 'fala corrigida daquele trecho').
CLIPS = [
 dict(id='c1', arquivo='01-exemplo.mp4', titulo=['Primeira linha', 'com *destaque*?'], partes=[
  (100.00, 112.50, 'Fala literal do primeiro trecho, corrigida.'),
  (140.20, 151.00, 'Fala literal do segundo trecho, corrigida.')]),
]
out = []
for c in CLIPS:
    ranges, words = [], []
    for a, b, txt in c['partes']:
        ws = [w for w in W if a - 0.05 <= w['s'] < b - 0.02]
        a2, da = snap(ws[0]['s'], -1); b2, dbv = snap(ws[-1]['e'], +1)
        ranges.append([a2, b2]); words += align(ws, txt)
        print(f"{c['id']} {a:.2f}->{a2:.2f} ({da:.0f} dB)  {b:.2f}->{b2:.2f} ({dbv:.0f} dB)  {len(ws)} palavras -> {len(txt.split())}")
    out.append(dict(id=c['id'], arquivo=c['arquivo'], titulo=c['titulo'], ranges=ranges, words=words))
    print(f"   total {sum(b - a for a, b in ranges):.1f}s")
json.dump(out, open('cortes.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
