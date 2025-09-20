import { type ArticleJSON, type ContextStrategy, type ExportMode } from '../types.js';

export interface GenerateArticleCallbackInputMetaInput {
  topic: string;
  keywords: string[];
  minWords: number;
  maxWords: number;
  styleNotes?: string;
  lang: string;
  contextStrategy: ContextStrategy;
  exportModes: ExportMode[];
  modelRequested?: string; // user supplied model option
  modelResolved: string; // final model used
  priceInPerK?: string | number;
  priceOutPerK?: string | number;
  existingTags?: string[];
  existingCategories?: string[];
  namePattern?: string;
  outBaseName?: string;
  writeFiles: boolean;
  verbose?: boolean;
}

export interface GenerateArticleCallbackMeta {
  runTimestamp: number;
  baseName: string;
  outlineAttempts: number;
  duplicateRatio: number;
  provider: 'openai' | 'deepseek' | 'lmstudio';
  pricingResolved: { inPerK?: number; outPerK?: number; found: boolean };
  timingsSummary: {
    totalMs: number;
    outlineMs: number;
    sectionsMs: number;
    assembleMs: number;
    exportMs: number;
  };
  sectionCount: number;
  subheadingTotal: number;
  contextStrategyEffective: ContextStrategy;
  warning: boolean;
}

export interface GenerateArticleCallbackPayload {
  output: ArticleJSON;
  input: GenerateArticleCallbackInputMetaInput;
  meta: GenerateArticleCallbackMeta;
}

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
  // Now receives full wrapper with output + input + meta
  onArticle?: (payload: GenerateArticleCallbackPayload) => void | Promise<void>;
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
