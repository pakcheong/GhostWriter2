// scripts/utils.ts
import TurndownService from 'turndown';
import { marked } from 'marked';
import {
  encoding_for_model,
  get_encoding,
  type TiktokenModel,
} from '@dqbd/tiktoken';

/* ---------------- Turndown (HTML → Markdown) ---------------- */

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

turndown.addRule('strongToBold', {
  filter: ['strong', 'b'],
  replacement: (content) => (content ? `**${content}**` : ''),
});

turndown.addRule('emToItalic', {
  filter: ['em', 'i'],
  replacement: (content) => (content ? `*${content}*` : ''),
});

/**
 * Convert any HTML to Markdown while preserving [image]...[/image] placeholders.
 */
export function sanitizeMarkdown(input: string): string {
  const placeholders: string[] = [];
  let masked = (input ?? '').replace(/\[image][\s\S]*?\[\/image]/gi, (m) => {
    placeholders.push(m);
    return `___IMAGE_PLACEHOLDER_${placeholders.length - 1}___`;
  });

  const hasHtml = /<\/?[a-z][\s\S]*?>/i.test(masked);
  if (hasHtml) {
    masked = turndown.turndown(masked);
  }

  placeholders.forEach((ph, idx) => { masked = masked.replace(`___IMAGE_PLACEHOLDER_${idx}___`, ph); });
  // Inline normalization of escaped markdown artifacts & leaked placeholders
  let out = masked.trim();
  out = out.replace(/___IMAGE_PLACEHOLDER_\d+___/g, '');
  out = out.replace(/\\\*\*([^*]+)\\\*\*/g, '**$1**');
  out = out.replace(/\\\*([^*]+)\\\*/g, '*$1*');
  out = out.replace(/\\_\\_([^_]+)\\_\\_/g, '__$1__');
  out = out.replace(/\\_([^_]+)\\_/g, '_$1_');
  out = out.replace(/\\`/g, '`');
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

/**
 * Normalize model-generated markdown by:
 * - Unescaping backslash-escaped asterisks and underscores used for formatting (e.g. \*\*bold\*\* -> **bold**)
 * - Removing any stray placeholder artifacts like ___IMAGE_PLACEHOLDER_0___ that leaked through
 * - Collapsing excessive blank lines (3+ -> 2)
 */
// Deprecated: no longer needed externally; kept for backward compatibility
export function normalizeGeneratedMarkdown(markdown: string): string { return sanitizeMarkdown(markdown); }

/* ---------------- Markdown → HTML ---------------- */

/**
 * Convert Markdown to HTML using marked (async).
 */
export async function markdownToHtml(markdown: string): Promise<string> {
  return marked.parse(markdown ?? '');
}

/* ---------------- CLI args, misc helpers ---------------- */

export function maskKey(k?: string) {
  if (!k) return '<missing>';
  return k.length <= 8 ? '********' : `${k.slice(0, 4)}...${k.slice(-4)}`;
}

export function getArg(flag: string, fallback?: string) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

/**
 * Extract a valid JSON object from a possibly noisy model output.
 */
export function sanitizeToJSONObject(raw: string): string {
  const str = raw ?? '';
  try {
    JSON.parse(str);
    return str;
  } catch {
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const candidate = str.slice(start, end + 1);
      JSON.parse(candidate);
      return candidate;
    }
    throw new Error('Model output is not valid JSON.');
  }
}

/* ---------------- Token estimation ---------------- */

function mapModelToTiktoken(modelId?: string): TiktokenModel {
  if (!modelId) return 'gpt-4o-mini';
  const m = modelId.toLowerCase();

  // OpenAI families (best-effort mapping)
  if (m.includes('gpt-4o')) return 'gpt-4o-mini';
  if (m.includes('gpt-4')) return 'gpt-4';
  if (m.includes('gpt-3.5')) return 'gpt-3.5-turbo';

  // Approximate others (e.g., deepseek) with a modern tokenizer
  return 'gpt-4o-mini';
}

/**
 * Estimate token count for a given text and model family, with robust fallbacks.
 */
export function estimateTokens(text: string, modelId?: string): number {
  const content = text ?? '';
  try {
    const tkModel = mapModelToTiktoken(modelId);
    const enc = encoding_for_model(tkModel);
    const n = enc.encode(content).length;
    enc.free();
    return n;
  } catch {
    try {
      const enc = get_encoding('cl100k_base');
      const n = enc.encode(content).length;
      enc.free();
      return n;
    } catch {
      return Math.ceil(content.length / 4); // rough heuristic
    }
  }
}

/* ---------------- Usage & cost helpers ---------------- */

export type Usage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export function emptyUsage(): Usage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

export function addUsage(a: Usage, b: Partial<Usage>): Usage {
  return {
    promptTokens: a.promptTokens + (b.promptTokens ?? 0),
    completionTokens: a.completionTokens + (b.completionTokens ?? 0),
    totalTokens: a.totalTokens + (b.totalTokens ?? 0),
  };
}

export function formatUSD(n: number): string {
  return `$${n.toFixed(6)}`;
}

/**
 * Estimate cost given usage and per-1K token prices.
 */
export function costEstimate(usage: Usage, priceInPerK = 0, priceOutPerK = 0): number {
  const inCost = (usage.promptTokens / 1000) * priceInPerK;
  const outCost = (usage.completionTokens / 1000) * priceOutPerK;
  return inCost + outCost;
}
