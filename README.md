# Ghostwriter — SEO Content Pipeline

TypeScript + Vercel AI SDK toolchain for generating SEO-ready content (articles, topic ideation, automated multi‑article batches) with JSON / HTML / Markdown exports.

- Models: **OpenAI**, **Deepseek**, **LM Studio (local)** (provider inferred from model id)
- Multi-language output (`--lang` across all CLIs)
- Model-aware pricing estimates (env + CLI overrides)
- Context strategies for article cohesion (`outline | summary | full`)
- Strict Markdown body (no inline HTML) with safe HTML→Markdown fallback
- Output formats: `json`, `html`, `md` (combine via `--export all`)
- Verbose timing + token usage + cost tables
- Topic generation with filtering, scoring, rationale, risk flags
- Automation: topics → parallel article generation with preserved order

---

## Features

- **Two-phase article generation**: outline → subsections (+ optional per-section summaries)
- **Duplicate-aware outline** with merge + retry (status: `success|warning`)
- **Context strategies**: `outline` (fast) | `summary` (balanced) | `full` (max cohesion)
- **Strict Markdown** (HTML stripped → Turndown fallback) with emphasized `**keywords**`
- **Image placeholders**: `[image]an image description[/image]` per subheading slot
- **Exports**: pick any subset of `json`, `html`, `md` (`--export all` for all)
- **Pricing & usage**: token counts + model-aware cost (env hierarchy or CLI overrides)
- **Verbose mode**: per-section timing table + totals, optional usage/cost table
- **Topics**: ideation list with rationale, confidence, risk flags, filtering & scoring
- **Automation**: domain topics → batch article generation with concurrency & timing
- **Required Content Controls**: force headings/subheadings/phrases or use semantic `requiredContent[]` descriptors (intent + minMentions + optional)
- **Semantic Required Factories**: automation layer can now merge `baseRequiredContent` + per-topic `requiredContentFactory()` + static article list; derives headings/subheadings/coverage phrases automatically.
- **Strict & Overuse Protections**: `strictRequired` fails run (CLI exit code / programmatic flag) if required phrases missing or overused (heuristic or explicit `maxMentions`).
- **Aggregate Coverage**: automation `aggregateCoverage` summarizes missing / overused counts across batch.

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

## CLI Overview

Three executables (after build or via `npx` if linked):

| Command | Purpose | Primary Flags |
|---------|---------|---------------|
| `ghostwriter-article` | Single article generation | `--topic --keywords --context --export --lang` |
| `ghostwriter-topics` | Topic ideation & filtering | `--domain --limit --include/--exclude --lang` |
| `ghostwriter-auto` | Topics → multi-article batch | Topic + article flags + `--count --concurrency` |

Quick start (article):
```bash
npx ghostwriter-article \
  --model gpt-4o-mini \
  --topic "React 19: What Changes for Production Apps" \
  --keywords "react 19, transitions, actions, server components" \
  --export all
```

Quick start (topics):
```bash
npx ghostwriter-topics --domain "frontend performance" --limit 10 --include react,cache
```

Quick start (automation):
```bash
npx ghostwriter-auto \
  --domain "web performance" \
  --t-model gpt-4o-mini \
  --a-model gpt-4o-mini \
  --count -1 \
  --concurrency 3 \
  --export json
```

Development (tsx from source):
```bash
npx tsx src/article/cli.ts --topic "Edge Caching Strategies in 2025" --keywords "cdn,cache-control" --export md
```

Help:
```bash
ghostwriter-article --help
ghostwriter-topics --help
ghostwriter-auto --help
```

Below: detailed article CLI reference; topics & automation documented later.

### Article CLI Options (`ghostwriter-article`)

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
| `--export` | `json`\|`html`\|`md`\|`all` | `json` | Output format(s); `all` = json+html+md. |
| `--out` | string | Derived from slug | Base filename (no extension). |
| `--outdir` | string | `./.tmp` | Output directory. |
| (programmatic) `namePattern` | string | none | Pattern tokens: `[timestamp]`, `[date]`, `[time]`, `[slug]`, `[title]`. Overrides `--out`. |
| `--price-in` | number | from `.env` | Override input token price. |
| `--price-out` | number | from `.env` | Override output token price. |
| `--verbose` | flag | on (unless --quiet) | Prints per-section timing + usage/cost tables. |
| `--required-headings` | csv | none | Inject outline headings if model omits them. |
| `--required-subheadings` | csv | none | Inject outline subheadings (attached to last required heading). |
| `--required-phrases` | csv | none | Track presence (>=1) of body coverage phrases. |
| `--required-content-file` | path | none | JSON file containing rich `requiredContent[]` items. |

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
- `all` → `json` + `html` + `md`
`both` removed (use comma list or `all`).

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
.tmp/
  edge-caching-strategies-in-2025.json
  edge-caching-strategies-in-2025.html
  edge-caching-strategies-in-2025.md
```

---

## Architecture

The codebase is modularized for clarity and testability:

| Module | Purpose |
|--------|---------|
| `src/article/generate-article.ts` | Article orchestrator (outline → sections → summaries → assembly + export). |
| `src/generate-article.ts` | Re-export convenience entry. |
| `src/article/cli.ts` | Article CLI implementation. |
| `src/topics/generate-topics.ts` | Topic ideation: scored list (title, rationale, confidence, riskFlags). |
| `src/topics/cli.ts` | Topics CLI. |
| `src/automation/auto-generate.ts` | Topics → multi-article concurrency orchestrator. |
| `src/automation/cli.ts` | Automation CLI. |
| `src/types.ts` | Shared type definitions (providers, strategies, article/result interfaces, timing structs). |
| `src/prompts.ts` | All prompt construction helpers (outline / section / summary). Pure string builders. |
| `src/model-config.ts` | Model→provider client resolution (OpenAI / Deepseek) |
| (removed) `src/provider.ts` | Legacy (deleted) |
| `src/usage.ts` | Usage extraction + token fallback estimation. |
| `src/pricing.ts` | Price resolution logic (CLI > model-specific env > global env). |
| `src/assembly.ts` | Article assembly + filename utilities + HTML/Markdown document builders + duration formatting. |
| `src/utils.ts` | Cross-cutting utilities: Markdown sanitation, HTML→Markdown, token estimation, cost helpers. |
| `tests/*.test.ts` | Lightweight assertion-based tests (no framework) for prompts, pricing, assembly. |
| `src/topics/generate-topics.ts` | Topic ideation: returns scored list (title, rationale, confidence, riskFlags). |
| `src/automation/auto-generate.ts` | High-level: topics → multi-article generation with concurrency + timings. |

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

### Testing & Mock Server Policy
All tests run without real network calls. A unified mock layer provides:
| Capability | Description |
|------------|-------------|
| Deterministic outline/sections | Fixed outline (Intro/Body) & stable subsection Markdown |
| Summaries | Static short summary string when requested |
| Topics | Deterministic `Mock Topic N` items (configurable count) |
| Provider fetch interception | Intercepts any `/chat/completions` request (Deepseek, LM Studio, future) |
| Strict isolation | Any unexpected external `fetch` triggers an error |

Usage:
```ts
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
installGhostwriterMocks({ topicsCount: 4, providerFetch: true });
// ...call generateTopics / generateArticle / autoGenerateArticlesFromTopics
resetGhostwriterMocks();
```
Multi‑model tests exercise OpenAI (`gpt-4o-mini`), Deepseek (`deepseek-chat`), and LM Studio (`openai/gpt-oss-20b`) code paths entirely under mocks.

When adding a new provider: extend the fetch mock or supply a provider‑specific branch returning a deterministic response; never allow silent live calls in unit tests.

### Callback (Wrapped Payload)
`onArticle?: (payload: { output: ArticleJSON; input: {...}; meta: {...} }) => void | Promise<void>`

The JSON export now contains this wrapper. Example (abridged):
```jsonc
{
  "output": { "title": "Edge Caching Strategies in 2025", "status": "success", "usage": { /* ... */ } },
  "input": {
    "topic": "Edge Caching Strategies in 2025",
    "keywords": ["cdn","cache-control"],
    "minWords": 1000,
    "maxWords": 1400,
    "lang": "en",
    "contextStrategy": "summary",
    "exportModes": ["json","md"],
    "modelRequested": "gpt-4o-mini",
    "modelResolved": "gpt-4o-mini",
    "existingTags": ["performance"],
    "writeFiles": true
  },
  "meta": {
    "runTimestamp": 1758267800123,
    "baseName": "edge-caching-strategies-in-2025",
    "outlineAttempts": 1,
    "duplicateRatio": 0.0,
    "provider": "openai",
    "pricingResolved": { "inPerK": 0.0003, "outPerK": 0.0006, "found": true },
    "timingsSummary": { "totalMs": 8421, "outlineMs": 612, "sectionsMs": 7210, "assembleMs": 15, "exportMs": 58 },
    "sectionCount": 5,
    "subheadingTotal": 17,
    "contextStrategyEffective": "summary",
    "warning": false
  }
}
```
Backward compatibility helper:
```ts
function onArticle(p: any) {
  const article: any = p.output || p; // legacy support
  console.log(article.title);
}
```
`input` captures the sanitized generation parameters used. `meta` adds runtime diagnostics not already inside `output` (timings roll‑up, pricing resolution, duplication ratio, section/subheading counts, provider).

### Timings & Status
`article.timings` includes `outlineMs`, `assembleMs`, `exportMs`, `totalMs`, `outlineAttempts`.
`article.sectionTimings[]` lists per-section + per-subheading durations.
`article.status` is `warning` if collapsed duplicate ratio in outline > 20%, else `success`.

### Filename Patterns (programmatic API)
Use `namePattern` to dynamically construct filenames. Tokens:

| Token | Meaning |
|-------|---------|
| `[timestamp]` | Milliseconds at run start |
| `[date]` | UTC date `YYYYMMDD` |
| `[time]` | UTC time `HHmmss` |
| `[slug]` | Article slug derived from title |
| `[title]` | Slugified title (fallback) |

Example:
```ts
await generateArticle({
  ...opts,
  namePattern: '[date]-[slug]',
  exportModes: ['json','md']
});
```

---
## Topics CLI (`ghostwriter-topics`)

Generate candidate ideas for a domain / niche:
```bash
ghostwriter-topics --domain "modern frontend" --limit 12 --include react,performance --exclude legacy
```

Key flags:
- `--domain <string>` (required)
- `--limit <n>` final topic target (internal over-generation)
- Filtering: `--include`, `--exclude`, `--include-regex`, `--exclude-regex`
- Language enforcement: `--lang`
- Pricing: `--price-in`, `--price-out`
- Usage table: `--usage` (force print)

Per topic: `title`, `rationale`, `confidence`, `riskFlags[]` (e.g. `speculative`, `maybe-outdated`). Scoring heuristic ranks before selection.

Filtering order: includeKeywords → excludeKeywords → includeRegex → excludeRegex. If all filtered out, reverts to unfiltered deduped list.

---
## Automation CLI (`ghostwriter-auto`)

End-to-end batch: generate topics then multiple articles concurrently.
```bash
ghostwriter-auto \
  --domain "web performance" \
  --t-model gpt-4o-mini \
  --a-model gpt-4o-mini \
  --count 5 \
  --concurrency 3 \
  --export json
```

Important flags:
- Topic phase: `--domain`, `--t-model`, `--t-limit`, filters, `--lang`
- Article phase: `--a-model`, `--min`, `--max`, `--context`, `--export`, `--tags`, `--categories`, `--style`, `--name-pattern`
- Automation: `--count <n|-1>` (`-1` or omit = all), `--concurrency <n>`

Behavior:
- Preserves topic order under concurrency
- Per-article errors caught (verbose logs); failed slots left undefined
- Timings: `topicsMs`, `articlesMs`, `totalMs` + boundaries
- Semantic required content: pass `--required-content-file` (article phase) OR programmatically supply `baseRequiredContent` and a `requiredContentFactory` (see Programmatic APIs) to dynamically tailor required headings / subheadings / mentions per topic.

Use for scheduled batches, editorial ideation → draft generation, or domain coverage.

---
## Programmatic APIs Summary
Import paths:
```ts
import { generateArticle } from './src/article/generate-article.js';
import { generateTopics } from './src/topics/generate-topics.js';
import { autoGenerateArticlesFromTopics } from './src/automation/auto-generate.js';
```

### Type Organization
Domain option/result interfaces now live beside their feature logic:
- Article types: `src/article/types.ts` (e.g. `GenerateArticleOptions`)
- Topics types: `src/topics/types.ts` (e.g. `GenerateTopicsOptions`, `TopicCandidate`)
- Automation types: `src/automation/types.ts` (e.g. `AutoGenerateOptions`, `AutoGenerateResult`)
- Shared structural types (article JSON shape, timings, context enums) remain in `src/types.ts`.
Update imports if you previously consumed `GenerateArticleOptions` from the root shared file.

---
## Roadmap / Potential Enhancements
- WordPress publishing helper (`publish-to-wp.ts`) for bulk post creation (expects JSON bundle with `items[]`).
- Retry & backoff for subsection failures
- Optional streamed / incremental exports
- Additional formats (RSS item, sitemap fragment)
- More granular quiet vs usage table controls
- Pluggable scoring for topics
- Post-generation validation hooks

---

## TODO

These are concrete next steps planned for the project:

1. Refactor `onArticle` callback payload structure:
  - Wrap generation input parameters under a new key, e.g. `inputMeta` containing: `keywords`, `topic`, `wordCountRange`, `existingTags`, `existingCategories`, `lang` (and any future flags that materially affect output).
  - Place the current article JSON (title/body/timings/usage/cost/etc.) under another key, e.g. `result`.
  - Update all internal usages (automation pipeline, tests, and `examples/wordpress.ts`) to consume the new shape.

2. Image generation pipeline:
  - Implement extraction of `[image]...[/image]` placeholders → prompt construction.
  - Add pluggable providers (initial targets: DALL·E 3, Nano Banana, Stable Diffusion / SDXL via Stability or Replicate).
  - Support local caching, optional WordPress media upload, and replacement modes (`markdown` vs `html <figure>`).

3. Tag quality improvements:
  - Current AI-generated tags can be noisy / inconsistent.
  - Add normalization & scoring pass: frequency analysis of keyword overlap, removal of generic or off-topic tags, enforce max count, and ensure alignment with `keywords` & detected entities.
  - Optionally introduce a secondary lightweight model validation step ("Is this tag relevant? yes/no").

> (Implementation order may shift; contributions welcome.)
## Topics Generation

Programmatic example (promise result):
```ts
import { generateTopics } from './src/topics/generate-topics.js';

const topicsResult = await generateTopics({
  domain: 'frontend engineering',
  model: 'gpt-4o-mini',
  limit: 12,
  lang: 'en',             // optional: enforce language for titles & rationale
  includeKeywords: ['react','performance'], // OR use includeRegex
  excludeRegex: 'legacy|deprecated',
  printUsage: true,
  verbose: true,
});
// Unified wrapper shape (mirrors article generator):
// topicsResult = { input, output: { content, runtime } }
const { output: { content, runtime }, input } = topicsResult;
console.log(content.topics[0]);
```

Using the `onTopics` callback (receives the same wrapper object):
```ts
await generateTopics({
  domain: 'frontend engineering',
  limit: 8,
  model: 'gpt-4o-mini',
  onTopics(wrapped) {
    const { output: { content }, input } = wrapped;
    console.log('Callback topics for domain', input.domain, 'count=', content.topics.length);
  }
});
```

Returned fields per topic (content.topics[i]):
- `title`
- `rationale`
- `confidence` (0–1)
- `riskFlags` (array, may contain: `maybe-outdated`, `speculative`, `broad` — empty array when none)

Filtering precedence (applied post-dedupe, pre-scoring):
1. `includeKeywords` (OR match)
2. `excludeKeywords`
3. `includeRegex`
4. `excludeRegex`

If all filters eliminate results → fallback to unfiltered deduped list.

Scoring heuristic: `(confidence || 0.55) - riskFlags.length * 0.05` descending.

### Unified Wrapper Structure

`generateArticle` and `generateTopics` both return a wrapper object:

```ts
{
  input: { /* echoed request options + resolved model */ },
  output: {
    content: { /* pure semantic data (article or topics list) */ },
    runtime: { /* timings, usage, pricing, counts, strategy */ }
  }
}
```

Access canonical data via `output.content` & diagnostics via `output.runtime`. The same wrapper is passed to `onTopics` (topics) and a richer callback payload is passed to `onArticle` (articles) containing content + runtime + echoed input.

### Required Content (Semantic Requirements)

Two ways to express mandatory coverage:
- Legacy arrays: `requiredOutlineHeadings`, `requiredOutlineSubheadings`, `requiredCoveragePhrases`.
- Rich list: `requiredContent[]` objects loaded via API or `--required-content-file`.

`requiredContent` item shape:
```jsonc
[
  {
    "text": "Financial Metrics Overview",
    "intent": "heading" // adds outline heading if missing
  },
  {
    "text": "Net Present Value (NPV)",
    "intent": "subheading" // forces a subheading
  },
  {
    "text": "discounted cash flow",
    "intent": "mention",
    "minMentions": 2,
    "optional": false,
    "matchMode": "substring"
  }
]
```
Intents:
- `heading` → mapped to outline heading requirement
- `subheading` → mapped to subheading requirement
- `mention` / `section` → tracked as body coverage phrase (supports `minMentions`)

Runtime reporting (`runtime.strategy.requiredCoverage`):
```jsonc
{
  "required": ["Financial Metrics Overview", "Net Present Value (NPV)", "discounted cash flow"],
  "fulfilled": ["Financial Metrics Overview", "discounted cash flow"],
  "missing": ["Net Present Value (NPV)"],
  "items": [
    { "text": "Financial Metrics Overview", "intent": "mention", "requiredMentions": 1, "foundMentions": 1, "fulfilled": true },
    { "text": "Net Present Value (NPV)", "intent": "mention", "requiredMentions": 1, "foundMentions": 0, "fulfilled": false },
    { "text": "discounted cash flow", "intent": "mention", "requiredMentions": 2, "foundMentions": 2, "fulfilled": true }
  ]
}
```
Notes:
- Legacy arrays + `requiredContent` are merged; duplicates de-duped (case-insensitive).
- `minMentions` defaults to 1. Optional items omitted from `missing` when not fulfilled.
- Future: non-fulfilled items with `injectStrategy` may trigger auto insertion.
 - Overuse detection: flagged if `foundMentions > maxMentions` (when provided) OR heuristic `(found > minMentions*8 && found > 12)`; runtime exposes `items[].overused` + `requiredCoverage.overused[]`.
 - `strictRequired`: When enabled and any missing or overused items exist, `requiredCoverage.strictFailed=true` (CLI uses non-zero exit code for CI gating).

### Automation Dynamic Required Content
Programmatic factory merge order (later overrides / tightens earlier):
1. `baseRequiredContent`
2. `requiredContentFactory(topic)` return value
3. Static `article.requiredContent`

Intent precedence upgrade: `section > heading > subheading > mention`. On merge: higher intent replaces lower; `minMentions` takes max; `maxMentions` takes min (stricter). Conflicts normalize so `minMentions <= maxMentions`.

Automation example:
```ts
import { autoGenerateArticlesFromTopics } from './src/automation/auto-generate.js';
await autoGenerateArticlesFromTopics({
  topics: { domain: 'Fintech Malaysia payments', model: 'gpt-4o-mini', limit: 5 },
  article: {
    model: 'gpt-4o-mini',
    minWords: 900,
    maxWords: 1100,
    requiredContent: [
      { text: 'Regulatory landscape', intent: 'heading' },
      { text: 'Bank Negara Malaysia', intent: 'mention', minMentions: 2, maxMentions: 5 }
    ],
    strictRequired: true,
    exportModes: ['json']
  },
  baseRequiredContent: [
    { text: 'digital banking license', intent: 'mention', minMentions: 1, maxMentions: 4 }
  ],
  requiredContentFactory: (topic) => {
    const lower = topic.toLowerCase();
    const arr: any[] = [];
    if (lower.includes('payment')) arr.push({ text: 'e-wallet adoption', intent: 'mention', minMentions: 1, maxMentions: 3 });
    if (lower.includes('startup')) arr.push({ text: 'funding rounds', intent: 'subheading' });
    return arr;
  },
  aggregateCoverage: true,
  count: 1,
  concurrency: 1,
  verbose: true
});
```

## Automation (Topics → Articles)

```ts
import { autoGenerateArticlesFromTopics } from './src/automation/auto-generate.js';

const res = await autoGenerateArticlesFromTopics({
  topics: { domain: 'web performance', model: 'gpt-4o-mini', limit: 12, lang: 'en' },
  article: { model: 'gpt-4o-mini', exportModes: ['json'], contextStrategy: 'outline' },
  // count: -1, // -1 or omitted = generate articles for ALL topics returned
  concurrency: 4, // default 2 if omitted
  verbose: true,
  onArticle(a, i) { console.log('Article', i, a.title); }
});

console.log(res.timings); // { topicsMs, articlesMs, totalMs, ... }
```

Options summary:
- `count`: number of top topics to convert; `-1` or `undefined` → all.
- `concurrency`: max parallel article generations (default `2`).
- Preserves topic order even under concurrency.
- `timings` in result: `startTime`, `topicsEndTime`, `endTime`, `topicsMs`, `articlesMs`, `totalMs`.

Error handling: per-article errors are caught and logged (when `verbose`); failed slots remain `undefined` in `articles` array (can be post-filtered).

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
