import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { generateArticle } from '../src/article/generate-article.js';

installGhostwriterMocks({ providerFetch: true });

try {
  const { article } = await generateArticle({
    topic: 'Smoke Test Topic',
    keywords: ['smoke'],
    model: 'gpt-4o-mini',
    exportModes: [],
    writeFiles: false,
    contextStrategy: 'summary'
  });
  assert.ok(article.title.length > 0, 'title');
  assert.ok(article.sectionTimings.length === 2, 'expected 2 sections');
  assert.ok(article.usage.total.totalTokens > 0, 'usage tokens');
  console.log('article-smoke.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
