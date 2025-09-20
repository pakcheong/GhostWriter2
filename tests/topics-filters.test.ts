import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { generateTopics } from '../src/topics/generate-topics.js';

installGhostwriterMocks({ providerFetch: true, topicsCount: 8 });

try {
  const base = await generateTopics({
    domain: 'filters domain',
    limit: 5,
    model: 'gpt-4o-mini',
    verbose: false
  });
  assert.equal(base.topics.length, 5);

  const inc = await generateTopics({
    domain: 'filters domain',
    limit: 5,
    model: 'gpt-4o-mini',
    includeKeywords: ['Mock Topic 1'],
    verbose: false
  });
  assert.ok(inc.topics.every((t) => /mock topic 1/i.test(t.title)) || inc.topics.length === 0);

  const exc = await generateTopics({
    domain: 'filters domain',
    limit: 5,
    model: 'gpt-4o-mini',
    excludeKeywords: ['Mock Topic 2'],
    verbose: false
  });
  assert.ok(!exc.topics.some((t) => /mock topic 2/i.test(t.title)) || exc.topics.length === 0);

  const regexInc = await generateTopics({
    domain: 'filters domain',
    limit: 5,
    model: 'gpt-4o-mini',
    includeRegex: 'Topic 3',
    verbose: false
  });
  assert.ok(regexInc.topics.every((t) => /topic 3/i.test(t.title)) || regexInc.topics.length === 0);

  const regexExc = await generateTopics({
    domain: 'filters domain',
    limit: 5,
    model: 'gpt-4o-mini',
    excludeRegex: 'Topic 4',
    verbose: false
  });
  assert.ok(!regexExc.topics.some((t) => /topic 4/i.test(t.title)) || regexExc.topics.length === 0);

  console.log('topics-filters.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
