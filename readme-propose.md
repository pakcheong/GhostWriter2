# Ghostwriter — Unified Documentation Proposal

> This consolidated README merges the original feature overview, non‑technical guide, and deep technical references (from prior `readme2/3/4`). After review you can replace the root `README.md` with a refined version of this and delete the auxiliary files. Comments with ⚙️ indicate optional advanced sections that can be collapsed or moved to a `/docs` folder if you prefer a lighter top-level README.

## Executive Summary (What This Project Is)
Ghostwriter is a modular AI content generation and automation toolkit. It:
- Generates long‑form, multi‑section articles from a topic + keyword seed using a two‑phase process (outline → subsections → optional summaries) to reduce token waste and improve structural coherence.
- Produces and filters ranked topic ideas for a given domain so you can plan an editorial backlog programmatically.
- Automates batch creation of many articles with controlled concurrency while preserving original topic order (safe for later publishing pipelines).
- Exports results in JSON (metrics + body), Markdown (clean, no inline HTML), and HTML (converted from Markdown) to integrate with CMS or static site workflows.
- Supports different context strategies (outline / summary / full) that let you trade off speed and cost against narrative cohesion.
- Tracks timing, token usage, and cost estimates (configurable pricing hierarchy) for transparency and budgeting.
- Provides image placeholders and an architectural path for a future pluggable AI image generation pipeline.
- Includes an example WordPress publishing script that ensures taxonomies, avoids duplicate slugs, and converts Markdown to HTML.

In short: it is an extensible foundation for scalable, semi‑structured SEO content production—designed for teams needing automation without locking themselves into a monolithic SaaS.

Navigation Shortcuts:
- [Quick Start](#quick-start)
- [CLI Reference](#cli-reference)
- [Architecture Overview](#architecture-overview)
- [Extensibility](#extensibility)
- [Roadmap & TODO](#roadmap-todo)

---
## 0. Visual Map (High-Level Diagrams)
### 0.1 End-to-End System
```
 +-------------+    +----------------+    +--------------------+    +--------------+    +-------------+
 | User / CLI  | -> | Parameter Prep | -> | Generation Orchestr.| -> | Export Layer | -> | (Publish)   |
 +-------------+    +----------------+    +--------------------+    +--------------+    +-------------+
                                        (Outline + Sections + Summaries)
```

### 0.2 Article Generation Internals
```
            +-------------------+
            |  buildOutline()   |
            +-------------------+
                     |
                     v
            +-------------------+        retry? (dup ratio > 0.2)
            |  parse + dedupe   |----yes----> regenerate outline (once)
            +-------------------+
                     |
                     v
        +----------------------------+
        |  for each section          |
        |    for each subheading     |
        |      buildSubPrompt()      |
        |      callModel()           |
        |      sanitizeMarkdown()    |
        |    end                     |
        |    (summary strategy?)     |
        |      buildSummaryPrompt()  |
        |      callModel()           |
        +----------------------------+
                     |
                     v
            +-------------------+
            |  assembleArticle  |
            +-------------------+
                     |
                     v
            +-------------------+
            | usage + pricing   |
            +-------------------+
                     |
                     v
            +-------------------+
            |   export files    |
            +-------------------+
```

### 0.3 Context Strategy Impact
```
outline: context = outline skeleton only
summary: context = outline + previous section summaries
full:    context = outline + ALL previously generated subsection texts
```

### 0.4 Automation Ordering
```
topics[] (indexed) -> task queue -> limited concurrency workers -> slots[] -> stable ordered final array
```

### 0.5 Future Image Pipeline (Planned)
```
body w/ placeholders -> extract -> prompt build -> cache check -> generate -> upload? -> replace -> metadata append
```

---
## 1. What Is Ghostwriter?
Ghostwriter is an AI-assisted SEO content pipeline that can:
- Generate structured long-form articles (outline → sections → summaries → export)
- Ideate and score topic ideas for a domain or niche
- Run batch multi-article automation workflows with concurrency
- Export in JSON / Markdown / HTML
- (Example) Publish to WordPress (tags/categories ensured, duplicate-safe)

Planned Enhancements:
- AI image generation & placeholder replacement
- Improved tag quality heuristics
- Diagnostics & partial-failure resilience

Use it for editorial acceleration, domain coverage, and programmatic content pipelines.

Out of Scope (currently): fact verification, human editing UI, multimedia beyond images.

---
## 2. Why Use It? (Value Table)
| Need | Problem | Solution Feature | Benefit |
|------|---------|------------------|---------|
| Fast drafting | Manual structuring is slow | Two-phase outline+sections | Fewer wasted tokens, coherent base |
| Idea generation | Hard to ideate at scale | Topic ideation scoring & filters | Curated candidate list |
| Scale | Repetitive manual runs | Batch automation w/ concurrency | Throughput without reordering |
| Cohesion control | Either shallow or bloated prompts | Context strategies (`outline`,`summary`,`full`) | Tune speed vs quality |
| Cost awareness | Unclear token spend | Usage + pricing aggregation | Predictable budgeting |
| Extensibility | Rigid monolith risk | Modular architecture & hooks | Easy future features |

---
## 3. Core Concepts
| Term | Meaning |
|------|---------|
| Outline | Model-generated structured skeleton (title, desc, sections, subheadings, tags, categories) |
| Context Strategy | How prior content feeds into each subsection prompt (outline / summary / full) |
| Duplicate Ratio | (rawHeadings - dedupedHeadings) / rawHeadings (outline hygiene metric) |
| Export Modes | One or more of `json`, `md`, `html` |
| Placeholders | `[image]alt text[/image]` markers for future image insertion |

---
## 4. Typical Workflow (Non-Technical)
```
(1) Pick domain or theme
(2) Generate topics
(3) Filter & select ideas
(4) Generate articles (single or batch)
(5) (Optional) Human editorial review
(6) Export or publish
```

Simple Flow:
```
Domain → Topics → Selected Topic(s) → Article Generation → Export/Publish
```

---
## 5. Feature Overview
- Outline-first architecture (cheap retry + de-dup before heavy generation)
- Context strategies: `outline` (fast), `summary` (balanced), `full` (max cohesion costlier)
- Markdown sanitation: HTML→Markdown fallback + escape normalization
- Token usage & pricing: environment + CLI override hierarchy
- Batch automation: concurrency with order preservation
- Topic ideation: rationale, confidence, risk flags, filtering stack
- Image placeholders: standardized markers for future enrichment
- Export multi-format: per-article flexible selection or `--export all`

---
<a id="quick-start"></a>
## 6. Quick Start
### Install
```bash
npm install
```
### Single Article
```bash
npx ghostwriter-article \
  --model gpt-4o-mini \
  --topic "React 19: What Changes for Production Apps" \
  --keywords "react 19, transitions, actions, server components" \
  --export all
```
### Topics
```bash
npx ghostwriter-topics --domain "frontend performance" --limit 10 --include react,cache
```
Programmatic (promise):
```ts
import { generateTopics } from './src/topics/generate-topics.js';
const wrapped = await generateTopics({ domain: 'frontend engineering', limit: 8, model: 'gpt-4o-mini' });
const { output: { content }, input } = wrapped;
console.log('First topic for', input.domain, ':', content.topics[0].title);
```
Callback form (receives same wrapper shape):
```ts
await generateTopics({
  domain: 'frontend engineering',
  limit: 8,
  model: 'gpt-4o-mini',
  onTopics(wrapped) {
    const { output: { content } } = wrapped;
    console.log('[callback] topics count', content.topics.length);
  }
});
```
### Automation (topics → articles)
```bash
npx ghostwriter-auto \
  --domain "web performance" \
  --t-model gpt-4o-mini \
  --a-model gpt-4o-mini \
  --count 5 \
  --concurrency 3 \
  --export json
```
### Programmatic
```ts
import { generateArticle } from './src/article/generate-article.js';
const { article } = await generateArticle({
  topic: 'Edge Caching Strategies in 2025',
  keywords: ['cdn','cache-control','stale-while-revalidate'],
  model: 'gpt-4o-mini',
  contextStrategy: 'summary',
  exportModes: ['json','md'],
  onArticle(a){ console.log('Generated', a.slug); }
});
```

---
<a id="cli-reference"></a>
## 7. CLI Reference
| Command | Purpose | Key Flags |
|---------|---------|----------|
| `ghostwriter-article` | Generate one article | `--topic --keywords --context --export --lang --min --max` |
| `ghostwriter-topics` | Domain topic ideation | `--domain --limit --include/--exclude --lang` |
| `ghostwriter-auto` | Topics → batch articles | Topic flags + article flags + `--count --concurrency` |
| (example) `examples/wordpress.ts` | Generate & publish | WordPress creds + selection flags |

### Article Flags (Selected)
| Flag | Description |
|------|-------------|
| `--context outline|summary|full` | Cohesion strategy |
| `--min / --max` | Word count bounds |
| `--export json,html,md,all` | Output formats |
| `--price-in/out` | Override pricing |
| `--tags / --categories` | Provide existing taxonomy |
| `--lang` | Output language |
| `--name-pattern` | Pattern tokens: `[timestamp]`, `[date]`, `[time]`, `[slug]`, `[title]` |

### Topics Filtering Precedence
1. includeKeywords
2. excludeKeywords
3. includeRegex
4. excludeRegex
(Fallback to unfiltered list if all removed.)

---
## 8. Environment Variables
| Variable | Purpose | Notes |
|----------|---------|-------|
| `OPENAI_API_KEY` | OpenAI auth | Required for OpenAI use |
| `OPENAI_MODEL` | Default OpenAI model | Fallback if not passed |
| `DEEPSEEK_API_KEY` | Deepseek auth | Optional unless using Deepseek |
| `DEEPSEEK_MODEL` | Default Deepseek model | e.g. `deepseek-chat` |
| `LMSTUDIO_MODEL` | Local model id | For LM Studio server |
| `LMSTUDIO_BASE_URL` | Local OpenAI-compatible endpoint | Default `http://localhost:1234/v1` |
| `PRICE_*` | Per-1K token pricing | Model-specific overrides supported |
| `LMSTUDIO_TIMEOUT_MS` | Request timeout | Default 900000 ms |
| `LMSTUDIO_STREAM` | Enable streaming accumulation | Set `1` to enable |
| `LMSTUDIO_WARM` | Warm model listing | `1` to prefetch |

Pricing Resolution Order: CLI override → model-specific env (e.g. `PRICE_GPT4O_MINI_IN`) → global `PRICE_IN/PRICE_OUT` → omit cost.

---
<a id="architecture-overview"></a>
## 9. Architecture Overview
High-Level System Map:
```
CLI / API → Orchestrator → LLM Wrapper → (Outline | Sections | Summaries) → Assembly → Exports
```
Main Modules:
| Module | Responsibility |
|--------|---------------|
| `article/generate-article.ts` | Orchestrates outline → sections → summary → assembly/export |
| `topics/generate-topics.ts` | Topic ideation & filtering |
| `automation/auto-generate.ts` | Batch pipeline & concurrency ordering |
| `article/dedupe.ts` | Heading normalization & duplicate merge |
| `article/prompts.ts` | Prompt builders (pure) |
| `article/assembly.ts` | Export assembly, slug + filename logic |
| `usage.ts` | Usage extraction & fallback estimation |
| `pricing.ts` | Pricing resolution hierarchy |
| `utils.ts` | Markdown sanitation, token estimate, cost helpers |
| `model-config.ts` | Provider client resolution |

Execution Flow (Article):
```
params → outline prompt → outline JSON → dedupe (retry maybe) →
for each section/subheading: build messages (strategy) → model → sanitize →
optional section summary (strategy=summary) → accumulate usage → assemble → export
```

---
## 10. Context Strategies
| Strategy | Prompt Growth | Cohesion | Cost | Use Case |
|----------|---------------|----------|------|----------|
| outline | Constant (outline only) | Low | Lowest | Fast bulk drafts |
| summary | Linear (summaries) | Medium | Moderate | Balanced general use |
| full | Linear (full text) | High | Highest | Narrative / high coherence |

Heuristic: start `outline`; upgrade to `summary`; reserve `full` for premium pieces.

---
## 11. Outline Duplicate Handling
```
raw headings → normalize → group by key → merge children → compute ratio
if ratio > 0.2 → retry once → if still high => status=warning
```
Reduces wasted token spend on redundant subsections.

---
## 12. Markdown Sanitation Pipeline
```
fragment → extract [image] placeholders → (if HTML) turndown → restore placeholders →
unescape formatting → drop stray placeholder tokens → collapse blank lines → trim
```
Single-pass cleanup via `sanitizeMarkdown`.

---
## 13. Usage & Pricing
Usage Aggregation:
```
usage_total.prompt += segment.promptTokens
usage_total.completion += segment.completionTokens
```
Cost:
```
(promptTokens/1000)*priceIn + (completionTokens/1000)*priceOut
```
If no pricing resolved → omit cost block.

---
## 14. WordPress (Example Integration)
Script: `examples/wordpress.ts`
- Ensures tags/categories
- Skips existing slugs
- Converts Markdown → HTML (`marked`)
Future Enhancements: media upload, retry taxonomy creation, structured logs.

---
## 15. Planned Image Pipeline (Design Snapshot)
Sequence:
```
scan body → collect placeholders → build prompts(title+section+alt) → cache check →
provider.generate → optional upload (local|wp) → replace placeholder → append metadata
```
Provider Interface (planned):
```ts
interface ImageProvider { name: string; generate(prompt: string, opts:{size:string}): Promise<{url:string; raw?:Buffer}> }
```
Failure Policies: keep | remove | comment.

---
## 16. Tag Quality Improvements (Planned)
Steps:
1. Normalize & dedupe
2. Relevance scoring vs keywords/entities
3. Remove generic tags unless reinforced
4. Enforce max count (e.g. 8)
5. Optional validation LLM pass

---
## 17. Error Handling Summary
| Stage | Failure | Current Handling | Future |
|-------|---------|------------------|--------|
| Outline parse | JSON invalid | Extract first {...} candidate | Secondary rephrase prompt |
| High duplicates | ratio>0.2 twice | status = warning | Adaptive threshold |
| Section call | LLM/network error | Abort run | Partial continuation |
| Usage missing | Provider silent | Token estimate fallback | Track estimation count |
| Pricing missing | No env/flags | Omit cost | Warning list |
| WP slug exists | Found | Skip | Alternate slug suggestion |

---
## 18. Performance Guidance
| Concern | Mitigation |
|---------|-----------|
| Token explosion (`full`) | Prefer `summary` or `outline` |
| Slow first response (local) | Enable `LMSTUDIO_WARM` | 
| Repetitive outline | Adjust topic specificity; reduce broad keywords |
| Large batch memory | Stream exports per article (future) |

---
## 19. Testing Strategy
Current:
- Outline dedupe
- Pricing resolution
- Prompts shape
- Concurrency order
- Callback invocation
Gaps:
- Error paths (malformed JSON)
- Performance regressions
- Image pipeline (future)
Add Test Steps:
1. Create `tests/*.test.ts`
2. Import target
3. Throw on failure (minimal harness)
4. Run `npm test`
Skipping: modify `skipTests` set in `tests/run-all.ts`.

---
<a id="extensibility"></a>
## 20. Extensibility
| Extension | Add Where | Contract |
|-----------|-----------|----------|
| Provider | `model-config.ts` | Must expose unified call wrapper |
| Context Strategy | Section loop | Provide message builder logic |
| Export Format | `article/assembly.ts` | Pure (ArticleJSON → string) |
| Post-process Hook | (planned) after assembly | Receives ArticleJSON copy |
| Image Provider | future `image/providers/*` | `generate(prompt, opts)` |
| Tag Refinement | outline post-processing | Side-effect free |

---
## 21. Security & Governance
- Do not commit credentials (`.env` gitignored)
- Consider secret scanning in CI
- Apply editorial review for compliance-sensitive topics
- Mask keys in logs (`maskKey` helper)
- Rate-limit concurrency if provider 429s appear

---
## 22. Versioning & Change Policy
| Change | SemVer |
|--------|--------|
| Add provider | MINOR |
| New export format | MINOR |
| Callback shape change | MAJOR |
| Remove field | MAJOR |
| Add optional field | MINOR |

---
## 23. Diagnostics (Planned Fields)
```ts
article.diagnostics = {
  duplicateRatio,
  outlineRetryCount,
  strategy,
  estimationFallbacks,
  warnings: []
};
```

---
## 24. Failure Mode Reference
| ID | Scenario | Impact | Mitigation | Future |
|----|----------|--------|-----------|--------|
| F1 | Outline non-JSON | Abort | Extract candidate JSON | Rephrase model pass |
| F2 | High duplicate ratio | Weaker structure | Single retry + warning | Adaptive threshold |
| F3 | Section call fails | Abort mid-run | None | Partial continuation |
| F4 | Pricing undefined | No cost data | Omit | Add explicit warning list |
| F5 | Usage missing | Approximate cost | Estimate tokens | Track estimates count |
| F6 | WP slug exists | Skip publish | Log skip | Alternate slug hash |

---
## 25. Programmatic Cheat Sheet
| Task | Import From | Function |
|------|-------------|----------|
| Generate article | `article/generate-article.ts` | `generateArticle` |
| Generate topics | `topics/generate-topics.ts` | `generateTopics` |
| Batch run | `automation/auto-generate.ts` | `autoGenerateArticlesFromTopics` |
| Sanitize markdown | `utils.ts` | `sanitizeMarkdown` |
| Estimate tokens | `utils.ts` | `estimateTokens` |
| Cost estimate | `utils.ts` | `costEstimate` |

---
## 26. Callback Refactor (Planned Breaking Change)
Current (implemented):
```ts
// Article generation callback
onArticle(payload: GenerateArticleCallbackPayload) // { output: {content,runtime}, input }

// Topics generation callback
onTopics(payload: GenerateTopicsWrappedPayload) // { output: {content,runtime}, input }
```
Future adjustments (if any) will follow SemVer; wrapper now canonical across features.

---
## 27. Example Section Generation (Sequence)
```
user → generateArticle()
  → outline prompt → outline JSON
  → dedupe (maybe retry)
  → loop sections/subheadings
      → build context messages
      → model call → raw markdown
      → sanitizeMarkdown()
      → (summary strategy?) build summary
  → assemble & compute usage/cost
  → onArticle callback
  → export
```

---
## 28. Maintenance Checklist
- [ ] `npm test` passes (skip list intentional)
- [ ] Env vars documented if new
- [ ] Roadmap/TODO updated
- [ ] Pricing resolution unaffected
- [ ] Regenerate sample article for regression sanity

---
<a id="roadmap-todo"></a>
## 29. Roadmap & TODO (Structured)

Legend: Priority (P1=High, P2=Medium, P3=Low)  Effort (S <2d, M 2–5d, L >5d)

### P1 Core Delivery
1. Callback Payload Redesign (P1 / M)
  - Goal: Safer evolution & clearer contract.
  - Output Shape: `{ inputMeta: {...}, result: ArticleJSON }`.
  - Migration: Dual mode via `LEGACY_CALLBACK=1` (one minor version), console deprecation notice when legacy mode used.
  - Acceptance: New shape documented, tests updated, legacy path flagged, example scripts adjusted.
  - Dependencies: None (isolated to article + automation layer + examples + tests).
2. Image Pipeline MVP (P1 / L)
  - Scope: Placeholder extraction → prompt build → stub provider → optional local file emit → Markdown replacement.
  - Providers Phase 1: `local-svg` (placeholder) + design interface for future remote.
  - Caching: Key = hash(model? + prompt + size).
  - Failure Policy: Config `onImageError` = keep placeholder | remove | comment.
  - Acceptance: At least one article run replaces placeholders with `![alt](path)` images; deterministic stub output in tests.
  - Dependencies: None (touches assembly + new `image/` folder).
3. Tag Quality Pass (P1 / M)
  - Steps: normalize → remove generic (denylist) → rank (keyword overlap & frequency) → cap (<=8) → optional validation mini-call (feature flag).
  - Acceptance: Tag set reduced & stable across reruns with identical outline; test verifying removal of generic entries.
  - Dependencies: Outline result (post-dedupe) available.
4. Diagnostics Block (P1 / S)
  - Add `article.diagnostics` { duplicateRatio, outlineRetryCount, estimationFallbacks, warnings[] }.
  - Warnings: highDuplicateRatio, missingPricing, usageEstimated, imageFailures (future), partialSections (future).
  - Acceptance: Present in output JSON; verbose summary prints condensed line.

### P2 Resilience & Observability
5. Partial Continuation (P2 / M)
  - Behavior: On subsection failure, record placeholder + warning; continue remaining subsections.
  - Acceptance: Article completes with warnings; diagnostics includes failure count.
  - Dependencies: Diagnostics block (for warnings list).
6. Publisher Abstraction (P2 / M)
  - Interface: `Publisher.publish(ArticleJSON, meta)` returning `{ id, slug }`.
  - WordPress adapter implements idempotent create-or-skip.
  - Acceptance: Example script switched to adapter; tests mock interface.
  - Dependencies: Callback redesign optional (not blocking).
7. Structured Run Summary (P2 / S)
  - Emit `run-summary.json` aggregating articles, timings, costs, warnings.
  - Acceptance: Automation example writes summary file; test ensures schema.
  - Dependencies: Diagnostics & existing timings.
8. Adaptive Duplicate Threshold (P2 / S)
  - Adjust retry decision threshold based on outline section count distribution (e.g. higher tolerance for very short outlines).
  - Acceptance: Unit test for threshold function given synthetic distributions.

### P3 Expansion / Exploratory
9. Multi‑Model Pipeline (P3 / M)
  - Outline with cheaper model, sections with premium.
  - Acceptance: Configurable via `outlineModel` override; cost attribution split.
10. Streaming Subsections (P3 / L)
  - Progressive CLI output while accumulating final body.
  - Acceptance: Flag `--stream` prints tokens or line chunks; final body identical to non-stream run.
11. Adaptive Subsection Budgeting (P3 / M)
  - Adjust target length based on remaining word budget vs sections left.
  - Acceptance: Word count distribution smoother; test verifying allocation algorithm.
12. Citation / Source Mode (P3 / L)
  - Adds inline reference placeholders & reference list section.
  - Acceptance: Feature-flag generating consistent `[refX]` pattern with final reference block.

### Cross-Cutting (Ongoing)
13. Test Coverage Hardening (Rolling)
  - Add malformed outline JSON, pricing missing, partial continuation scenarios.
  - Target: Critical path error branches have at least one assertion.
14. Performance Baseline (Rolling)
  - Track average ms per subsection (outline vs summary vs full) for regression detection.
15. Documentation Sync (Rolling)
  - Ensure README + proposal reflect new features at merge time.

### Dependency Graph (Simplified)
```
Diagnostics → (enables) PartialContinuation, StructuredSummary
CallbackRedesign → (nice-to-have for) PublisherAbstraction
ImagePipeline → (independent)
TagQuality → (independent)
AdaptiveDuplicateThreshold → (uses) existing outline metrics
```

### Acceptance Criteria Summary (Key P1 Items)
- Callback Redesign: All existing tests green with new shape + legacy flag test; docs updated.
- Image Pipeline MVP: Placeholder in → image link out for at least one block; no crash if zero placeholders.
- Tag Quality: Generic tag test passes; count limit enforced; optional validation toggle.
- Diagnostics: Block present; warnings array populated when forcing scenarios (simulate pricing miss, force duplicate ratio).

### Risk / Mitigation
| Risk | Impact | Mitigation |
|------|--------|------------|
| Callback breaking change mishandled | Downstream scripts fail | Dual mode + env flag + clear docs |
| Image provider latency | Slows pipeline | Stub/local provider first + async batching later |
| Tag over-filtering | Loss of relevant tags | Minimum floor (e.g. >=3) before pruning |
| Partial continuation masking issues | Hidden low-quality output | Warnings surfaced in diagnostics & summary |

### Out of Scope (Current Cycle)
- Full factual verification
- Human editorial UI
- Multi-language translation of existing articles

---

---
## 30. Suggestions (Editorial / Structural)
| Area | Suggestion | Rationale |
|------|------------|-----------|
| README size | Optionally split deep technical internals to `/docs/` | Keep root approachable |
| Callback refactor | Implement with feature flag + deprecation notice | Smooth migration for integrators |
| Image pipeline | Start with local stub provider returning placeholder SVG | Unblocks downstream integration early |
| Testing | Add corrupted outline JSON test | Improves resilience claims |
| Tag quality | Include a small allow/deny list | Fast early improvement |
| Pricing | Surface explicit note when cost omitted | Transparency |
| Observability | Add `estimationFallbacks` count now | Simple metric for trust level |

---
## 31. License
MIT

---
*End of Proposed Unified README*

---
## Appendix A. Prompt Templates (Reference)
> These are conceptual outlines of the prompts used. Actual wording may evolve but structural intent should remain stable.

### A.1 Outline Prompt
Purpose: Produce structured JSON (title, description, tags, categories, sections[] with subheadings[]). Emphasizes word-count target & style.
Structure (pseudo):
```
SYSTEM: You are an SEO and technical content strategist...
USER: Generate a structured JSON outline for an article.
{ topic, keywords, minWords, maxWords, language, style }
REQUIREMENTS:
- Provide 6-9 sections, each 2-4 subheadings.
- Include: title, description, tags[], categories[], sections[]
- Tags must be concise, lowercase.
- Output ONLY valid JSON.
```
Post-Processing: JSON extraction fallback if extra text, dedupe sections, retry if duplicate ratio high.

### A.2 Subsection Prompt
Purpose: Expand one subheading into cohesive Markdown content (no HTML) with optional placeholder image.
Context Injected (depending on strategy):
- Outline (always)
- Prior section summaries (summary strategy)
- Full previous subsection texts (full strategy)
Structure (pseudo):
```
SYSTEM: You generate clean Markdown subsections...
USER: Write the subsection content.
DATA: { articleTitle, sectionHeading, subheadingTitle, globalKeywords[], styleNotes, language }
CONSTRAINTS:
- Use **bold** for key keyword appearances naturally.
- Avoid repeating earlier subsections.
- Provide 1 image placeholder: [image]short descriptive alt text[/image]
- 120-220 words (heuristic, not strict)
```
Sanitation ensures removal of accidental HTML and escapes.

### A.3 Section Summary Prompt (strategy=summary only)
Purpose: Create a compact summary (2–3 sentences) of a completed section to feed into later subsections as context.
```
SYSTEM: You summarize technical sections concisely.
USER: Summarize the section for continuity.
DATA: { sectionHeading, subsectionsMarkdown }
CONSTRAINTS:
- 2-3 sentences max
- No new facts
- No Markdown formatting emphasis
```

### A.4 Topics Prompt
Purpose: Generate candidate article ideas with rationale, confidence, and risk flags.
Pseudo:
```
SYSTEM: You are an editorial strategist.
USER: Generate N topic ideas for domain: {domain}. Language: {lang}.
Include fields: title, rationale, confidence (0-1), riskFlags[]
Apply filtering hints: includeKeywords[], excludeKeywords[] (soft influence)
Return ONLY JSON array.
```
Post Steps: parse → dedupe → filter (include/exclude order) → score.

### A.5 Automation Coordination (No New Prompt)
Reuses topics + article prompts; automation layer only orchestrates concurrency and ordering—no special prompt.

### A.6 Future Image Prompt (Planned)
Will incorporate:
```
Context: articleTitle, sectionHeading, subsectionHeading, altText
Style Guidance: consistent, minimal text, clean, professional
Return: Single concise English prompt
```

### A.7 Tag Refinement Prompt (Planned)
If implemented, would validate or prune tags:
```
SYSTEM: Evaluate tag relevance.
USER: Given topic + tag list + keywords, return only relevant tags (<=8) in JSON array.
```

---
## Appendix B. Prompt Design Principles
| Principle | Application |
|-----------|-------------|
| Deterministic Output | Strict JSON instructions + no extra prose |
| Minimal Drift | Context strategies avoid uncontrolled context growth |
| Token Efficiency | Subsection granularity instead of monolithic body generation |
| Extensibility | Future prompts (images, refinement) plug into existing pattern |
| Sanitization Safety | Assume model may emit HTML / escapes; central cleanup |

---
## Appendix C. Prompt Evolution Suggestions
| Area | Potential Improvement | Benefit |
|------|-----------------------|---------|
| Outline JSON Stability | Add JSON schema validation step | Early detection of malformed output |
| Subsection Length Control | Soft token budgeting by summarizing prior | Reduce runaway prompt sizes |
| Summary Prompt | Force bullet mode optional | Alternative style for list-heavy articles |
| Topics Prompt | Add difficulty estimation field | Helps roadmap prioritization |
| Tag Refinement | Integrate embedding similarity | Higher precision filtering |

