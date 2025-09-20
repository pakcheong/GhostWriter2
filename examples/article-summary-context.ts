import { generateArticle } from '../dist/index.js';
import { type GenerateArticleCallbackPayload } from '../src/article/types.js';
import { logArticle } from './util.js';

(async () => {
  const { article } = await generateArticle({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    topic: 'Adopting React Server Components in Legacy Apps',
    keywords: ['react', 'server components', 'migration'],
    minWords: 900,
    maxWords: 1100,
    existingTags: ['react'],
    existingCategories: ['frontend'],
    styleNotes: 'authoritative, migration-focused',
    lang: 'en',
    contextStrategy: 'summary',
    exportModes: ['json'],
    outputDir: './output',
    writeFiles: true,
    verbose: true,
    onArticle(a: GenerateArticleCallbackPayload) {
      logArticle('summary', a);
    }
  });
  console.log('[sample] generated (summary):', article.slug);
})();
