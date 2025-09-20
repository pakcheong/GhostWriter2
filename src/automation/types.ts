import type { ArticleJSON } from '../types.js';
import type { GenerateTopicsOptions } from '../topics/types.js';
import type { GenerateArticleOptions } from '../article/types.js';
import type { generateTopics } from '../topics/generate-topics.js';

export interface AutoGenerateOptions {
  topics: Omit<GenerateTopicsOptions, 'limit'> & { limit?: number };
  article: Omit<GenerateArticleOptions, 'topic' | 'keywords'> & { keywords?: string[] };
  count?: number;
  concurrency?: number;
  onTopicsResult?: (r: {
    topics: string[];
    raw: ReturnType<typeof generateTopics> extends Promise<infer R> ? R : never;
  }) => void | Promise<void>;
  onArticle?: (article: ArticleJSON, index: number) => void | Promise<void>;
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
