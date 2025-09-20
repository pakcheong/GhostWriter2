import { generateTopics, __setTopicsGenerateTextImpl } from '../index.js';

// Mock LLM output producing a mixed set of topics
const mockText = `[
  {"title":"React 19 Concurrent Features Deep Dive","confidence":0.83},
  {"title":"Legacy React Patterns to Avoid","confidence":0.6},
  {"title":"Edge Rendering Strategies","confidence":0.72},
  {"title":"State Management with Signals","confidence":0.7},
  {"title":"Server Components Migration Guide","confidence":0.68},
  {"title":"Deprecated Lifecycle Methods Overview","confidence":0.58}
]`;

__setTopicsGenerateTextImpl(async () => ({ text: mockText }) as any);

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(msg);
}

(async () => {
  // includeKeywords
  const r1 = await generateTopics({ domain: 'react', includeKeywords: ['react 19', 'edge'], limit: 4 });
  assert(
    r1.topics.every((t) => /(react 19|edge)/i.test(t.title)),
    'includeKeywords filtering failed'
  );

  // excludeKeywords
  const r2 = await generateTopics({ domain: 'react', excludeKeywords: ['legacy', 'deprecated'], limit: 6 });
  assert(
    r2.topics.every((t) => !/(legacy|deprecated)/i.test(t.title)),
    'excludeKeywords filtering failed'
  );

  // includeRegex & excludeRegex combined
  const r3 = await generateTopics({
    domain: 'react',
    includeRegex: 'react|edge',
    excludeRegex: 'legacy',
    limit: 5
  });
  assert(
    r3.topics.every((t) => /react|edge/i.test(t.title) && !/legacy/i.test(t.title)),
    'regex combo filtering failed'
  );

  // Over-filter fallback: regex that matches nothing should fallback to deduped (>=1 result)
  const r4 = await generateTopics({ domain: 'react', includeRegex: 'THIS_WILL_NOT_MATCH', limit: 3 });
  assert(r4.topics.length > 0, 'fallback after over-filtering failed');
  console.log('topics-filters.test.ts passed');
})();
