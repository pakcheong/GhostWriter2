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
  startTime: number;
  endTime: number;
}

export type ArticleStatus = 'success' | 'warning';
