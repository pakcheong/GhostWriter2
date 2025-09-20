import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { generateTopics } from '../src/topics/generate-topics.js';

const models = ['gpt-4o-mini', 'deepseek-chat', 'openai/gpt-oss-20b'];

installGhostwriterMocks({ topicsCount: 3, providerFetch: true });

try {
  for (const m of models) {
    process.env.DEEPSEEK_API_KEY = 'test';
    const res = await generateTopics({ domain: 'test domain', limit: 3, model: m as any });
    assert.equal(res.topics.length, 3);
    assert.ok(res.topics[0].title.startsWith('Mock Topic'));
  }
  console.log('multimodel-topics.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
