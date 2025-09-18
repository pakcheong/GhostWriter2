# Ghostwriter — SEO Article Generator

A TypeScript / Vercel AI SDK–based pipeline that generates SEO-ready blog articles (JSON/HTML/Markdown) for WordPress.

- Providers: **OpenAI** and **Deepseek**
- Multi-language output (`--lang`)
- Model-aware pricing estimates (from `.env` or CLI)
- Context strategies for cohesion across sections
- Strict Markdown body (no HTML), with safe HTML→Markdown fallback
- Output formats: `json`, `html`, `md`
- Verbose timing (per section) and total runtime

---

## Features

- **Two-phase generation**: _outline → subsections_ (+ optional per-section summary).
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
  --provider openai \
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
| `--provider` | `openai`\|`deepseek` | `openai` | Provider. |
| `--model` | string | From `.env` (`OPENAI_MODEL`/`DEEPSEEK_MODEL`) | Model id to use. |
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
| `--verbose` | flag | off | Prints per-section timing + usage/cost tables. |

---

## Flow

1. **Outline generation**: article structure (title, description, tags, categories, sections + subheadings).
2. **Section generation**: each subheading expanded into Markdown content with `[image]` placeholder.
   - Context may include previous sections (`full`) or summaries (`summary`).
3. **Summaries** (optional): concise per-section summaries if `--context summary`.
4. **Assembly**: combine into full article object.
5. **Export**: write JSON/HTML/Markdown outputs into `result/` (or `--outdir`).

---

## License

MIT
