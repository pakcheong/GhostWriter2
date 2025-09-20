import type { ArticleJSON } from '../types.js';
import type { GenerateTopicsOptions } from '../topics/types.js';
import type { GenerateArticleOptions } from '../article/types.js';
import type { generateTopics } from '../topics/generate-topics.js';

export interface AutoGenerateOptions {
  /**
   * Topics generation configuration. Passed to generateTopics first.
   * Optional limit overrides the underlying topics limit.
   */
  topics: Omit<GenerateTopicsOptions, 'limit'> & { limit?: number };

  /**
   * Base article generation options (topic & keywords come from the topics phase).
   * Optional keywords here override derived ones from the topic if provided.
   */
  article: Omit<GenerateArticleOptions, 'topic' | 'keywords'> & { keywords?: string[] };

  /**
   * Number of articles to generate. Defaults to topics.limit or final topics length.
   */
  count?: number;

  /**
   * Max concurrent article generation tasks. Higher values may hit rate limits.
   */
  concurrency?: number;

  /**
   * Callback after topics generation. Provides final topics plus raw result for inspection.
   */
  onTopicsResult?: (r: {
    topics: string[];
    raw: ReturnType<typeof generateTopics> extends Promise<infer R> ? R : never;
  }) => void | Promise<void>;

  /**
   * Per-article callback. index is 0-based.
   * Receives the internal flat ArticleJSON (core article fields). If you need runtime diagnostics,
   * use the wrapper returned by generateArticle directly in other code paths.
   */
  onArticle?: (article: ArticleJSON, index: number) => void | Promise<void>;

  /**
   * Enable verbose logging.
   */
  verbose?: boolean;
}

export interface AutoGenerateResult {
  topics: string[];
  articles: ArticleJSON[];
  timings?: {
    startTime: number;
    topicsEndTime: number;
    endTime: number;
    totalMs: number;
    topicsMs: number;
    articlesMs: number;
  };
}
