---
name: cortes-aula-motion
description: Edita cortes verticais (Reels, Shorts, anúncios — 1080×1920) a partir de aulas ou apresentações gravadas com slide + webcam, em motion (Remotion) — escolha dos trechos, gancho, legendas sincronizadas palavra a palavra, imagem do slide em destaque com marcações desenhadas, bloco da câmera do apresentador, um visual por corte e fechamento com CTA. É BRAND-AGNOSTIC — não tem cor, fonte nem logo próprios; consome a identidade visual da skill /id-visual-* carregada junto. Use sempre que pedirem "cortes da aula", "cortes verticais", "reels da aula", "teaser da aula", "leva de cortes", "transformar aula em reels", ou ajustes em cortes já feitos — mesmo sem citar a palavra skill. Não usar para vídeo falado direto para a câmera sem slide (use it-reelsmaker), nem para carrossel, post estático ou landing page.
---

# /cortes-aula-motion — cortes verticais de aula em motion

Padrão de edição construído e aprovado em produção (seis levas de revisão com cliente). Esta skill entrega **só a edição**: estrutura do corte, ritmo, layout, sincronia e render. **A marca não mora aqui.**

## Antes de qualquer coisa: três perguntas

Faça com AskUserQuestion, de uma vez, e só o que ainda não foi respondido na conversa:

1. **Identidade visual.** Qual skill `/id-visual-*` usar? Se nenhuma estiver carregada, peça para o usuário indicar e carregue. Sem identidade visual não comece: esta skill não inventa cor, fonte ou logo.
2. **Nível da edição.**
   - **Minimalista (recomendado, é o que foi aprovado por último):** só a manchete no topo, a imagem do slide grande, legenda embaixo, marcações desenhadas sobre a imagem (círculos, traços, colchetes, anel do cursor). Logo apenas no fechamento.
   - **Com mais elementos:** além disso, selo de série ("CASO 01"), linha de contexto acima da manchete, ícone temático, contagem regressiva, objetos ilustrativos animados ligados à fala, cartões e etiquetas, pílulas de pergunta.
3. **Material.** Qual gravação, quantos cortes, e se já tem trechos em mente.

Se o usuário já disse algo equivalente ("faz clean", "pode encher de animação"), não pergunte de novo.

## O que cada nível liga no motor

| Elemento | Minimalista | Com mais elementos |
|---|---|---|
| Manchete do gancho | sim | sim |
| Linha de contexto, selo de série, ícone no topo | não (`layout.clean: true`) | sim |
| Logo no início | não | opcional |
| Contagem regressiva / "sua vez" | sim, discreta | sim |
| Marcações que desenham ou circulam (Ring, Trace, Brackets, CursorHalo, CountTick, Guide) | **sim, sempre** | sim |
| Etiquetas pequenas nos cantos da imagem (Chip) | poucas, só fala literal | sim |
| Objetos ilustrativos sobre a imagem (Prop), cartões, faixas de texto, escurecimento de áreas | **não** | sim, sem tampar o achado |
| Pílulas de pergunta no gancho | não | sim |
| Logo no fechamento | sim | sim |

Regra que vale nos dois níveis: **a imagem do slide é a protagonista** e ocupa parte considerável da tela o tempo todo. No nível "com mais elementos" o que entra a mais nunca cobre a região de que a fala está tratando.

## Regras do padrão (valem para qualquer marca)

- **Objetivo:** fisgar com uma pergunta ou frase literal do apresentador, mostrar o caso e **não entregar a resposta**. Fecha com um CTA para o conteúdo completo.
- **Duração:** 18 a 46 s por corte.
- **Texto na tela:** só fala literal, pergunta neutra ou rótulo que já está visível no slide. Nada inventado.
- **Privacidade:** nada de nome ou dado de terceiros, outros participantes da chamada, nem rótulos gravados na webcam. Tarjas que escondem resposta ou dado sensível ficam, mesmo no minimalista.
- **Áreas cobertas pela interface do Instagram:** conteúdo importante fora de y < 220, y > 1500 e x > 960.
- **Câmera do apresentador:** bloco retangular grande na parte de baixo (624×396 px), rosto inteiro, nome embaixo da foto, nada por cima do rosto. Ela nunca toma o lugar da imagem do slide.
- **Sincronia:** legenda e elementos entram junto com a palavra falada (±2 quadros).
- **Áudio:** −14 LUFS, pico ≤ −1 dBTP; efeitos (tick, pop, whoosh) discretos sob a fala.
- **Um visual por corte**, para a série não parecer o mesmo post no feed. Os visuais são variações da mesma marca (ver abaixo).

## Como a identidade visual entra

O motor tem as cores, fontes e logos em poucos lugares. Ao iniciar um projeto, preencha-os com os tokens da skill `/id-visual-*` carregada — nunca com os valores que vieram no template:

| O que | Onde no motor |
|---|---|
| Cores base (fundo, texto, texto secundário, linha, acento, gradientes) | `src/aula/tokens.ts` (`C_DEFAULT`) |
| Fontes (arquivos e pesos) | `public/fonts/` + `src/aula/fonts.tsx` |
| Visuais por corte (fundos, tintas, destaque) | `src/aula/look.ts` (`LOOKS`) |
| Logos | `public/brand/` + `components/Looks.tsx` e `components/Closing.tsx` |
| Nome do apresentador, nome da aula, texto do CTA | `components/FaceBubble.tsx`, `components/Closing.tsx`, bloco `closing` do storyboard |

O template veio de um projeto real. Os storyboards `c1…c6` e os dados em `src/data/` estão com texto neutro ("TEXTO DE EXEMPLO", "palavra") e servem só como exemplo de estrutura: não renderizam, porque a mídia do projeto original não acompanha. As cores e a fonte que vieram no template (grafite, azul, Manrope) são padrão de fábrica: troque pelos tokens da marca do usuário, e coloque os logos dela em `public/brand/`.

**Montando os visuais com qualquer paleta** (ids em `look.ts`):

| Look | Receita |
|---|---|
| padrão | fundo escuro da marca, texto claro, palavra de destaque na cor de acento |
| `branco` | fundo claro da marca, texto escuro, destaque em acento |
| `tela-cheia` | imagem do slide de borda a borda sob degradê do fundo escuro; manchete sobre a parte de baixo |
| `azul-claro` / `azul-bebe` | fundo em tom claro derivado do acento, texto escuro |
| `duas-cores` | metade de cima escura, metade de baixo no tom claro do acento; cada elemento usa a tinta da metade em que está |
| Negatoscópio (ALT) | sala escura com caixa de luz; só faz sentido para imagem médica ou fotográfica |

Contraste mínimo 4,5:1 em tudo. Quando o fundo é da família do acento, a palavra de destaque não usa o acento (some): vai em tarja escura com texto claro, e o logo vai em cartão branco. Tons novos derivados do acento são cor nova para a marca: avise o usuário e peça o ok.

## Montando o projeto

1. Copie `assets/motor/` desta skill para a pasta do cliente no workspace (ex.: `<cliente>/cortes-<aula>/motion/`) e `assets/preparo/` para `<cliente>/cortes-<aula>/trabalho/`. Trabalhe sempre na cópia, nunca dentro da skill.
2. Na cópia: `npm install`.
3. Leia `src/aula/ENGINE.md` (contrato do motor; seção 14 = visuais) e `spec/SYSTEM.md` (sistema visual, áreas seguras).
4. Aplique a identidade visual (tabela acima).
5. **Meça a gravação.** O motor recorta o slide e a webcam por coordenadas fixas (`SLIDE`, `SLIDE_PROXY`, `CAM_PROXY` em `tokens.ts`; recortes em `scripts/prep_media.py`). Cada plataforma e layout de gravação tem as suas: tire um quadro da gravação, meça as duas regiões e ajuste antes de preparar a mídia.

Requisitos: Node 20+, ffmpeg, Python 3.12 com Pillow, numpy e faster-whisper.

## Fluxo de produção

1. **Transcrever** com tempo por palavra (`trabalho/transcrever.py`).
2. **Propor os trechos em texto**: fala inicial, duração, e o que não pode ser revelado em cada um. Esperar o ok.
3. **Preparar cada trecho**: `preparar.py` (ajusta os cortes ao silêncio), `fontes_motion.py` (gera o bruto e os dados de palavras de cada corte; ajuste a constante `SRC` para a gravação), depois em `motion/`: `scripts/prep_media.py`, `scripts/face_track.py`, `scripts/onsets.py`.
4. **Storyboard** de cada corte em `src/storyboards/<id>.json` (os `c1…c6` do template são referência de estrutura), registrado em `src/aula/storyboards.ts`. Visual por corte: uma linha `pilot(cN, "<look>")`.
5. **Preview barato:** um print do primeiro quadro de cada corte, para aprovar direção antes de animar.
6. **Piloto:** renderizar um corte e aprovar.
7. **Demais cortes** em sequência, com a checagem leve abaixo.
8. **Entregar** numa pasta `leva N`; cada rodada de ajustes vira uma pasta nova, sem sobrescrever a anterior.

Checagem por corte antes de entregar: resposta não revelada; privacidade; rosto inteiro no bloco; texto fora das áreas cobertas; nada tampando a imagem (no minimalista); contraste; volume medido.

## Comandos (dentro de `motion/`)

Quadros de conferência:

```bash
node scripts/stills.mjs rp-c2 --frames 0,240,600,1090 --scale 0.35 --out out/chk
```

Render de um corte (porta dedicada e correção do atraso de 43 ms do áudio AAC):

```bash
node scripts/render.mjs rp-c2 out/final/rp-c2.mp4
```

Checar tipos depois de editar:

```bash
npm run typecheck
```

- Um render por vez: vários processos do Remotion juntos falham em máquinas com pouca RAM.
- Render roda na máquina e não consome limite de uso; ler imagens consome. Monte uma tira com poucos quadros por corte em vez de abrir dezenas.

## Ajustes mais pedidos e onde ficam

Tudo que é específico de um visual vai no bloco `looks` do storyboard, que só vale para aquele look:

```json
"looks": { "branco": { "patchBeats": { "idDoBeat": null }, "hook": {}, "camera": [] } }
```

- **Tirar um elemento:** `"patchBeats": { "<id>": null }`; se o id estiver em `closing.keep`, sobrescreva `closing.keep`.
- **Topo limpo (minimalista):** `layout.clean: true` no look. Tira ícone, selo e linha de contexto, sobe a manchete e aumenta a imagem na abertura.
- **Imagem maior / reenquadrar:** `look.layout.stage` e as chaves de `camera` e `hook.slot.cam`. Ao aumentar a caixa, confira se uma tarja de privacidade (`patches`) não passou a aparecer.
- **Bloco da câmera, legenda e nome:** `Z.cam`, `Z.caption`, `Z.nameTag` em `tokens.ts`.
- **Cores de um visual:** `LOOKS` em `look.ts`; nunca cor solta em componente.

## Jeito de trabalhar

- Piloto e preview antes de produzir em lote.
- Ajustes direto, sem agentes em paralelo, a menos que o usuário peça: a parte cara é olhar quadros, e paralelizar multiplica esse custo.
- Em tarefa longa, conferir o uso e avisar antes de chegar perto do limite.
- Dizer sempre o que não foi verificado: a conferência é por quadros e medição de volume, não assistindo nem ouvindo.
- Marcações sobre conteúdo técnico (anatomia, gráficos, código) precisam do aval do especialista antes de publicar.

## Limites conhecidos

- Se o apresentador sai do enquadramento da webcam, o bloco mostra o que a gravação tem; a alternativa é congelar um quadro bom, com a boca parada.
- Silêncio no início de um trecho só sai refazendo a base daquele corte.
- O formato Negatoscópio é um módulo à parte (`src/aula/alt/`); mudanças nos looks não chegam nele.
- O template não foi testado com outra gravação além da original: espere ajustar coordenadas de recorte e textos fixos na primeira vez.
