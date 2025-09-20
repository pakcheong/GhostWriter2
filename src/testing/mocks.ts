import { __setGenerateTextImpl } from '../article/generate-article.js';
import { __setTopicsGenerateTextImpl } from '../topics/generate-topics.js';
import type { Usage } from '../utils.js';

/** Simple fixed usage stub for tests */
const usage: Usage = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };

type TextReq = { prompt?: string; messages?: { content: string }[] };

let installed = false;
let originalFetch: typeof fetch | undefined;
let fetchInstalled = false;

/**
 * Install deterministic mock generators for article & topics flows.
 * - Outline prompt detection -> returns strict JSON outline
 * - Section / subsection prompts -> returns trivial markdown content with placeholder
 * - Summary prompts -> short summary line
 * - Topics generation -> returns fixed JSON array of topic candidates
 */
export function installGhostwriterMocks(options: { topicsCount?: number; providerFetch?: boolean } = {}) {
  if (installed) return;
  const { topicsCount = 5, providerFetch = true } = options;
  // capture originals if needed later (not currently restoring specific impl)
  const articleMock = async (req: TextReq) => {
    const content = req.prompt || (req.messages || []).map((m) => m.content).join('\n');
    if (/STRICT JSON/i.test(content) || /outline/i.test(content)) {
      return {
        text: JSON.stringify({
          title: 'Mock Title',
          description: 'Mock Desc',
          slug: 'mock-title',
          tags: ['mock'],
          categories: ['test'],
          outline: [
            { heading: 'Intro', subheadings: ['Overview'] },
            { heading: 'Body', subheadings: ['Point A', 'Point B'] }
          ]
        }),
        usage
      };
    }
    if (/Summarize the section/i.test(content)) {
      return { text: 'Short summary.', usage };
    }
    // Subsection generation fallback
    return { text: 'Mock content **bold** [image]alt text[/image]', usage };
  };
  const topicsMock = async () => {
    const ideas = Array.from({ length: topicsCount }, (_, i) => ({
      title: `Mock Topic ${i + 1}`,
      rationale: 'Because mock',
      confidence: 0.9,
      riskFlags: [],
      sourceType: 'llm'
    }));
    return { text: JSON.stringify(ideas), usage };
  };
  (globalThis as any).__articleImpl = articleMock;
  (globalThis as any).__topicsImpl = topicsMock;
  __setGenerateTextImpl(articleMock as any);
  __setTopicsGenerateTextImpl(topicsMock as any);

  if (providerFetch) {
    originalFetch = globalThis.fetch;
    const usage = { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 };
    globalThis.fetch = (async (url: any, init?: any) => {
      const u = typeof url === 'string' ? url : String(url);
      if (/\/chat\/completions$/.test(u)) {
        // Simulate provider (deepseek / lmstudio) chat completion
        const body = init?.body ? safeJsonParse(init.body) : {};
        const messages: any[] = body?.messages || [];
  const first = messages[messages.length - 1]?.content || '';
        let content: string;
        if (/outline/i.test(first) || /title/i.test(first) || /STRICT JSON/i.test(first)) {
          content = JSON.stringify({
            title: 'Mock Title',
            description: 'Mock Desc',
            slug: 'mock-title',
            tags: ['mock'],
            categories: ['test'],
            outline: [
              { heading: 'Intro', subheadings: ['Overview'] },
              { heading: 'Body', subheadings: ['Point A', 'Point B'] }
            ]
          });
        } else if (/Summarize the section/i.test(first)) {
          content = 'Short summary.';
        } else {
          content = 'Mock content **bold** [image]alt text[/image]';
        }
        const resp = {
          choices: [{ message: { content } }],
          usage
        };
        return new Response(JSON.stringify(resp), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      // Disallow unexpected external calls to guarantee test isolation
      throw new Error(`Unexpected fetch in tests: ${u}`);
    }) as any;
    fetchInstalled = true;
  }
  installed = true;
}

/** Restore original internal generateText implementations */
export function resetGhostwriterMocks() {
  if (!installed) return;
  __setGenerateTextImpl(undefined as any);
  __setTopicsGenerateTextImpl(undefined as any);
  if (fetchInstalled && originalFetch) {
    globalThis.fetch = originalFetch;
    fetchInstalled = false;
  }
  installed = false;
}

function safeJsonParse(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}
