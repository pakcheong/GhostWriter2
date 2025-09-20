// Topic (trending) generation skeleton. No real external API yet.
import { resolveProviderForModel, safeGenerateText } from '../llm.js';
import { getClientForProvider } from '../model-config.js';
import type {
  GenerateTopicsOptions,
  TopicCandidate,
  GenerateTopicsWrappedPayload,
  TopicsContent,
  TopicsRuntime
} from './types.js';

import { extractUsage } from '../usage.js';
import { resolvePrices } from '../pricing.js';
import { emptyUsage, addUsage, costEstimate, formatUSD } from '../utils.js';
import Table from 'cli-table3';

export async function generateTopics(options: GenerateTopicsOptions): Promise<GenerateTopicsWrappedPayload> {
  const { domain, model = process.env.OPENAI_MODEL || 'gpt-4o-mini', limit = 8, verbose, lang } = options;
  const { priceInPerK, priceOutPerK, printUsage: printUsageOpt, onTopics } = options;
  const { includeKeywords, excludeKeywords, includeRegex, excludeRegex } = options;
  const provider = resolveProviderForModel(model);
  const { openai } = getClientForProvider(provider, { verbose: !!verbose });

  const langLine = lang ? `All titles and rationale must be written in ${lang}.\n` : '';
  const prompt =
    'You are an assistant that proposes currently compelling, possibly trending ' +
    domain +
    ' article topics.\n' +
    langLine +
    'Return a JSON array; each item MUST have: title, rationale, confidence (0-1 float), riskFlags (ALWAYS an array, [] if none; may include "maybe-outdated","speculative","broad").\n' +
    `Generate ${Math.max(limit * 2, 10)} diverse ideas. Titles must be concise (< 80 chars), avoid clickbait words (shocking, unbelievable, secret).`;

  const startTime = Date.now();
  const genStart = Date.now();
  const genImpl = __topicsGenerateTextImpl || safeGenerateText;
  const res = await genImpl({ model: openai(model), prompt }, { provider, model, phase: 'topics' });
  const generationMs = Date.now() - genStart;
  if (verbose) console.log(`[topics] raw generation in ${generationMs}ms`);

  // Parse / normalize
  let parsed: any[] = [];
  let raw = res.text.trim();
  if (/^```/m.test(raw))
    raw = raw
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/i, '')
      .trim();
  try {
    parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    const objectMatches = raw.match(/\{[\s\S]*?\}/g) || [];
    if (objectMatches.length > 2) {
      const objs: any[] = [];
      for (const om of objectMatches) {
        try {
          objs.push(JSON.parse(om));
        } catch {
          /* ignore fragment */
        }
      }
      parsed = objs;
    }
    if (parsed.length === 0) {
      const lines: string[] = raw
        .split(/\n+/)
        .map((l: string) => l.replace(/^[-*\d.\s`"']+/, '').trim())
        .filter((l: string) => l.length > 0 && /[a-zA-Z]/.test(l) && l.length < 160);
      parsed = lines.slice(0, Math.max(limit * 2, 10)).map((t: string) => ({ title: t.replace(/",?$/, '') }));
    }
  }
  const norm: TopicCandidate[] = parsed
    .map((o) => {
      const title = String(o.title || '').trim();
      const rf = Array.isArray(o.riskFlags) ? o.riskFlags.map((r: any) => String(r)) : [];
      return {
        title,
        rationale: o.rationale ? String(o.rationale) : undefined,
        confidence: typeof o.confidence === 'number' ? o.confidence : undefined,
        riskFlags: rf,
        sourceType: 'llm'
      } as TopicCandidate;
    })
    .filter((c) => c.title.length > 0 && c.title.length < 120);

  const seen = new Set<string>();
  const deduped = norm.filter((c) => {
    const k = c.title.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Filtering (applied post-dedupe, pre-scoring)
  let filtered = deduped;
  const toRegex = (r: string | RegExp | undefined) => {
    if (!r) return undefined;
    if (r instanceof RegExp) return r;
    try {
      return new RegExp(r, 'i');
    } catch {
      return undefined;
    }
  };
  const incRegex = toRegex(includeRegex);
  const excRegex = toRegex(excludeRegex);
  if (includeKeywords && includeKeywords.length) {
    const lowers = includeKeywords.map((k) => k.toLowerCase());
    filtered = filtered.filter((t) => lowers.some((k) => t.title.toLowerCase().includes(k)));
  }
  if (excludeKeywords && excludeKeywords.length) {
    const lowers = excludeKeywords.map((k) => k.toLowerCase());
    filtered = filtered.filter((t) => !lowers.some((k) => t.title.toLowerCase().includes(k)));
  }
  if (incRegex) filtered = filtered.filter((t) => incRegex.test(t.title));
  if (excRegex) filtered = filtered.filter((t) => !excRegex.test(t.title));
  if (filtered.length === 0)
    filtered = deduped; // fallback if over-filtered
  else if (verbose && (includeKeywords?.length || excludeKeywords?.length || includeRegex || excludeRegex)) {
    console.log(`[topics] filtering applied: original=${deduped.length} after=${filtered.length}`);
  }
  const baseList: TopicCandidate[] =
    filtered.length > 0
      ? filtered
      : deduped.length > 0
        ? deduped
        : Array.from({ length: limit }, (_, i) => ({
            title: `Topic Idea ${i + 1}`,
            sourceType: 'llm' as const
          }));
  const scored = baseList.map((c) => ({
    c,
    score: (typeof c.confidence === 'number' ? c.confidence : 0.55) - (c.riskFlags?.length || 0) * 0.05
  }));
  scored.sort((a, b) => b.score - a.score);
  const final = scored.slice(0, limit).map((s) => s.c);

  // Usage & cost
  const usageGeneration = extractUsage(res, model, prompt, res.text);
  const totalUsage = addUsage(emptyUsage(), usageGeneration);
  const pricing = resolvePrices(model, priceInPerK, priceOutPerK);
  const priceIn = pricing.in ?? 0;
  const priceOut = pricing.out ?? 0;
  const costGeneration = pricing.found ? costEstimate(usageGeneration, priceIn, priceOut) : undefined;
  const totalCost = pricing.found ? costEstimate(totalUsage, priceIn, priceOut) : undefined;

  const endTime = Date.now();
  const selectedIndex = final.length ? 0 : -1;
  const usage = { generation: usageGeneration, total: totalUsage };
  const cost = pricing.found
    ? { generation: costGeneration, total: totalCost, priceInPerK: pricing.in, priceOutPerK: pricing.out }
    : undefined;
  const timings = { startTime, endTime, totalMs: endTime - startTime, generationMs };

  if (printUsageOpt) {
    console.log('\n=== Topics Usage & Cost ===');
    console.log(`Provider (mapped): ${provider}  Model: ${model}`);
    if (pricing.found)
      console.log(
        `Pricing (per 1K tokens): input=${priceIn != null ? `$${priceIn}` : 'n/a'}  output=${
          priceOut != null ? `$${priceOut}` : 'n/a'
        } (source: ${pricing.source})`
      );
    else console.log('Pricing (per 1K tokens): n/a');
    const table = new Table({
      head: ['Phase', 'Prompt', 'Completion', 'Total', 'Cost'],
      colWidths: [12, 12, 12, 12, 16],
      style: { head: [], border: [] }
    });
    const fmt = (n?: number) => (typeof n === 'number' ? formatUSD(n) : 'n/a');
    table.push([
      'Generation',
      `${usageGeneration.promptTokens}`,
      `${usageGeneration.completionTokens}`,
      `${usageGeneration.totalTokens}`,
      fmt(costGeneration)
    ]);
    table.push([
      'TOTAL',
      `${totalUsage.promptTokens}`,
      `${totalUsage.completionTokens}`,
      `${totalUsage.totalTokens}`,
      fmt(totalCost)
    ]);
    console.log(table.toString());

    const topicsTable = new Table({
      head: ['#', 'Topic', 'Confidence', 'RiskFlags', 'Rationale'],
      colWidths: [4, 50, 11, 18, 55],
      style: { head: [], border: [] },
      wordWrap: true
    });
    const ordered = [...final];
    if (selectedIndex > 0 && selectedIndex < ordered.length) {
      const [sel] = ordered.splice(selectedIndex, 1);
      ordered.unshift(sel);
    }
    ordered.forEach((t, idx) => {
      const label = idx === 0 && selectedIndex !== -1 ? '*1' : String(idx + 1);
      const conf = typeof t.confidence === 'number' ? t.confidence.toFixed(2) : '';
      const risks = t.riskFlags && t.riskFlags.length ? t.riskFlags.join(',') : '—';
      const rationale = t.rationale ? t.rationale.slice(0, 240) : '';
      topicsTable.push([label, t.title, conf, risks, rationale]);
    });
    console.log('\n=== Topics ===');
    console.log('(Selected topic marked with * in first column)');
    console.log(topicsTable.toString());
  }

  const content: TopicsContent = { domain, topics: final, selectedIndex };
  const runtime: TopicsRuntime = {
    model: { requested: options.model, resolved: model, provider },
    usage,
    cost,
    timings,
    limitRequested: limit,
    limitEffective: final.length,
    filteringApplied: !!(includeKeywords?.length || excludeKeywords?.length || includeRegex || excludeRegex)
  };
  const wrapped: GenerateTopicsWrappedPayload = {
    output: { content, runtime },
    input: { ...options, modelResolved: model }
  };

  if (typeof onTopics === 'function') {
    try {
      await onTopics(wrapped);
    } catch (err) {
      if (verbose) console.warn('[onTopics] callback error:', err);
    }
  }
  return wrapped;
}

// Test hook (mirrors pattern in article generator)
let __topicsGenerateTextImpl: typeof safeGenerateText | undefined;
export function __setTopicsGenerateTextImpl(fn?: typeof safeGenerateText) {
  __topicsGenerateTextImpl = fn;
}
