import type { OutlineItem } from '../types.js';

// (moved from root) Outline prompt utilities
const OUTLINE_SCHEMA_INSTRUCTIONS = `Return STRICT JSON matching this TypeScript interface:
{
  "title": string,
  "description": string,
  "slug": string,
  "outline": [ { "heading": string, "subheadings": string[] } ],
  "tags": string[],
  "categories": string[]
}
Rules:
- ONLY raw JSON, no prose.
- No duplicate headings/subheadings.
- Avoid generic Intro/Conclusion unless uniquely valuable.
- Provide broad keyword coverage.
- If conflict: prefer minimal valid JSON.`;

export function buildOutlinePrompt(opts: {
  topic: string;
  keywords: string[];
  wordCountRange: [number, number];
  existingTags: string[];
  existingCategories: string[];
  lang: string;
  requiredHeadings?: string[];
  requiredSubheadings?: string[];
}): string {
  const {
    topic,
    keywords,
    wordCountRange,
    existingTags,
    existingCategories,
    lang,
    requiredHeadings,
    requiredSubheadings
  } = opts;
  const [minWords, maxWords] = wordCountRange;
  const reqLines: string[] = [];
  if (requiredHeadings && requiredHeadings.length) {
    reqLines.push(`Ensure these outline headings exist (add if missing): ${requiredHeadings.join(' | ')}`);
  }
  if (requiredSubheadings && requiredSubheadings.length) {
    reqLines.push(
      `Ensure these subheadings appear (attach logically; no duplicates): ${requiredSubheadings.join(' | ')}`
    );
  }
  return [
    `You are an expert SEO & technical content strategist. Produce ONLY a valid JSON outline in ${lang}.`,
    `Primary topic: ${topic}`,
    `Keyword list: ${keywords.join(', ') || '(none)'}`,
    `Target total word range: ${minWords}-${maxWords}.`,
    `Existing tags: ${existingTags.join(', ') || '(none)'}`,
    `Existing categories: ${existingCategories.join(', ') || '(none)'}`,
    ...(reqLines.length ? reqLines : []),
    OUTLINE_SCHEMA_INSTRUCTIONS,
    'Return ONLY the JSON object.'
  ].join('\n\n');
}

export function buildSectionPrompt(opts: {
  topic: string;
  keywords: string[];
  styleNotes?: string;
  section: OutlineItem;
  subheading: string;
  lang: string;
  requiredCoveragePhrases?: string[];
  pendingRequiredMentions?: Array<{ text: string; minMentions: number }>;
}): string {
  const {
    topic,
    keywords,
    styleNotes,
    section,
    subheading,
    lang,
    requiredCoveragePhrases,
    pendingRequiredMentions
  } = opts;
  const coverageHints: string[] = [];
  if (requiredCoveragePhrases && requiredCoveragePhrases.length) {
    coverageHints.push(
      `Global required coverage phrases (weave naturally when relevant): ${requiredCoveragePhrases.join(' | ')}`
    );
  }
  if (pendingRequiredMentions && pendingRequiredMentions.length) {
    coverageHints.push(
      `Still missing (mention at least required times if contextually relevant): ${pendingRequiredMentions
        .map((m) => `${m.text}${m.minMentions > 1 ? `(x${m.minMentions})` : ''}`)
        .join(' | ')}`
    );
  }
  return [
    `Write the body for subsection: "${subheading}" (parent: "${section.heading}") in ${lang}.`,
    `Global topic: ${topic}`,
    `Sibling subheadings: ${section.subheadings.filter((h) => h !== subheading).join(' | ') || '(none)'}`,
    `Keywords (natural use): ${keywords.join(', ') || '(none)'}`,
    `Style: ${styleNotes || 'authoritative, practical, neutral, SEO-aware'}`,
    ...(coverageHints.length ? coverageHints : []),
    'Constraints:',
    '- Markdown ONLY (no starting heading).',
    '- 140-260 words; 2-6 paragraphs.',
    '- Exactly one [image]alt text[/image] placeholder.',
    '- Use **bold** sparingly.',
    '- No restating heading/subheading.',
    '- No filler closings.',
    '- Do NOT over-repeat global required phrases once minimum satisfied.'
  ].join('\n');
}

export function buildSummaryPrompt(sectionText: string, lang: string): string {
  return [
    `Summarize the following section in ${lang} as 3-5 tight Markdown bullets.`,
    'Each bullet <= 22 words, no repetition.',
    'No intro/conclusion line.',
    'Source section:',
    sectionText
  ].join('\n');
}
