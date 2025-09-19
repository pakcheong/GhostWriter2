// Recreated prompts.ts
// Provides prompt builder functions used by generate-article.ts
// Keep prompts deterministic and JSON-parseable for outline.

import type { OutlineItem } from './types.js';

// Helper to build a stable JSON schema instruction block with stricter validation & fallback.
const OUTLINE_SCHEMA_INSTRUCTIONS = `Return STRICT JSON matching this TypeScript interface:
{
  "title": string,            // <= 90 chars, compelling, includes 1 core keyword (no quotes)
  "description": string,      // <= 160 chars, single sentence, no markdown
  "slug": string,             // kebab-case from title, ASCII, lower, hyphen separated, no stopwords duplication
  "outline": [                // 5-8 main sections; skip redundant 'Introduction'/'Conclusion' unless meaningful
    { "heading": string, "subheadings": string[] } // heading <= 65 chars; 2-5 subheadings each, each <= 70 chars
  ],
  "tags": string[],           // lowercase, <= 10, semantic, no duplicates
  "categories": string[]      // lowercase, reuse existing when relevant; at most 1 novel addition
}
Forbidden main section headings (unless absolutely unavoidable & uniquely valuable): ["Introduction", "Conclusion", "Summary", "Final Thoughts", "FAQs"]. Use more specific phrasing instead.
Rules:
- Output ONLY raw JSON (no code fences, no prose before/after).
- Escape quotes properly; no trailing commas.
- No comments inside JSON.
- No duplicate (case-insensitive) headings or subheadings.
- Avoid numbered prefixes (e.g., '1.', 'I.', '(1)').
- Provide at least 70% coverage of the provided keyword list across all headings & subheadings.
- If uncertain about a field, still output a syntactically valid placeholder ("" or []).
FAILSAFE: If any rule conflicts, favor valid minimal JSON over completeness.`;

export function buildOutlinePrompt(opts: {
  topic: string;
  keywords: string[];
  wordCountRange: [number, number];
  existingTags: string[];
  existingCategories: string[];
  lang: string;
}): string {
  const { topic, keywords, wordCountRange, existingTags, existingCategories, lang } = opts;
  const [minWords, maxWords] = wordCountRange;
  return [
    `You are an expert SEO & technical content strategist. Produce ONLY a valid JSON outline in ${lang}.`,
    `Primary topic: ${topic}`,
    `Keyword list (ensure broad coverage across headings/subheadings): ${keywords.join(', ') || '(none)'}`,
    `Target total word range: ${minWords}-${maxWords}.`,
    `Existing tags to prefer (case-insensitive match): ${existingTags.join(', ') || '(none)'}`,
    `Existing categories to prefer: ${existingCategories.join(', ') || '(none)'}`,
    OUTLINE_SCHEMA_INSTRUCTIONS,
    'Additional quality guidance:',
    '- Optimize for search intent & logical reading flow.',
    '- Mix conceptual + practical sections (where relevant).',
    '- Each main section should advance depth, not rephrase previous ones.',
    '- Subheadings should not merely restate the heading; they should partition scope.',
    '- Prefer precise nouns & action verbs; avoid vague marketing language.',
    'Return ONLY the JSON object (no explanation).'
  ].join('\n\n');
}

export function buildSectionPrompt(opts: {
  topic: string;
  keywords: string[];
  styleNotes?: string;
  section: OutlineItem;
  subheading: string;
  lang: string;
}): string {
  const { topic, keywords, styleNotes, section, subheading, lang } = opts;
  // Define soft length guidance: adapt to complexity but remain concise.
  return [
    `Write the body for subsection: "${subheading}" (parent: "${section.heading}") in ${lang}.`,
    `Global topic: ${topic}`,
    `Sibling subheadings (avoid overlap): ${section.subheadings.filter(h => h !== subheading).join(' | ') || '(none)'}`,
    `Keywords to incorporate naturally (do not stuff): ${keywords.join(', ') || '(none)'}`,
    `Style / Tone: ${styleNotes || 'authoritative, practical, neutral, SEO-aware'}`,
    'Output constraints:',
    '- Markdown ONLY; no starting heading lines (H2/H3 inserted outside).',
    '- Length target: roughly 140-260 words (expand slightly if adding concrete examples improves clarity).',
    '- Paragraphs: 2-6; keep them tight (<= 110 words each).',
    '- Use a bullet list only if it clarifies steps, comparisons, or key takeaways (max 1 list).',
    '- Insert exactly one illustrative placeholder image tag: [image]short descriptive alt text[/image] placed where contextually helpful (not as first or last line).',
    '- Use **bold** sparingly (<= 4 uses) for key terms or contrasts.',
    '- Avoid repeating parent heading or restating subheading verbatim.',
    '- No generic filler phrases (e.g., "In conclusion", "In this section", "Overall").',
    '- No hallucinated statistics; if a metric would help but is unknown, describe the factor qualitatively.',
    '- Prefer concrete examples or concise analogies where it aids understanding.',
    '- Do NOT include a summary or concluding line; end on substantive content.',
    'Quality guards:',
    '- Maintain factual precision; do not speculate beyond widely accepted knowledge.',
    '- If describing a process, keep chronological order and avoid redundancy.',
    '- Ensure keyword usage feels organic; synonyms are allowed.'
  ].join('\n');
}

export function buildSummaryPrompt(sectionText: string, lang: string): string {
  return [
    `Summarize the following section in ${lang} as 3-5 tight Markdown bullets.`,
    'Each bullet:',
    '- Starts with a verb or concrete noun phrase (no leading dash besides list marker).',
    '- Contains <= 22 words.',
    '- No repetition across bullets.',
    '- No marketing fluff or vague filler.',
    'Do NOT add an intro or conclusion line. Output ONLY the bullet list.',
    'Source section:',
    sectionText,
  ].join('\n');
}
