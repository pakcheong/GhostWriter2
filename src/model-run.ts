import { generateText as realGenerateText } from 'ai';

// A lightweight wrapper so we can mock model responses when MOCK_AI=1 (no API calls).
// We only depend on the parts of the request we actually use.

function hash(input: string): number {
  let h = 0; let i = 0; const len = input.length;
  while (i < len) h = ((h << 5) - h + input.charCodeAt(i++)) | 0;
  return Math.abs(h);
}

export async function generateTextWrapped(req: any): Promise<any> {
  if (process.env.MOCK_AI === '1') {
    // Build deterministic pseudo content based on prompt/messages hash.
    const base = 'mocked-output';
  const source = 'prompt' in req ? req.prompt : (req.messages?.map((m: any) => m.content).join('\n') || '');
    const h = hash(source).toString(36).slice(0, 6);
    const text = (() => {
      if (source.includes('SEO blog planner')) {
        return JSON.stringify({
          title: 'Mock Title',
          description: 'Mock description for testing.',
          slug: 'mock-title',
          tags: ['test','mock'],
          categories: ['testing'],
          outline: [
            { heading: 'Introduction', subheadings: ['Background','Goal'] },
            { heading: 'Details', subheadings: ['Part A','Part B'] }
          ]
        });
      }
      if (source.includes('Summarize')) {
        return 'A short mock summary.';
      }
      // Section content
      return `## Section Heading\n\n### Sub Heading\n\n${base}-${h} content with **keywords**.\n\n[image]an image description[/image]`;
    })();

    return {
      text,
      usage: { promptTokens: 10, completionTokens: 25, totalTokens: 35 },
    };
  }
  return realGenerateText(req);
}
