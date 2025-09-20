import { generateArticle } from '../dist/index.js';
import { __setGenerateTextImpl } from '../dist/src/generate-article.js';

__setGenerateTextImpl(async (args: any) => {
  const prompt = args.prompt || JSON.stringify(args.messages);
  let text: string;
  if (prompt.includes('outline') || prompt.includes('{"topic"')) {
    text = JSON.stringify({
      title: 'Test Title',
      description: 'Desc',
      slug: 'test-title',
      tags: ['tag1'],
      categories: ['cat1'],
      outline: [
        { heading: 'Section A', subheadings: ['Sub A1', 'Sub A2'] },
        { heading: 'Section B', subheadings: ['Sub B1'] }
      ]
    });
  } else if (prompt.toLowerCase().includes('summar')) {
    text = 'Short summary.';
  } else {
    text = 'Content block with **bold** and [image]desc[/image].';
  }
  return { text, usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } };
});

let captured: any = null;
await generateArticle({
  model: 'gpt-4o-mini',
  topic: 'Test',
  keywords: ['k1'],
  minWords: 10,
  maxWords: 20,
  existingTags: ['tag1'],
  existingCategories: ['cat1'],
  styleNotes: 'test',
  lang: 'en',
  contextStrategy: 'summary',
  exportModes: [],
  writeFiles: false,
  verbose: false,
  onArticle: (a: any) => {
    captured = a;
  }
});

if (!captured) throw new Error('onArticle not invoked');
if (captured.provider) throw new Error('provider field should be removed');
if (!captured.timings) throw new Error('timings missing');
if (!Array.isArray(captured.sectionTimings) || captured.sectionTimings.length !== 2)
  throw new Error('sectionTimings mismatch');
if (captured.status !== 'success') throw new Error('status unexpected');
