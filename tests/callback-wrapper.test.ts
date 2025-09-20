import assert from 'assert';
import { generateArticle } from '../src/article/generate-article.js';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';

installGhostwriterMocks({ providerFetch: true });

let captured: any;
try {
  const { article } = await generateArticle({
    topic: 'Callback Wrapper Test',
    keywords: ['wrapper'],
    model: 'gpt-4o-mini',
    exportModes: [],
    writeFiles: false,
    verbose: false,
    namePattern: '[timestamp]-[title]',
    onArticle: (p) => {
      captured = p;
    }
  });
  assert.ok(article.title);
  assert.ok(captured, 'callback payload missing');
  assert.ok(captured.output?.content?.title === article.title);
  assert.ok(captured.input?.topic.includes('Callback Wrapper Test'));
  assert.ok(captured.output?.runtime?.model?.provider === 'openai');
  assert.ok(typeof captured.output?.runtime?.timings?.totalMs === 'number');
  assert.ok(typeof captured.output?.runtime?.timings?.outlineAttempts === 'number');
  assert.ok(typeof captured.output?.runtime?.strategy?.duplicateRatio === 'number');
  assert.ok(captured.output?.runtime?.counts?.sectionCount >= 1);
  assert.ok(captured.output?.runtime?.counts?.subheadingTotal >= 1);
  console.log('callback-wrapper.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
