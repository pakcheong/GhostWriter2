import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { generateTopics } from '../src/topics/generate-topics.js';

installGhostwriterMocks({ topicsCount: 4 });

try {
  const res = await generateTopics({ domain: 'ai', limit: 4, model: 'deepseek-chat' as any });
  assert.equal(res.topics.length, 4, 'expected 4 topics');
  assert.ok(res.topics[0].title.startsWith('Mock Topic'));
  console.log('deepseek-topics.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
