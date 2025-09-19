import { generateArticle, __setGenerateTextImpl } from '../src/article/generate-article.js';
console.log('Starting lmstudio.test.ts');
import { strict as assert } from 'assert';

// Simulate LM Studio by intercepting generateText calls. We don't need special provider logic
// because safeGenerateText(lmstudio) now bypasses _generateTextImpl; so we force model mapping
// to use openai path by choosing a mapped LM Studio model and ensuring we never hit network.

// Detailed mock counters removed (no hook injection available now).

// Skip logic: if LM Studio base URL not reachable (simple HEAD/GET), skip test.
async function checkReachable() {
  try {
    const base = (process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1').replace(/\/$/, '');
    const r = await fetch(base + '/models', { method: 'GET' });
    return r.ok;
  } catch {
    return false;
  }
}

const reachable = await checkReachable();
if (!reachable) {
  console.log('Skipping lmstudio.test.ts (LM Studio server unreachable)');
  // Exit early without failing
  // Provide a minimal assertion so test harness counts it as executed.
  console.log('lmstudio.test.ts skipped');
  throw new Error('__SKIP__');
}

// We still provide a dummy _generateTextImpl for section generation which the orchestrator
// will call (sections use messages path => safeGenerateText routes through lmstudio fetch again),
// so emulate section calls by returning markdown blocks.
// Mock hook removed; skipping detailed LM Studio specific assertions.

// Deterministic mock if reachable (we still perform reachability check first)
__setGenerateTextImpl(async (req: any) => {
  const content = req.prompt || (req.messages||[]).map((m: any)=>m.content).join('\n');
  if (content.includes('You are a precise SEO writer')) {
    return { text: 'Body section with [image]local[/image]', usage: { promptTokens:1, completionTokens:2, totalTokens:3 } };
  }
  if (content.includes('STRICT JSON') || content.includes('"slug"')) {
    return { text: JSON.stringify({
      title: 'LM Local Title', description: 'Local description', slug: 'lm-local-title', tags: ['local','perf'], categories: ['ai'], outline: [ { heading: 'Local Intro', subheadings: ['Context','Goal'] } ]
    }), usage: { promptTokens:2, completionTokens:4, totalTokens:6 }};
  }
  return { text: 'Generic body', usage: { promptTokens:1, completionTokens:1, totalTokens:2 } };
});
const { article } = await generateArticle({ model: 'openai/gpt-oss-20b', topic: 'Local LLM Performance', keywords: ['local','performance'], minWords: 50, maxWords: 80, existingTags: ['local'], existingCategories: ['ai'], lang: 'en', exportModes: [], writeFiles: false, verbose: false });
assert.equal(article.title, 'LM Local Title');
console.log('lmstudio.test.ts passed');
