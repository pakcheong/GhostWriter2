import { generateArticle, __setGenerateTextImpl } from '../src/generate-article.js';
console.log('Starting lmstudio.test.ts');
import { strict as assert } from 'assert';

// Simulate LM Studio by intercepting generateText calls. We don't need special provider logic
// because safeGenerateText(lmstudio) now bypasses _generateTextImpl; so we force model mapping
// to use openai path by choosing a mapped LM Studio model and ensuring we never hit network.

// Counters to ensure both outline & section paths exercised.
let outlineCalls = 0;
let sectionCalls = 0;

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
__setGenerateTextImpl(async (req: any) => {
  const content = 'prompt' in req ? req.prompt : req.messages?.map((m: any) => m.content).join('\n');
  // Outline detection: JSON schema instructions present
  if (content.includes('STRICT JSON') || content.includes('"outline"')) {
    outlineCalls++;
    return { text: JSON.stringify({
      title: 'LM Local Title',
      description: 'Local description',
      slug: 'lm-local-title',
      outline: [
        { heading: 'Local Intro', subheadings: ['Context','Goal'] },
        { heading: 'Optimization', subheadings: ['Latency','Throughput'] }
      ],
      tags: ['local','perf'],
      categories: ['ai']
    }), usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } };
  }
  // Section generation (messages path)
  if (content.includes('You are a precise SEO writer')) {
    sectionCalls++;
    return { text: 'Some **local** section content with [image]local[/image]', usage: { promptTokens: 5, completionTokens: 15, totalTokens: 20 } };
  }
  return { text: 'Generic body', usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } };
});

try {
  const { article } = await generateArticle({
    model: 'openai/gpt-oss-20b',
    topic: 'Local LLM Performance',
    keywords: ['local','performance'],
    minWords: 100,
    maxWords: 200,
    existingTags: ['local'],
    existingCategories: ['ai'],
    lang: 'en',
    exportModes: [],
    writeFiles: false,
    verbose: false,
  });

  assert.equal(article.title, 'LM Local Title');
  assert.ok(article.body.includes('**local**'));
  assert.equal(article.model, 'openai/gpt-oss-20b');
  assert.ok(article.usage.total.totalTokens > 0);

  // Skip timing assertions (provider mapping suffices for this test)

  console.log('lmstudio.test.ts counts:', { outlineCalls, sectionCalls });
  assert.ok(outlineCalls >= 1, 'outline not generated');
  assert.ok(sectionCalls >= 1, 'no section generations');
  console.log('lmstudio.test.ts passed');
} finally {
  // nothing to restore
}
