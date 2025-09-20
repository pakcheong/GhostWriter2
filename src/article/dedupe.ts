import type { OutlineResult } from '../types.js';

interface DedupeOptions {
  verbose?: boolean;
}

function normalizeHeading(h: string): string {
  return h
    .replace(/[。．.]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function dedupeOutline(outline: OutlineResult, opts: DedupeOptions = {}): OutlineResult {
  const seen = new Map<string, { heading: string; subheadings: string[] }>();
  const order: string[] = [];
  for (const section of outline.outline) {
    const key = normalizeHeading(section.heading);
    if (!seen.has(key)) {
      order.push(key);
      seen.set(key, { heading: section.heading, subheadings: [] });
    }
    const bucket = seen.get(key)!;
    const seenSubs = new Set(bucket.subheadings.map((s) => s.toLowerCase().trim()));
    for (const sh of section.subheadings) {
      const skey = sh.toLowerCase().trim();
      if (!skey) continue;
      if (!seenSubs.has(skey)) {
        bucket.subheadings.push(sh);
        seenSubs.add(skey);
      }
    }
  }
  const merged = order.map((k) => seen.get(k)!);
  if (opts.verbose && merged.length !== outline.outline.length) {
    console.log(`[dedupe] Merged duplicate sections: ${outline.outline.length} -> ${merged.length}`);
  }
  return { ...outline, outline: merged };
}

export function computeDuplicateRatio(raw: OutlineResult, deduped: OutlineResult): number {
  if (!raw.outline.length) return 0;
  const removed = raw.outline.length - deduped.outline.length;
  return removed > 0 ? removed / raw.outline.length : 0;
}
