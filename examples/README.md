# Examples

All scripts expect the project to be built (`npm run build`) so they import from `dist/`.
Run with `npx tsx` (dev) or `node` (after build, copying them under dist if desired).

## Scripts

| File | Purpose |
|------|---------|
| `article-basic.ts` | Minimal single article generation (outline context). |
| `article-summary-context.ts` | Article using summary context strategy. |
| `article-lmstudio.ts` | Local LM Studio example (skips if unreachable). |
| `article-finance-malaysia.ts` | Fintech & digital banking landscape in Malaysia (EN). |
| `automation-personal-finance-malaysia.ts` | Automation: multi Malaysia personal finance articles (EN). |
| `topics-basic.ts` | Basic topics generation with usage & cost tables. |
| `topics-filters.ts` | Topics with include/exclude filters. |
| `automation-all.ts` | Generate articles for all topics (count omitted / -1). |
| `automation-top3-concurrency.ts` | Generate top 3 topics with concurrency=3. |
| `util.ts` | Shared helpers (duration/date + logging). |

## Running

Build first:
```bash
npm run build
```

Then run any sample, e.g.:
```bash
npx tsx examples/article-basic.ts
npx tsx examples/topics-basic.ts
npx tsx examples/automation-all.ts
```

Or with environment variables:
```bash
OPENAI_API_KEY=sk-xxx npx tsx examples/topics-filters.ts
```

## Notes
- Automation: omit `count` or set `-1` ⇒ all topics.
- Concurrency default is `2`; override via `concurrency` in automation examples.
- Topics `lang` option enforces language in titles/rationales.
- LM Studio script uses a quick `/models` probe (1.5s timeout) to decide skip/run.
- Equivalent CLI commands now exist: `ghostwriter-topics`, `ghostwriter-article`, `ghostwriter-auto` (see root README for flags).

Adjust paths or output directories as needed for your workflow.
