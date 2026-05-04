# Whitebeard second-brain (Obsidian)

Plugin **read-only** para abrir a nota actual no painel web a partir do Obsidian.

## Instalacao manual

1. Crie a pasta do plugin dentro do vault:
  `<seu-vault>/.obsidian/plugins/whitebeard-second-brain/`
2. Copie `main.js`, `manifest.json` e `styles.css` (se existir) para essa pasta.
3. Em Obsidian: **Settings → Community plugins** e active *Whitebeard second-brain*.

## Build

```bash
cd obsidian-plugin/whitebeard-second-brain
npm install
npm run build
```

O ficheiro `main.js` e gerado em `dist/`. Copie para a pasta do plugin.

## Configuracao

- **Web UI base URL** — ex.: `https://app.seudominio.com` (sem path `/api`).

## Comandos

- **Whitebeard: open in WebUI** — abre o browser com a nota (usa `id` do frontmatter e, em ultimo caso, o caminho do ficheiro). Requer `id` de nota no frontmatter e URL base nas settings.

## Status bar

Mostra o commit actual do repositório git do vault (desktop; `git rev-parse HEAD`).

## Notas

- Nao envia credenciais: sessão no browser continua a ser a do utilizador.
- O deep link segue o mesmo padrão que o backend `GET /vault/notes/:id/resolve` → `webPath` relativo.

