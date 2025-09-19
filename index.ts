// Root facade: re-export from new structured locations.
export { generateArticle, __setGenerateTextImpl } from './src/article/generate-article.js';
export { generateTopics, __setTopicsGenerateTextImpl } from './src/topics/generate-topics.js';
export type { GenerateTopicsOptions, GenerateTopicsResult, TopicCandidate } from './src/topics/generate-topics.js';
export { generateTrendingArticle } from './src/topics/generate-trending-article.js';
export { autoGenerateArticlesFromTopics } from './src/automation/auto-generate.js';
export type { AutoGenerateOptions, AutoGenerateResult } from './src/automation/auto-generate.js';
export type {
  GenerateArticleOptions,
  ArticleJSON,
  ContextStrategy,
  ExportMode,
  OutlineItem,
  OutlineResult,
} from './src/types.js';
