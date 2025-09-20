import type { Usage } from '../utils.js';

/**
 * Options controlling topic generation from a domain seed.
 */
export interface GenerateTopicsOptions {
  /** High-level domain / niche to explore (e.g. "personal finance malaysia") */
  domain: string;
  /** Preferred model name (falls back to env/default) */
  model?: string;
  /** Desired number of topic candidates (soft limit, may trim) */
  limit?: number;
  /** Enable verbose logging for debugging prompts and parsing */
  verbose?: boolean;
  /** Language for generated topics / rationales */
  lang?: string;
  /** Override pricing for input tokens (USD per 1K) */
  priceInPerK?: string | number;
  /** Override pricing for output tokens (USD per 1K) */
  priceOutPerK?: string | number;
  /** Print token usage/cost table to console */
  printUsage?: boolean;
  /** Callback invoked with final topics wrapper (content + runtime + echoed input) */
  onTopics?: (result: GenerateTopicsWrappedPayload) => void | Promise<void>;
  /** Only keep topics containing at least one of these keywords */
  includeKeywords?: string[];
  /** Discard topics containing any of these keywords */
  excludeKeywords?: string[];
  /** Regex (string or RegExp) that a topic title must match */
  includeRegex?: string | RegExp;
  /** Regex causing exclusion if matched by topic title */
  excludeRegex?: string | RegExp;
}

/**
 * A single topic candidate proposed by the LLM.
 */
export interface TopicCandidate {
  /** Topic title text */
  title: string;
  /** Optional reasoning / justification string */
  rationale?: string;
  /** Normalized confidence (0..1 or model-provided heuristic) */
  confidence?: number;
  /** Flags indicating potential issues (e.g. compliance, ambiguity) */
  riskFlags?: string[];
  /** Source type (currently always 'llm' but reserved for future) */
  sourceType: 'llm';
}

/**
 * Result object returned after generating topic candidates.
 */
export interface GenerateTopicsResult {
  /** Original domain string provided */
  domain: string;
  /** Mode descriptor (future-proofing for hybrid strategies) */
  mode: 'llm-only';
  /** All topic candidates (already filtered / limited) */
  topics: TopicCandidate[];
  /** Index of topic chosen as primary (0-based) */
  selectedIndex: number;
  /** Token usage stats (generation phase + total) */
  usage: {
    generation: Usage;
    total: Usage;
  };
  /** Optional cost estimates (USD) when pricing is available */
  cost?: {
    generation?: number;
    total?: number;
    priceInPerK?: number;
    priceOutPerK?: number;
  };
  /** Timings (ms) and wall clock boundaries */
  timings: {
    startTime: number;
    endTime: number;
    totalMs: number;
    generationMs: number;
  };
}

/** Content portion of topics generation (pure semantic list) */
export interface TopicsContent {
  domain: string;
  topics: TopicCandidate[];
  selectedIndex: number;
}

/** Runtime stats for topics generation (usage, timing, pricing) */
export interface TopicsRuntime {
  model: { requested?: string; resolved: string; provider: 'openai' | 'deepseek' | 'lmstudio' };
  usage: GenerateTopicsResult['usage'];
  cost?: GenerateTopicsResult['cost'];
  timings: GenerateTopicsResult['timings'];
  limitRequested: number;
  limitEffective: number;
  filteringApplied: boolean;
}

/** Wrapper payload aligning topics with article generator output shape */
export interface GenerateTopicsWrappedPayload {
  output: { content: TopicsContent; runtime: TopicsRuntime };
  input: GenerateTopicsOptions & { modelResolved: string };
}
