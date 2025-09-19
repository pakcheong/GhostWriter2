import { generateArticle } from '../dist/index.js';
import { logArticle } from './util.js';

(async () => {
  const { article } = await generateArticle({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    topic: 'Digital Banking and Fintech Growth in Malaysia 2025',
    keywords: ['Malaysia fintech','digital banking','e-wallet','BNM regulation'],
    minWords: 700,
    maxWords: 950,
    existingTags: ['finance','fintech','Malaysia'],
    existingCategories: ['finance','asia'],
    styleNotes: 'data-informed, regulatory-aware, concise',
    lang: 'en',
    contextStrategy: 'summary',
    exportModes: ['json','md'],
    outputDir: './output',
    writeFiles: true,
    verbose: true,
    onArticle(a: any) { logArticle('finance-my', a); }
  });
  console.log('[sample] generated finance MY article slug:', article.slug);
})();
