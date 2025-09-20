// Simple test runner with static skip array (no env / CLI parsing)
import fs from 'fs';
import path from 'path';

const testsDirName = 'tests';
const testsDir = path.join(process.cwd(), testsDirName);

// Define files to skip here. Exact filenames only.
const SKIP_FILES: string[] = [
  // Add filenames to skip. Example:
  // 'pricing.test.ts',
  // 'prompts-structure.test.ts'
];

if (!fs.existsSync(testsDir)) {
  console.error(`Tests directory not found: ${testsDir}`);
  process.exit(1);
}

const filesAll = fs.readdirSync(testsDir).filter((f) => f.endsWith('.test.ts'));
const files = filesAll.filter((f) => !SKIP_FILES.includes(f));

console.log(
  `Discovered ${filesAll.length} test files. Skipping ${filesAll.length - files.length}. Running ${files.length}.`
);
if (SKIP_FILES.length) console.log('Skip list:', SKIP_FILES.join(', '));

let failed = 0;
const failedFiles: string[] = [];
for (const f of files) {
  try {
    await import(path.join(testsDir, f));
  } catch (err) {
    failed++;
    failedFiles.push(f);
    console.error('Test failed:', f, err);
  }
}
if (failed) {
  console.error(`${failed} test(s) failed in ${testsDirName}.`);
  console.error('Failed files:', failedFiles.join(', '));
  process.exit(1);
}
console.log(`All ${files.length} ${testsDirName} tests passed.`);
