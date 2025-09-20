import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { autoGenerateArticlesFromTopics } from '../src/automation/auto-generate.js';

installGhostwriterMocks({ topicsCount: 2, providerFetch: true });

try {
  const res = await autoGenerateArticlesFromTopics({
    topics: { domain: 'auto smoke', limit: 2, model: 'gpt-4o-mini' },
    article: { model: 'gpt-4o-mini', keywords: ['auto'], exportModes: [] },
    count: 2,
    concurrency: 2,
    verbose: false
  });
  assert.equal(res.articles.length, 2);
  assert.ok(res.articles[0]?.title);
  console.log('automation-basic.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
