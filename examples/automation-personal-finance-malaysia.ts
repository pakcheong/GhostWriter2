import { autoGenerateArticlesFromTopics } from '../dist/index.js';
import type { AutoGenerateTopicsConfig, AutoGenerateArticleConfig } from '../src/automation/auto-generate.js';
import type { ArticleJSON } from '../src/types.js';
import { logArticle } from './util.js';

// Auto-generate multiple Malaysia personal finance articles using topic generation + concurrency.
// Demonstrates filtering & selecting top N finance-related topics.
// Strongly typed configs
// Safe env access without Node type dependency
const envModel = (globalThis as any)?.process?.env?.OPENAI_MODEL || 'gpt-4o-mini';

const topicsConfig: AutoGenerateTopicsConfig = {
  domain:
    'Malaysia personal finance 2025 (EPF/KWSP, ASB, budgeting, inflation, takaful, PTPTN, side income, digital banking, e-wallet adoption, retirement planning)',
  model: envModel,
  limit: 2,
  lang: 'en',
  includeKeywords: ['finance', 'investment', 'savings', 'retirement', 'income', 'inflation'],
  excludeKeywords: ['crypto airdrop', 'get rich quick'],
  verbose: false,
  printUsage: false
};

const articleConfig: AutoGenerateArticleConfig = {
  model: envModel,
  minWords: 700,
  maxWords: 1000,
  exportModes: ['json', 'md'],
  contextStrategy: 'outline',
  writeFiles: true,
  verbose: false, // minimize noise; set true for detailed timings/usage
  existingTags: ['personal finance', 'Malaysia', 'investment', 'savings'],
  existingCategories: ['personal-finance', 'Malaysia'],
  styleNotes: 'Practical, regulatory-aware (BNM), structured, clear action steps',
  onArticle(_a: ArticleJSON) {
    console.log(_a);
    logArticle('auto-personal-finance-my', _a);
  }
};

(async () => {
  const _result = await autoGenerateArticlesFromTopics({
    topics: topicsConfig,
    article: articleConfig,
    count: 4, // top N topics to convert into articles (-1 for all)
    concurrency: 2,
    verbose: false,
    printUsage: false
  });

  // console.log('\n[sample] Generated personal finance MY articles:', result.articles.length);
  // console.log('[sample] Topics (original generation order, first 10 shown):');
  // result.topics.slice(0, 10).forEach((t: string, i: number) => console.log(`  ${i + 1}. ${t}`));
})();
