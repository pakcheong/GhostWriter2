import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { generateArticle } from '../src/article/generate-article.js';
import { generateTopics } from '../src/topics/generate-topics.js';

installGhostwriterMocks({ topicsCount: 3 });

try {
  const topics = await generateTopics({ domain: 'x', limit: 3 });
  assert.equal(topics.topics.length, 3, 'expected 3 mock topics');
  assert.ok(topics.topics[0].title.startsWith('Mock Topic'), 'mock topic title');

  const { article } = await generateArticle({
    topic: 'Anything',
    keywords: ['k'],
    exportModes: ['json'],
    model: 'gpt-4o-mini'
  });
  assert.equal(article.title, 'Mock Title');
  assert.ok(article.tags.includes('mock'), 'expected mock tag');
  console.log('mocks-article-topics.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
