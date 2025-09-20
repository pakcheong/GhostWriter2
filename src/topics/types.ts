import type { Usage } from '../utils.js';

export interface GenerateTopicsOptions {
  domain: string;
  model?: string;
  limit?: number;
  verbose?: boolean;
  lang?: string;
  priceInPerK?: string | number;
  priceOutPerK?: string | number;
  printUsage?: boolean;
  onTopics?: (result: GenerateTopicsResult) => void | Promise<void>;
  includeKeywords?: string[];
  excludeKeywords?: string[];
  includeRegex?: string | RegExp;
  excludeRegex?: string | RegExp;
}

export interface TopicCandidate {
  title: string;
  rationale?: string;
  confidence?: number;
  riskFlags?: string[];
  sourceType: 'llm';
}

export interface GenerateTopicsResult {
  domain: string;
  mode: 'llm-only';
  topics: TopicCandidate[];
  selectedIndex: number;
  usage: {
    generation: Usage;
    total: Usage;
  };
  cost?: {
    generation?: number;
    total?: number;
    priceInPerK?: number;
    priceOutPerK?: number;
  };
  timings: {
    startTime: number;
    endTime: number;
    totalMs: number;
    generationMs: number;
  };
}
