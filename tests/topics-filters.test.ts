import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { generateTopics } from '../src/topics/generate-topics.js';

installGhostwriterMocks({ providerFetch: true, topicsCount: 8 });

try {
  const baseWrap = await generateTopics({
    domain: 'filters domain',
    limit: 5,
    model: 'gpt-4o-mini',
    verbose: false
  });
  const baseTopics = baseWrap.output.content.topics;
  assert.equal(baseTopics.length, 5);

  const incWrap = await generateTopics({
    domain: 'filters domain',
    limit: 5,
    model: 'gpt-4o-mini',
    includeKeywords: ['Mock Topic 1'],
    verbose: false
  });
  const incTopics = incWrap.output.content.topics;
  assert.ok(incTopics.every((t: any) => /mock topic 1/i.test(t.title)) || incTopics.length === 0);

  const excWrap = await generateTopics({
    domain: 'filters domain',
    limit: 5,
    model: 'gpt-4o-mini',
    excludeKeywords: ['Mock Topic 2'],
    verbose: false
  });
  const excTopics = excWrap.output.content.topics;
  assert.ok(!excTopics.some((t: any) => /mock topic 2/i.test(t.title)) || excTopics.length === 0);

  const regexIncWrap = await generateTopics({
    domain: 'filters domain',
    limit: 5,
    model: 'gpt-4o-mini',
    includeRegex: 'Topic 3',
    verbose: false
  });
  const regexIncTopics = regexIncWrap.output.content.topics;
  assert.ok(regexIncTopics.every((t: any) => /topic 3/i.test(t.title)) || regexIncTopics.length === 0);

  const regexExcWrap = await generateTopics({
    domain: 'filters domain',
    limit: 5,
    model: 'gpt-4o-mini',
    excludeRegex: 'Topic 4',
    verbose: false
  });
  const regexExcTopics = regexExcWrap.output.content.topics;
  assert.ok(!regexExcTopics.some((t: any) => /topic 4/i.test(t.title)) || regexExcTopics.length === 0);

  console.log('topics-filters.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
