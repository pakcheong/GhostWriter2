import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { generateTopics } from '../src/topics/generate-topics.js';

const MODELS = ['gpt-4o-mini', 'deepseek-chat', 'llama-3'];
installGhostwriterMocks({ providerFetch: true, topicsCount: 3 });
process.env.DEEPSEEK_API_KEY = 'test-key';

try {
  for (const model of MODELS) {
    const wrapped = await generateTopics({
      domain: 'multi model domain',
      limit: 3,
      model,
      verbose: false
    });
    const topics = wrapped.output.content.topics;
    assert.equal(topics.length, 3);
  }
  console.log('multi-model-topics.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
