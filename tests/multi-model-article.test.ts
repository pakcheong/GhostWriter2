import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { generateArticle } from '../src/article/generate-article.js';

const MODELS = ['gpt-4o-mini', 'deepseek-chat', 'llama-3'];
installGhostwriterMocks({ providerFetch: true });
process.env.DEEPSEEK_API_KEY = 'test-key';

try {
  for (const model of MODELS) {
    let captured: any;
    const { article } = await generateArticle({
      topic: `Multi Model Article ${model}`,
      keywords: ['multi', 'model'],
      model,
      exportModes: [],
      writeFiles: false,
      onArticle: (p) => {
        captured = p;
      }
    });
    assert.ok(article.title.length > 0);
  assert.ok(captured.output?.runtime?.model?.provider);
  }
  console.log('multi-model-article.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
