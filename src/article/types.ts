import { type ArticleJSON, type ContextStrategy, type ExportMode } from '../types.js';

/**
 * Input parameters echo returned with the callback so consumers can correlate
 * original request intent with generated output and runtime stats.
 */
export interface GenerateArticleCallbackInputMetaInput {
  /** Original topic string provided by user */
  topic: string;
  /** Keyword list used to guide outline + section prompts */
  keywords: string[];
  /** Requested minimum word count target (soft) */
  minWords: number;
  /** Requested maximum word count target (soft) */
  maxWords: number;
  /** Optional style / tone / formatting guidance */
  styleNotes?: string;
  /** Content language (affects prompts) */
  lang: string;
  /** Context strategy requested (outline | full | summary) */
  contextStrategy: ContextStrategy;
  /** Export modes requested for file output */
  exportModes: ExportMode[];
  /** Model explicitly requested by caller (may differ from resolved) */
  modelRequested?: string;
  /** Final model actually used after environment / fallback resolution */
  modelResolved: string;
  /** Override inbound (prompt) pricing per 1K tokens if supplied */
  priceInPerK?: string | number;
  /** Override outbound (completion) pricing per 1K tokens if supplied */
  priceOutPerK?: string | number;
  /** Existing tag vocabulary to bias / reuse */
  existingTags?: string[];
  /** Existing category taxonomy to bias / reuse */
  existingCategories?: string[];
  /** Dynamic filename pattern overriding base name (see namePattern docs) */
  namePattern?: string;
  /** Explicit base name override (if pattern not used) */
  outBaseName?: string;
  /** Whether files were written to disk */
  writeFiles: boolean;
  /** Verbose logging flag passed in */
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

// Merged output structure (no schema version tag)
export interface ArticleContent {
  title: string;
  description?: string;
  body: string;
  slug: string;
  tags?: string[];
  categories?: string[];
}

/**
 * Runtime metadata capturing performance, usage, pricing and structural stats
 * about the generated article. Nested objects separate timing vs token usage.
 */
export interface ArticleRuntime {
  /** Epoch ms when this generation run started / was stamped */
  runTimestamp: number;
  /** Base filename (without extension) used for exports */
  baseName: string;
  /** Model provenance: requested vs resolved + provider mapping */
  model: { requested?: string; resolved: string; provider: 'openai' | 'deepseek' | 'lmstudio' };
  /** Strategy and duplication diagnostics */
  strategy: { context: { requested: ContextStrategy; effective: ContextStrategy }; duplicateRatio: number };
  /** Counts of macro sections and total subheadings */
  counts: { sectionCount: number; subheadingTotal: number };
  /** Timing breakdown (ms) including per-section list */
  timings: {
    /** Total wall time for entire pipeline */
    totalMs: number;
    /** Outline generation elapsed ms */
    outlineMs: number;
    /** Sum of all section (subheading + summary) times */
    sectionsMs: number;
    /** Assembly pass (joining markdown, building final doc) */
    assembleMs: number;
    /** Export (writing files) duration */
    exportMs: number;
    /** Outline attempts performed (>=1; may retry on duplication) */
    outlineAttempts: number;
    /** Per-section timing details */
    sectionsBreakdown: Array<{
      /** Section heading text */
      heading: string;
      /** Total ms for section (all subheadings + optional summary) */
      ms: number;
      /** Individual subheading timings */
      subheadings: Array<{ title: string; ms: number }>;
      /** Optional summary timing (summary strategy only) */
      summary?: { ms: number };
    }>;
  };
  /** Token usage aggregated by phase plus per-section */
  usage: {
    /** Outline prompt/completion usage */
    outline: { promptTokens: number; completionTokens: number; totalTokens: number };
    /** Combined sections (all subheadings) usage */
    sections: { promptTokens: number; completionTokens: number; totalTokens: number };
    /** Summaries usage (only when summary context strategy active) */
    summaries?: { promptTokens: number; completionTokens: number; totalTokens: number };
    /** Grand total usage across all phases */
    total: { promptTokens: number; completionTokens: number; totalTokens: number };
    /** Per-section token breakdown including each subheading and optional summary */
    sectionsBreakdown: Array<{
      /** Section heading */
      heading: string;
      /** Tokens aggregated for the whole section */
      tokens: { prompt: number; completion: number; total: number };
      /** Subheading granular token stats */
      subheadings: Array<{
        title: string;
        tokens: { prompt: number; completion: number; total: number };
      }>;
      /** Optional summary token stats */
      summary?: { tokens: { prompt: number; completion: number; total: number } };
    }>;
  };
  /** Resolved pricing (if available) for in/out tokens */
  pricing?: { inPerK?: number; outPerK?: number; found: boolean };
  /** Cost estimation per phase + total (USD) */
  cost?: { outline?: number; sections?: number; summaries?: number; total?: number };
  /** True when duplicate ratio triggered a warning condition */
  warning: boolean;
}

/**
 * Callback payload delivered after article generation. Combines output content,
 * rich runtime stats, plus the echoed input parameters.
 */
export interface GenerateArticleCallbackPayload {
  /** Generated article content (pure semantic data) */
  output: {
    content: ArticleContent;
    /** Runtime diagnostics and usage metrics */
    runtime: ArticleRuntime;
  };
  /** Echo of original input parameters */
  input: GenerateArticleCallbackInputMetaInput;
}

/**
 * Options for generating a single article. Controls prompt parameters, export
 * behavior, pricing overrides, and callback handling.
 */
export interface GenerateArticleOptions {
  /** Preferred model name (falls back to env or default) */
  model?: string;
  /** Topic to generate content for (drives outline) */
  topic: string;
  /** Seed keywords influencing SEO / topical focus */
  keywords: string[];
  /** Soft lower bound target word count */
  minWords?: number;
  /** Soft upper bound target word count */
  maxWords?: number;
  /** Existing tags to bias tagging + reuse */
  existingTags?: string[];
  /** Existing categories to bias taxonomy selection */
  existingCategories?: string[];
  /** Style / tone guidance appended to prompts */
  styleNotes?: string;
  /** Output language (default 'en') */
  lang?: string;
  /** Context strategy for section generation (outline | full | summary) */
  contextStrategy?: ContextStrategy;
  /** Override pricing for prompt tokens (USD per 1K) */
  priceInPerK?: string | number;
  /** Override pricing for completion tokens (USD per 1K) */
  priceOutPerK?: string | number;
  /** Which export file formats to write (json | html | md) */
  exportModes?: ExportMode[];
  /** Static base name for files (ignored if namePattern provided) */
  outBaseName?: string;
  /** Directory to write export files (default ./result) */
  outputDir?: string;
  /** Supply fixed timestamp for deterministic file naming */
  singleRunTimestamp?: number;
  /** Enable writing files to disk (set false for pure in-memory usage) */
  writeFiles?: boolean;
  /** Verbose logging of intermediate steps */
  verbose?: boolean;
  /** Print article preview to console (if supported in examples) */
  printPreview?: boolean;
  /** Print token usage & cost table to console */
  printUsage?: boolean;
  /** Callback invoked with full payload (content + runtime + input echo) */
  onArticle?: (payload: GenerateArticleCallbackPayload) => void | Promise<void>;
  /**
   * Dynamic filename pattern tokens:
   *  [title] -> sanitized slug/title
   *  [slug] -> outline slug
   *  [timestamp] -> run timestamp (ms)
   *  [date] -> YYYYMMDD
   *  [time] -> HHmmss
   * Precedence: namePattern > outBaseName > derived slug/title.
   */
  namePattern?: string;
}

export type { ArticleJSON };
