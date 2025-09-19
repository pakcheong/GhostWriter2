# Ghostwriter — SEO Article Generator

TypeScript + Vercel AI SDK pipeline that generates SEO-ready blog articles (JSON/HTML/Markdown) for WordPress.

- Models: **OpenAI** + **Deepseek** (auto-mapped; no provider flag)
- Multi-language output (`--lang`)
- Model-aware pricing estimates (from `.env` or CLI)
- Context strategies for cohesion across sections
- Strict Markdown body (no HTML), with safe HTML→Markdown fallback
- Output formats: `json`, `html`, `md`
- Verbose timing (per section) and total runtime

---

## Features

- **Two-phase generation**: _outline → subsections_ (+ optional per-section summary).
- **Duplicate-aware outline** with merge + retry; status = `success|warning`.
- **Context strategies**:
  - `outline`: minimal context (fastest)
  - `full`: includes previous sections
  - `summary`: includes summaries of previous sections
- **Strict Markdown** with `**bold**` emphasis; HTML is auto-converted via Turndown if it leaks.
- **Image placeholders**: each subsection includes one `[image]an image description[/image]`.
- **Exports**: any combination of `json`, `html`, `md`.
- **Pricing & usage**: token usage and cost estimates, model-aware via `.env` (or `--price-in/out` overrides).
- **Verbose mode**: final table with **per-section timing** and **total runtime**; optional usage/cost table.

---

## Install

```bash
npm i
```

Node 18+ recommended.

---

## Environment

Create a `.env` file at project root:

```env
# generic fallbacks (used only if model-specific prices are not set)
PRICE_IN=0
PRICE_OUT=0

# OpenAI
OPENAI_API_KEY=sk-xxxx
OPENAI_MODEL=gpt-4o-mini
PRICE_GPT4O_MINI_IN=0.0003
PRICE_GPT4O_MINI_OUT=0.0006
PRICE_GPT4O_IN=0.0025
PRICE_GPT4O_OUT=0.01

# Deepseek
DEEPSEEK_API_KEY=sk-xxxx
DEEPSEEK_MODEL=deepseek-chat
PRICE_DEEPSEEK_CHAT_IN=0.0002
PRICE_DEEPSEEK_CHAT_OUT=0.0004
PRICE_DEEPSEEK_CODER_IN=0.0005
PRICE_DEEPSEEK_CODER_OUT=0.001
```

> Prices are per **1K tokens** (input/output). You can override via `--price-in` and `--price-out`.

---

## Build

```bash
npm run build
```

Build artifacts go to `dist/`.

---

## CLI Usage

Development (tsx):

```bash
npx tsx ./scripts/generate-article.ts \
  --model gpt-4o-mini \
  --topic "React 19: What Changes for Production Apps" \
  --keywords "react 19, transitions, actions, server components" \
  --min 1200 \
  --max 1800 \
  --tags "react,frontend,release" \
  --categories "technology,web" \
  --style "actionable, authoritative, developer-friendly" \
  --lang en \
  --context summary \
  --export all \
  --out react-19-production \
  --outdir ./result \
  --verbose
```

After build:

```bash
node ./dist/scripts/generate-article.js [options...]
```

### Options

| Flag | Type | Default | Description |
|---|---|---|---|
| `--model` | string | From `.env` (`OPENAI_MODEL`/`DEEPSEEK_MODEL`) | Model id (provider inferred). |
| `--topic` | string | `"The Future of AI in Web Development"` | Article topic seed. |
| `--keywords` | csv | `"AI in web development, JavaScript, SEO blog"` | Global keywords to emphasize (`**bold**`). |
| `--min` | number | `1000` | Target minimum words. |
| `--max` | number | `1400` | Target maximum words. |
| `--tags` | csv | `"javascript, web development, ai"` | Existing tags to reuse when relevant. |
| `--categories` | csv | `"technology, programming"` | Existing categories to reuse when relevant. |
| `--style` | string | `"helpful, concise, SEO-aware"` | Style/tone notes. |
| `--lang` | string | `en` | Output language for text and image prompts. |
| `--context` | `outline`\|`full`\|`summary` | `outline` | Cohesion strategy across sections. |
| `--export` | `json`\|`html`\|`md`\|`both`\|`all` | `json` | Output format(s). |
| `--out` | string | Derived from slug | Base filename (no extension). |
| `--outdir` | string | `./result` | Output directory. |
| `--price-in` | number | from `.env` | Override input token price. |
| `--price-out` | number | from `.env` | Override output token price. |
| `--verbose` | flag | on (unless --quiet) | Prints per-section timing + usage/cost tables. |

---

## Flow

1. **Outline generation**: article structure (title, description, tags, categories, sections + subheadings).
2. **Section generation**: each subheading expanded into Markdown content with `[image]` placeholder.
   - Context may include previous sections (`full`) or summaries (`summary`).
3. **Summaries** (optional): concise per-section summaries if `--context summary`.
4. **Assembly**: combine into full article object.
5. **Export**: write JSON/HTML/Markdown outputs into `result/` (or `--outdir`).

---

## Architecture

The codebase is now modularized for clarity and testability:

| Module | Purpose |
|--------|---------|
| `src/generate-article.ts` | Orchestrator + CLI entry (when run directly); coordinates outline, sections, summaries, assembly, export. |
| `src/types.ts` | Shared type definitions (providers, strategies, article/result interfaces, timing structs). |
| `src/prompts.ts` | All prompt construction helpers (outline / section / summary). Pure string builders. |
| `src/model-config.ts` | Model→provider client resolution (OpenAI / Deepseek) |
| (removed) `src/provider.ts` | Legacy (deleted) |
| `src/usage.ts` | Usage extraction + token fallback estimation. |
| `src/pricing.ts` | Price resolution logic (CLI > model-specific env > global env). |
| `src/assembly.ts` | Article assembly + filename utilities + HTML/Markdown document builders + duration formatting. |
| `src/utils.ts` | Cross-cutting utilities: Markdown sanitation, HTML→Markdown, token estimation, cost helpers. |
| `tests/*.test.ts` | Lightweight assertion-based tests (no framework) for prompts, pricing, assembly. |

### Data / Control Flow
1. CLI parses args → resolves model + pricing.
2. `generateOutlineInternal` builds outline prompt → model call → JSON sanitized.
3. For each section/subheading: `generateSubsectionMarkdownInternal` builds contextual messages + model call.
4. Optional summaries per section when `contextStrategy === 'summary'`.
5. `assembleArticle` combines sanitized blocks → `ArticleJSON` enriched with usage + cost.
6. Export helpers produce `json`, `html` (Markdown → HTML), and `md` (front matter style) files.

### Extending
- Add a new model: extend `MODEL_PROVIDER_MAP` in `generate-article.ts` (maps model id → provider).
- New context strategy: adjust loop in `generate-article.ts` and add message injection logic similar to `full/summary` branches.
- Additional export format: implement in `assembly.ts` (e.g., `buildRssItem`) and wire into export switch.
- More pricing models: expand `MODEL_ENV_MAP` in `pricing.ts`.

### Testing Philosophy
Deterministic tests use a mock `__setGenerateTextImpl` to avoid network calls and assert:
- JSON shape (no `provider`, includes `timings`, `sectionTimings`, `status`).
- Callback invocation (`onArticle`).
- Pricing & usage aggregation.

### Callback
`onArticle?: (article: ArticleJSON) => void | Promise<void>` fires after the article object (with timings/status) is built and before function returns. Use it for streaming, additional persistence, or custom logging.

### Timings & Status
`article.timings` includes `outlineMs`, `assembleMs`, `exportMs`, `totalMs`, `outlineAttempts`.
`article.sectionTimings[]` lists per-section + per-subheading durations.
`article.status` is `warning` if collapsed duplicate ratio in outline > 20%, else `success`.

---

## License

MIT
