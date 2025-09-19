import type { OutlineResult } from './types.js';

interface DedupeOptions {
  verbose?: boolean;
}

// Merge strategy:
// - If multiple sections share the same heading (case-insensitive, trimmed), merge their subheadings
//   into the first occurrence, preserving original order of appearance, removing duplicates (case-insensitive).
// - Subsequent duplicate sections are discarded.
// - Subheading duplicates across merged sections are collapsed; no numeric suffixes are appended.
// - Global subheading collisions in different distinct sections are left as-is (only merged within same heading group).

function normalizeHeading(h: string): string {
  return h
    .replace(/[。．.]+$/u, '') // strip trailing periods (English/Fullwidth)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function dedupeOutline(outline: OutlineResult, opts: DedupeOptions = {}): OutlineResult {
  const seenSections = new Map<string, { heading: string; subheadings: string[] }>();
  const order: string[] = [];

  for (const section of outline.outline) {
    const key = normalizeHeading(section.heading);
    if (!seenSections.has(key)) {
      order.push(key);
      // initialize with normalized heading (original casing from first occurrence)
      seenSections.set(key, { heading: section.heading, subheadings: [] });
    }
    const bucket = seenSections.get(key)!;
    // merge subheadings preserving first occurrence order & case of first appearance
    const seenSubs = new Set(bucket.subheadings.map(s => s.toLowerCase().trim()));
    for (const sh of section.subheadings) {
      const skey = sh.toLowerCase().trim();
      if (!skey) continue;
      if (!seenSubs.has(skey)) {
        bucket.subheadings.push(sh);
        seenSubs.add(skey);
      }
    }
  }

  const mergedSections = order.map(k => seenSections.get(k)!);

  if (opts.verbose) {
    const originalCount = outline.outline.length;
    const mergedCount = mergedSections.length;
    if (mergedCount !== originalCount) {
      console.log(`[dedupe] Merged duplicate sections: ${originalCount} -> ${mergedCount}`);
    }
  }

  return { ...outline, outline: mergedSections };
}

export function computeDuplicateRatio(raw: OutlineResult, deduped: OutlineResult): number {
  if (!raw.outline.length) return 0;
  const rawCount = raw.outline.length;
  const dedupCount = deduped.outline.length;
  const removed = rawCount - dedupCount;
  return removed > 0 ? removed / rawCount : 0;
}
