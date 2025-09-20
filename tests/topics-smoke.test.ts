import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { generateTopics } from '../src/topics/generate-topics.js';

installGhostwriterMocks({ topicsCount: 4, providerFetch: true });

try {
  const wrapped = await generateTopics({ domain: 'smoke domain', limit: 4, model: 'gpt-4o-mini' });
  const topics = wrapped.output.content.topics;
  assert.equal(topics.length, 4, 'expected 4 topics');
  assert.ok(topics[0].title.startsWith('Mock Topic'));
  console.log('topics-smoke.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
