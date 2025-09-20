import { generateArticle } from '../dist/index.js';
import { type GenerateArticleCallbackPayload } from '../src/article/types.js';
import { logArticle } from './util.js';

(async () => {
  const { article } = await generateArticle({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    topic: 'Digital Banking and Fintech Growth in Malaysia 2025',
    keywords: ['Malaysia fintech', 'digital banking', 'e-wallet', 'BNM regulation'],
    minWords: 700,
    maxWords: 950,
    existingTags: ['finance', 'fintech', 'Malaysia'],
    existingCategories: ['finance', 'asia'],
    styleNotes: 'data-informed, regulatory-aware, concise',
    lang: 'en',
    contextStrategy: 'summary',
    exportModes: ['json', 'md'],
    writeFiles: true,
    strictRequired: true,
    verbose: false,
    // Demonstrate semantic required content + legacy phrase array together
    requiredContent: [
      { text: 'Regulatory Environment for Digital Banking', intent: 'heading' },
      { text: 'BNM Licensing Initiatives', intent: 'subheading' },
      { text: 'digital banking licenses', intent: 'mention', minMentions: 2, maxMentions: 6 },
      { text: 'Bank Negara Malaysia', intent: 'mention', minMentions: 1 },
      { text: 'Islamic finance', intent: 'mention', optional: true, minMentions: 1 },
      { text: 'e-wallet adoption', intent: 'section', minMentions: 1, maxMentions: 4 }
    ],
    requiredCoveragePhrases: ['open banking', 'regtech'],
    onArticle(a: GenerateArticleCallbackPayload) {
      logArticle('finance-my', a);
    }
  });
  console.log('[sample] generated finance MY article slug:', article.slug);
})();
