// consumer.ts
import { generateArticle } from './dist/index.js'; // or '.' after build

const { article, files } = await generateArticle({
  provider: 'openai',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  topic: 'React 19: What Changes for Production Apps',
  keywords: ['react 19', 'transitions', 'actions', 'server components'],
  minWords: 1200,
  maxWords: 1800,
  existingTags: ['react', 'frontend', 'release'],
  existingCategories: ['technology', 'web'],
  styleNotes: 'actionable, authoritative, developer-friendly',
  lang: 'en',
  contextStrategy: 'summary',

  // choose what to export
  exportModes: ['json', 'html', 'md'],

  // custom output path here:
  outputDir: './output', // e.g. './my-output'

  // do write files:
  writeFiles: true,

  // silence logs from the library (no previews / tables)
  verbose: true,
});

console.log('Generated:', article.title);
console.log('Saved files:', files);
