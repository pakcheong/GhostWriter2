import assert from 'assert';
import { generateArticle } from '../src/article/generate-article.js';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';

// Disable providerFetch so internal safeGenerateText would attempt fetch -> should error (since mock article impl handles generation; no fetch expected unless provider mapping triggers).
installGhostwriterMocks({ providerFetch: false });
let threw = false;
try {
  await generateArticle({
    topic: 'Isolation Example',
    keywords: ['isolation'],
    model: 'gpt-4o-mini',
    exportModes: [],
    writeFiles: false
  });
} catch {
  threw = true;
}
resetGhostwriterMocks();
assert.ok(threw === false, 'Article generation should not need network when providerFetch disabled');
console.log('isolation-no-network.test.ts passed');
