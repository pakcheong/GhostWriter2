import assert from 'assert';
import { sanitizeBaseName } from '../src/article/assembly.js';
import { generateArticle } from '../src/article/generate-article.js';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';

// Direct sanitize
assert.equal(sanitizeBaseName('  Hello World!!  '), 'hello-world');
assert.equal(sanitizeBaseName('中文 标题 😀'), 'article');
assert.equal(sanitizeBaseName('---A--B--'), 'a-b');

installGhostwriterMocks({ providerFetch: true });
let captured: any;
try {
  await generateArticle({
    topic: 'Pattern Example',
    keywords: ['pattern'],
    model: 'gpt-4o-mini',
    exportModes: [],
    writeFiles: false,
    namePattern: '[date]-[time]-[title]',
    onArticle: (p) => {
      captured = p;
    }
  });
  assert.ok(/\d{8}-\d{6}-mock-title/.test(captured.output?.runtime?.baseName));
  console.log('name-pattern.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
