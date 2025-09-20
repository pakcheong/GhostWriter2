import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { generateArticle } from '../src/article/generate-article.js';

const models = ['gpt-4o-mini', 'deepseek-chat', 'openai/gpt-oss-20b'];

installGhostwriterMocks({ providerFetch: true });

try {
  for (const m of models) {
    process.env.DEEPSEEK_API_KEY = 'test';
    const { article } = await generateArticle({
      topic: `MultiModel ${m}`,
      keywords: ['alpha'],
      model: m as any,
      exportModes: [],
      writeFiles: false
    });
    assert.equal(article.model, m);
    assert.ok(article.title.length > 0, 'title');
    assert.ok(article.sectionTimings.length === 2, 'expected 2 sections from mock outline');
  }
  console.log('multimodel-article.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
