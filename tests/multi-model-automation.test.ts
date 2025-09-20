import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { autoGenerateArticlesFromTopics } from '../src/automation/auto-generate.js';

const MODELS = ['gpt-4o-mini', 'deepseek-chat', 'llama-3'];
installGhostwriterMocks({ providerFetch: true, topicsCount: 2 });
process.env.DEEPSEEK_API_KEY = 'test-key';

try {
  for (const model of MODELS) {
    const res = await autoGenerateArticlesFromTopics({
      topics: { domain: 'multi model domain', limit: 2, model },
      article: { model, keywords: ['multi'], exportModes: [] },
      count: 1,
      concurrency: 1,
      verbose: false
    });
    assert.equal(res.articles.length, 1);
    assert.ok(res.articles[0].title);
  }
  console.log('multi-model-automation.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
