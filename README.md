# cortes-aula-motion

Skill do Claude Code para editar cortes verticais (Reels, Shorts, anúncios — 1080×1920) a partir de aulas gravadas com slide + webcam, em motion (Remotion).

Não tem identidade visual própria: use junto com a skill de marca do cliente (`/id-visual-*`).

## Instalar

Windows (Git Bash ou PowerShell):

```bash
git clone https://github.com/EduardoStrobe/cortes-aula-motion.git "$HOME/.claude/skills/cortes-aula-motion"
```

Abra uma sessão nova do Claude Code. A skill aparece como `/cortes-aula-motion`.

## Atualizar

```bash
git -C "$HOME/.claude/skills/cortes-aula-motion" pull
```

## Requisitos

Node 20+, ffmpeg, Python 3.12 com Pillow, numpy e faster-whisper.

## Observação

`assets/motor/` é o motor (Remotion). Os storyboards `c1…c6` que vêm nele são exemplos de estrutura com texto neutro; a mídia não acompanha. Cores e fonte do template são padrão de fábrica: troque pela marca do seu cliente antes de produzir.
