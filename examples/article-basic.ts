import { generateArticle } from '../dist/index.js';
import { type GenerateArticleCallbackPayload } from '../src/article/types.js';
import { logArticle } from './util.js';

(async () => {
  const { article } = await generateArticle({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    topic: 'Edge Caching Strategies in 2025',
    keywords: ['cdn', 'cache-control', 'stale-while-revalidate'],
    minWords: 600,
    maxWords: 800,
    existingTags: ['performance'],
    existingCategories: ['infrastructure'],
    styleNotes: 'practical, concise, technical',
    lang: 'en',
    contextStrategy: 'outline',
    exportModes: ['json', 'md'],
    writeFiles: true,
    verbose: true,
    onArticle(a: GenerateArticleCallbackPayload) {
      logArticle('basic', a);
    }
  });
  console.log('[sample] generated:', article.slug);
})();
