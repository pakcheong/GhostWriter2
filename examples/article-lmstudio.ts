import { generateArticle } from '../dist/index.js';
import { type GenerateArticleCallbackPayload } from '../src/article/types.js';
import { logArticle } from './util.js';

async function isLmStudioReachable(base?: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const url = (base || 'http://localhost:1234/v1').replace(/\/$/, '') + '/models';
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    clearTimeout(timeout);
    return false;
  }
}

(async () => {
  const base = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
  const reachable = await isLmStudioReachable(base);
  if (!reachable) {
    console.log('[sample:lmstudio] Skip (unreachable)');
    return;
  }
  const { article } = await generateArticle({
    model: process.env.LMSTUDIO_MODEL || 'openai/gpt-oss-20b',
    topic: 'Local Inference Optimization Techniques',
    keywords: ['quantization', 'gguf', 'throughput'],
    minWords: 400,
    maxWords: 600,
    existingTags: ['llm'],
    existingCategories: ['infrastructure'],
    styleNotes: 'technical, concise',
    lang: 'en',
    contextStrategy: 'outline',
    exportModes: ['json'],
    writeFiles: false,
    verbose: true,
    onArticle(a: GenerateArticleCallbackPayload) {
      logArticle('lmstudio', a);
    }
  });
  console.log('[sample:lmstudio] generated:', article.slug);
})();
