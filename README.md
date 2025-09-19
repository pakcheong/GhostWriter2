# Ghostwriter — SEO Article Generator

TypeScript + Vercel AI SDK pipeline that generates SEO-ready blog articles (JSON/HTML/Markdown) for WordPress.

- Models: **OpenAI** + **Deepseek** + **LM Studio (local)** (auto-mapped; no provider flag)
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

Create a `.env` file at project root (see `.env.example` for the full template):

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

# LM Studio (Local, optional)
# If you run LM Studio's OpenAI-compatible server. Example: remote host 192.168.2.11
LMSTUDIO_MODEL=openai/gpt-oss-20b
LMSTUDIO_BASE_URL=http://192.168.2.11:1234/v1
# LMSTUDIO_API_KEY=optional-if-required
# LMSTUDIO_TIMEOUT_MS=900000        # (optional) request timeout (default 15m)
# LMSTUDIO_STREAM=1                 # (optional) enable streaming accumulation
# LMSTUDIO_WARM=1                   # (optional) initial /models warmup (default on)
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
npx tsx ./src/generate-article.ts \
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
node ./dist/src/generate-article.js [options...]
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
| (programmatic) `namePattern` | string | none | Pattern tokens: `[timestamp]`, `[date]`, `[time]`, `[slug]`, `[title]`. Overrides `--out`. |
| `--price-in` | number | from `.env` | Override input token price. |
| `--price-out` | number | from `.env` | Override output token price. |
| `--verbose` | flag | on (unless --quiet) | Prints per-section timing + usage/cost tables. |

---

## Architecture & Flow

Why two phases? Outline-first keeps structure coherent and lets you retry/merge duplicates cheaply before spending tokens on full sections.

1. Outline generation → structured JSON (title, description, tags, categories, sections + subheadings)
2. Section generation → Markdown blocks (one `[image]...[/image]` placeholder per subheading)
3. Optional summaries (only when `contextStrategy=summary`) → lightweight cohesion context
4. Assembly → combine + compute usage, costs, timings
5. Export → write selected formats (JSON/HTML/MD)

Context strategy trade‑offs:
- outline: fastest, lowest token use, weakest intra-section cohesion
- full: highest cohesion (previous full sections appended) but slower and higher token usage
- summary: middle ground; small per-section summaries reduce prompt growth

Performance tips:
- Use `outline` for bulk generation / draft mode.
- Switch to `summary` when sections start referencing earlier material.
- Use `full` only for highly narrative articles; watch token cost.
- LM Studio: enable streaming (`LMSTUDIO_STREAM=1`) to reduce large response latency perception; keep warmup on.

Programmatic usage:
```ts
import { generateArticle } from './src/generate-article.js';

const { article, files } = await generateArticle({
  topic: 'Edge Caching Strategies in 2025',
  keywords: ['cdn','cache-control','stale-while-revalidate'],
  existingTags: ['performance'],
  existingCategories: ['infrastructure'],
  contextStrategy: 'summary',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  exportModes: ['json','md'],
  verbose: true,
  onArticle(a) { console.log('Generated:', a.slug, 'in', a.timings.totalMs, 'ms'); }
});

console.log('Files:', files);
```

Export modes:
- `json` → structured article object (includes timings, usage, cost)
- `html` → Minimal HTML document (Markdown converted)
- `md` → Front-matter style Markdown
- `both` → Convenience alias for `html` + `md`
- `all` → `json` + `html` + `md`

Pricing resolution order (first match wins):
1. CLI flags: `--price-in`, `--price-out`
2. Model-specific env: e.g. `PRICE_GPT4O_MINI_IN`, `PRICE_DEEPSEEK_CHAT_OUT`
3. Global env: `PRICE_IN`, `PRICE_OUT`
4. If none found → `article.cost` omitted

Usage collection:
- If provider returns usage (OpenAI, Deepseek), real counts are used.
- If missing (some LM Studio configs / streaming), heuristic token estimation fallback ensures totals are still present.

Duplicate outline handling:
- After generation, headings are normalized & merged.
- Duplicate ratio = (originalHeadingCount - dedupedHeadingCount) / originalHeadingCount.
- If ratio > 0.2 a single retry occurs; final status becomes `warning` if still > 0.2.

Troubleshooting:
| Symptom | Likely Cause | Fix |
|--------|--------------|-----|
| 404 from API | Wrong base URL or model id | Check env model vars; Deepseek requires `/v1`; LM Studio server running? |
| Timeout (LM Studio) | Model cold / large load | Increase `LMSTUDIO_TIMEOUT_MS`, enable `LMSTUDIO_STREAM=1`, keep warmup on |
| High duplicate ratio | Model repetitive outline | Adjust topic/keywords, accept warning, or retry manually |
| Empty cost section | No pricing vars resolved | Set model-specific or global pricing env, or pass CLI overrides |
| Large prompts slow | Using `full` context | Switch to `summary` or `outline` |
| Missing usage tokens | Local provider no usage field | Accept heuristic estimation (still reflected in `usage.total`) |
| Unknown model error | MODEL_PROVIDER_MAP miss | Add mapping entry in source and rebuild |

Security / safety:
- Never commit real API keys.
- Generated content is not guaranteed factual; review before publishing.

Result directory structure example (with `all`):
```
result/
  edge-caching-strategies-in-2025.json
  edge-caching-strategies-in-2025.html
  edge-caching-strategies-in-2025.md
```

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

#### LM Studio Models
Local models served via LM Studio are treated as `provider = lmstudio` and use an OpenAI-compatible API. To map a custom local model id (as shown in LM Studio UI) add an entry:

```ts
// in generate-article.ts
const MODEL_PROVIDER_MAP = {
  ...,
  'my-local-model': 'lmstudio'
};
```

Environment variables:
```env
LMSTUDIO_MODEL=my-local-model
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_API_KEY=optional
```
If `LMSTUDIO_API_KEY` is not set a placeholder key is used (LM Studio usually does not require one locally).

### Testing Philosophy
Deterministic tests use a mock `__setGenerateTextImpl` to avoid network calls and assert:
- JSON shape (no `provider`, includes `timings`, `sectionTimings`, `status`).
- Callback invocation (`onArticle`).
- Pricing & usage aggregation.

### Callback
`onArticle?: (article: ArticleJSON) => void | Promise<void>` fires after the article object (with timings/status) is built and before function returns. Use it for streaming, additional persistence, or custom logging.

Example callback payload (annotated):

```jsonc
{
  "title": "React 19: Key Changes Impacting Production Apps", // Article title generated in outline phase
  "description": "Explore significant updates in React 19 and their implications...", // Short SEO meta description
  "body": "## Introduction\n...", // Complete Markdown body (sections + subheadings)
  "tags": ["react", "frontend", "release"], // Final tag set (normalized & deduped)
  "categories": ["technology", "web"], // Final category set
  "slug": "react-19-key-changes-impacting-production-apps", // URL/file-safe slug derived from title
  "model": "gpt-4o-mini", // Model id used (provider inferred internally)
  "status": "success", // 'success' | 'warning' (warning when duplicate outline ratio > 20%)
  "timings": {
    "totalMs": 8421, // End-to-end runtime including export phase
    "outlineMs": 612, // Time to generate (and possibly retry) outline
    "assembleMs": 15, // Time to assemble article object & aggregate metrics
    "exportMs": 58, // Time writing non-JSON exports
    "outlineAttempts": 1, // Number of outline generations (max 2 when duplication high)
    "startTime": 1758267800123, // Epoch ms when run started
    "endTime": 1758267808544 // Epoch ms when run finished
  },
  "sectionTimings": [
    {
      "heading": "Introduction", // Section H2 heading
      "subheadingCount": 3, // Number of subheadings expanded under this section
      "ms": 1120, // Total ms for all subheadings (+ summary if generated)
      "subTimings": [ // Per-subheading generation durations
        { "title": "Why React 19 Matters", "ms": 340 },
        { "title": "Release Cadence Changes", "ms": 392 },
        { "title": "Ecosystem Impact", "ms": 388 }
      ],
      "summaryMs": 74 // Present only when contextStrategy === 'summary'
    }
    // ...additional sections
  ],
  "usage": {
    "outline": { "promptTokens": 620, "completionTokens": 210, "totalTokens": 830 }, // Outline phase usage
    "sections": { "promptTokens": 4820, "completionTokens": 3980, "totalTokens": 8800 }, // Aggregate of all subsection calls
    "summaries": { "promptTokens": 320, "completionTokens": 180, "totalTokens": 500 }, // Present only for summary strategy
    "total": { "promptTokens": 5760, "completionTokens": 4370, "totalTokens": 10130 } // Sum of all phases
  },
  "cost": { // Present only if pricing resolved
    "outline": 0.0042, // USD estimate for outline
    "sections": 0.0584, // USD estimate for sections
    "summaries": 0.0031, // USD estimate for summaries (if any)
    "total": 0.0657, // Sum of available phase costs
    "priceInPerK": 0.0003, // Input token price ($ per 1K)
    "priceOutPerK": 0.0006 // Output token price ($ per 1K)
  }
}
```

Field reference summary:
- title: Generated main article title.
- description: Short SEO description.
- body: Full Markdown content.
- tags / categories: Final normalized lists.
- slug: Safe identifier used for filenames.
- model: Model id (provider not exposed separately).
- status: Quality flag (duplicate outline ratio > threshold => warning).
- timings: Aggregate phase durations + run boundaries.
- sectionTimings: Per section timing + per-subheading breakdown.
- usage: Token counts per phase (prompt/completion/total) + aggregate.
- cost: Phase cost estimates & pricing (may be absent if pricing unknown).
- outlineMs / assembleMs / exportMs: Individual timing components inside timings.
- outlineAttempts: Outline retry count (max 2).
- startTime / endTime: Wall-clock epoch ms boundaries of the run.
- subTimings: Fine-grained per-subheading durations.
- summaryMs: Time spent generating a section summary (only in summary strategy).

### Timings & Status
`article.timings` includes `outlineMs`, `assembleMs`, `exportMs`, `totalMs`, `outlineAttempts`.
`article.sectionTimings[]` lists per-section + per-subheading durations.
`article.status` is `warning` if collapsed duplicate ratio in outline > 20%, else `success`.

### Filename Patterns (programmatic API)
Use `namePattern` in `generateArticle` options for dynamic filenames:

Tokens:
- `[timestamp]` run timestamp (ms)
- `[date]` YYYYMMDD
- `[time]` HHmmss
- `[slug]` outline slug
- `[title]` slug (fallback to sanitized title)

Example:
```ts
await generateArticle({
  ...opts,
  namePattern: '[timestamp]-[title]',
  exportModes: ['json','md'],
}); // => 1695112345678-my-article.json / .md
```

---

## License

MIT
