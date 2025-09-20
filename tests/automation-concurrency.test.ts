import {
  autoGenerateArticlesFromTopics,
  __setTopicsGenerateTextImpl,
  __setGenerateTextImpl
} from '../index.js';

// Mock topics output (5 topics)
const mockTopics = `[
  {"title":"Topic A","confidence":0.9},
  {"title":"Topic B","confidence":0.8},
  {"title":"Topic C","confidence":0.7},
  {"title":"Topic D","confidence":0.6},
  {"title":"Topic E","confidence":0.5}
]`;

// Provide deterministic topics
__setTopicsGenerateTextImpl(async () => ({ text: mockTopics }) as any);

// Mock article generation: return minimal structure consistent with ArticleJSON expectation.
__setGenerateTextImpl(async ({ prompt }: any) => {
  // Derive title from prompt (last quoted part or first line fallback)
  const m = String(prompt).match(/"([^"]+)"/) || String(prompt).match(/Topic [A-E]/);
  const title = m ? m[1] || m[0] : 'Untitled';
  return { text: `# ${title}\n\nBody for ${title}` } as any;
});

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

(async () => {
  const res = await autoGenerateArticlesFromTopics({
    topics: { domain: 'test' },
    article: { exportMode: 'markdown' } as any,
    count: 5,
    concurrency: 3,
    verbose: false
  });
  // Verify ordering preserved (topics list order BLAH A->E) and articles length
  const expected = ['Topic A', 'Topic B', 'Topic C', 'Topic D', 'Topic E'];
  assert(JSON.stringify(res.topics.slice(0, 5)) === JSON.stringify(expected), 'Topics ordering changed');
  assert(res.articles.length === 5, 'Articles count mismatch');
  assert(res.timings && typeof res.timings.totalMs === 'number', 'Timings missing');
  console.log('automation-concurrency.test.ts passed');
})();
