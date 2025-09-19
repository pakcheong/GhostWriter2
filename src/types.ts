import { type Usage } from './utils.js';
export type ContextStrategy = 'outline' | 'full' | 'summary';
export type ExportMode = 'json' | 'html' | 'md';

export interface OutlineItem {
  heading: string;
  subheadings: string[];
}
export interface OutlineResult {
  title: string;
  description: string;
  slug: string;
  outline: OutlineItem[];
  tags: string[];
  categories: string[];
}
export interface ArticleBase {
  title: string;
  description: string;
  body: string;
  tags: string[];
  categories: string[];
  slug: string;
}
export interface ArticleJSON extends ArticleBase {
  model: string;
  status: ArticleStatus; // generation quality status
  timings: ArticleTimings;
  sectionTimings: SectionTiming[];
  usage: {
    outline: Usage;
    sections: Usage;
    summaries?: Usage;
    total: Usage;
  };
  cost?: {
    outline?: number;
    sections?: number;
    summaries?: number;
    total?: number;
    priceInPerK?: number;
    priceOutPerK?: number;
  };
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
  onArticle?: (article: ArticleJSON) => void | Promise<void>; // callback after article assembled (before/after export)
}

export type MaybeUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type SubTiming = { title: string; ms: number };
export type SectionTiming = {
  heading: string;
  subheadingCount: number;
  ms: number;
  subTimings: SubTiming[];
  summaryMs?: number;
};

export interface ArticleTimings {
  totalMs: number;
  outlineMs: number;
  assembleMs: number;
  exportMs: number;
  outlineAttempts: number;
}

export type ArticleStatus = 'success' | 'warning';
