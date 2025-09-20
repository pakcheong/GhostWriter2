import assert from 'assert';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';
import { generateArticle } from '../src/article/generate-article.js';

// Custom mock to control body repetition for coverage counting
import { __setGenerateTextImpl } from '../src/article/generate-article.js';

installGhostwriterMocks({ providerFetch: true });

// Override article generation mock to simulate required content usage patterns
const usage = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };
const OUTLINE_JSON = JSON.stringify({
  title: 'Coverage Title',
  description: 'Coverage Desc',
  slug: 'coverage-title',
  tags: ['coverage'],
  categories: ['test'],
  outline: [{ heading: 'Req Section', subheadings: ['Alpha', 'Beta'] }]
});

let subsectionCall = 0;
__setGenerateTextImpl(async (req: any) => {
  const content: string = req.prompt || (req.messages || []).map((m: any) => m.content).join('\n');
  if (/STRICT JSON/.test(content)) {
    return { text: OUTLINE_JSON, usage };
  }
  if (/Alpha/.test(content) || /Beta/.test(content)) {
    subsectionCall++;
    // We intentionally repeat key phrases differently per subsection to test counting & overuse heuristic
    if (subsectionCall === 1) {
      return {
        text: 'Alpha body with termX termX termX and Islamic finance plus ringgit. [image]x[/image]',
        usage
      };
    }
    return {
      text: 'Beta body mentioning Islamic finance many times: Islamic finance Islamic finance Islamic finance ringgit ringgit. [image]y[/image]',
      usage
    };
  }
  if (/Summarize/.test(content)) {
    return { text: 'Summary bullets', usage };
  }
  return { text: 'Fallback [image]z[/image]', usage };
});

try {
  let payload: any;
  const { article: _article } = await generateArticle({
    topic: 'Coverage Topic',
    keywords: ['finance'],
    model: 'gpt-4o-mini',
    exportModes: [],
    writeFiles: false,
    requiredContent: [
      { text: 'Islamic finance', intent: 'mention', minMentions: 2, maxMentions: 5 },
      { text: 'ringgit', intent: 'mention', minMentions: 1 }
    ],
    strictRequired: true,
    onArticle: (p) => {
      payload = p;
    }
  });
  assert.ok(payload, 'callback payload present');
  const rc = payload.output.runtime.strategy.requiredCoverage;
  assert.ok(rc, 'requiredCoverage present');
  const items: any[] = rc.items;
  const islamic = items.find((i) => i.text === 'Islamic finance');
  const ringgit = items.find((i) => i.text === 'ringgit');
  assert.ok(islamic, 'Islamic finance item exists');
  assert.ok(ringgit, 'ringgit item exists');
  assert.ok(islamic.foundMentions >= 2, 'Islamic finance minMentions met');
  assert.ok(ringgit.foundMentions >= 1, 'ringgit min met');
  assert.strictEqual(islamic.requiredMentions, 2, 'Islamic requiredMentions=2');
  assert.strictEqual(islamic.minMentions, 2, 'Islamic minMentions echo');
  assert.ok(islamic.densityPerK >= 0, 'density computed');
  // Overuse heuristic may or may not trigger; ensure fields exist and strictFailed only if violations
  assert.ok('fulfilled' in islamic, 'fulfilled field');
  assert.ok('overused' in islamic, 'overused flag present');
  if (rc.strictFailed) {
    // If strictFailed set there must be missing or overused items
    assert.ok(
      (rc.missing && rc.missing.length > 0) || (rc.overused && rc.overused.length > 0),
      'strictFailed implies missing or overused'
    );
  }
  console.log('coverage-required-content.test.ts passed');
} finally {
  resetGhostwriterMocks();
}
