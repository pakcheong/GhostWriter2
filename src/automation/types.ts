import type { ArticleJSON } from '../types.js';
import type { GenerateTopicsOptions } from '../topics/types.js';
import type { GenerateArticleOptions, RequiredContentItem } from '../article/types.js';
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
   * Global baseline required content applied to every topic before per-topic factory items.
   * Use semantic intents (heading | subheading | mention | section). Optional.
   */
  baseRequiredContent?: RequiredContentItem[];

  /**
   * Dynamic per-topic required content generator. Receives the topic title and context (index + all topics).
   * Return semantic required content items; they will be merged with baseRequiredContent and any static
   * article.requiredContent supplied. Later sources win on intent strength and stricter min/max.
   */
  requiredContentFactory?: (
    topic: string,
    ctx: { index: number; topics: string[] }
  ) => RequiredContentItem[] | Promise<RequiredContentItem[]>;

  /**
   * If true, aggregate coverage stats across all generated articles and include in result.
   */
  aggregateCoverage?: boolean;

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
  /** Optional aggregated coverage metrics when aggregateCoverage=true */
  coverageSummary?: {
    required: string[];
    missing: Record<string, number>; // phrase -> count of articles where missing
    overused: Record<string, number>; // phrase -> count of articles flagged overused
    articles: Array<{
      title: string;
      baseName?: string;
      missing: string[];
      overused?: string[];
    }>;
  };
  timings?: {
    startTime: number;
    topicsEndTime: number;
    endTime: number;
    totalMs: number;
    topicsMs: number;
    articlesMs: number;
  };
}
