import { type ArticleJSON, type ContextStrategy, type ExportMode } from '../types.js';

export interface GenerateArticleOptions {
  model?: string;
  topic: string;
  keywords: string[];
  minWords?: number;
  maxWords?: number;
  existingTags?: string[];
  existingCategories?: string[];
  styleNotes?: string;
  lang?: string;
  contextStrategy?: ContextStrategy;
  priceInPerK?: string | number;
  priceOutPerK?: string | number;
  exportModes?: ExportMode[];
  outBaseName?: string;
  outputDir?: string;
  singleRunTimestamp?: number;
  writeFiles?: boolean;
  verbose?: boolean;
  printPreview?: boolean;
  printUsage?: boolean;
  onArticle?: (article: ArticleJSON) => void | Promise<void>;
  /**
   * Optional dynamic file base name pattern. Tokens:
   *  [title] -> sanitized slug or title
   *  [slug] -> outline slug
   *  [timestamp] -> run timestamp (ms)
   *  [date] -> YYYYMMDD
   *  [time] -> HHmmss
   * Example: '[timestamp]-[title]'
   * Precedence: namePattern > outBaseName > derived slug/title.
   */
  namePattern?: string;
}

export type { ArticleJSON };
