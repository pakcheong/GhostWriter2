import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { autoGenerateArticlesFromTopics } from '../src/automation/auto-generate.js';

const modelTriples = [
  { t: 'gpt-4o-mini', a: 'gpt-4o-mini' },
  { t: 'deepseek-chat', a: 'deepseek-chat' },
  { t: 'openai/gpt-oss-20b', a: 'openai/gpt-oss-20b' }
];

installGhostwriterMocks({ topicsCount: 2, providerFetch: true });

try {
  for (const set of modelTriples) {
    process.env.DEEPSEEK_API_KEY = 'test';
    const result = await autoGenerateArticlesFromTopics({
      topics: { domain: 'mm-auto', model: set.t, limit: 2 },
      article: { model: set.a, exportModes: [], keywords: ['k'] },
      count: 2,
      concurrency: 2,
      verbose: false
    });
    assert.equal(result.articles.length, 2);
    assert.ok(result.articles[0]?.title, 'article title present');
  }
  console.log('multimodel-automation.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
