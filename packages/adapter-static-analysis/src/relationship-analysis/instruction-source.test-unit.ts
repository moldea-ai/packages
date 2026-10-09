// @vitest-environment node
import { expect, test } from 'vitest';

import { analyzeTypeScriptModule } from '../typescript-analysis/index.js';
import { classifyInstructionSource } from './instruction-source.js';

const config = {
  namedConstructorImports: [],
  packageName: 'provider',
  supportsDefaultConstructorImport: false,
};

const classify = async (source: string, additional: Record<string, string> = {}) => {
  const modules = { '/src/instructions.ts': source, ...additional };
  const analyzeSource = (path: string) =>
    Promise.resolve(
      analyzeTypeScriptModule(
        path,
        new TextEncoder().encode(modules[path as keyof typeof modules] ?? ''),
        config,
      ),
    );
  const result = await analyzeSource('/src/instructions.ts');
  if (result.kind !== 'valid') throw new TypeError('The instruction fixture must be valid.');
  return classifyInstructionSource({
    analysis: result.analysis,
    symbol: 'load',
    canonicalPaths: ['/moldea/agent/instructions.md', '/src/prompt.md'],
    canonicalContent: '# Canonical instructions',
    analyzeSource,
    getEntry: (path) => Promise.resolve(Object.hasOwn(modules, path) ? { type: 'file' } : null),
  });
};

test.each([
  [
    "import { readFileSync } from 'node:fs'; const relative = '../moldea/agent/instructions.md'; export const load = () => readFileSync(new URL(relative, import.meta.url), 'utf8');",
  ],
  [
    "import { readFileSync } from 'node:fs'; export const load = () => readFileSync(new URL('../moldea/agent/instructions.md', import.meta.url), 'utf8');",
  ],
  [
    "import { readFileSync as read } from 'fs'; const encoding = 'utf-8'; export const load = () => read(new URL('../moldea/agent/instructions.md', import.meta.url), { encoding });",
  ],
  [
    "import { readFile } from 'node:fs/promises'; export const load = async () => await readFile(new URL('../moldea/agent/instructions.md', import.meta.url), 'utf8');",
  ],
  [
    "import { readFileSync } from 'node:fs'; const read = readFileSync; export const load = () => { const path = new URL('../moldea/agent/instructions.md', import.meta.url); const instructions = read(path, 'utf8'); return instructions; };",
  ],
  [
    "import { readFileSync } from 'node:fs'; const canonical = () => readFileSync(new URL('../moldea/agent/instructions.md', import.meta.url), 'utf8'); export const load = () => canonical();",
  ],
])('proves a supported canonical read (%s)', async (source) => {
  expect(await classify(source)).toStrictEqual({
    kind: 'verified',
    path: '/moldea/agent/instructions.md',
  });
});

test.each([
  ["export const load = () => '# Canonical instructions';", 'unverified'],
  ["export const load = () => 'different instructions';", 'mismatch'],
  [
    "import { readFileSync } from 'node:fs'; export const load = () => readFileSync(new URL('./wrong.md', import.meta.url), 'utf8');",
    'mismatch',
  ],
  [
    "import { readFileSync } from 'node:fs'; export const load = (readFileSync: unknown) => readFileSync(new URL('../moldea/agent/instructions.md', import.meta.url), 'utf8');",
    'unverified',
  ],
  [
    "import { readFileSync } from 'node:fs'; export const load = () => readFileSync(new URL('../moldea/agent/instructions.md', import.meta.url));",
    'unverified',
  ],
  ['const cycle = () => load(); export const load = () => cycle();', 'unverified'],
  ["export * from './other.js';", 'unverified'],
])('classifies unsupported or contradictory provenance (%s) -> %s', async (source, expected) => {
  expect(await classify(source)).toStrictEqual({ kind: expected });
});

test('accepts a validated mirror and follows a simple imported return wrapper', async () => {
  expect(
    await classify("import { mirror } from './mirror.js'; export const load = () => mirror();", {
      '/src/mirror.ts':
        "import { readFileSync } from 'node:fs'; export const mirror = () => readFileSync(new URL('./prompt.md', import.meta.url), 'utf8');",
    }),
  ).toStrictEqual({ kind: 'verified', path: '/src/prompt.md' });
});

test('terminates imported cycles even if callbacks reparse each source', async () => {
  expect(
    await classify("import { other } from './other.js'; export const load = () => other();", {
      '/src/other.ts':
        "import { load } from './instructions.js'; export const other = () => load();",
    }),
  ).toStrictEqual({ kind: 'unverified' });
});

test.each([
  "import { readFileSync } from 'node:fs'; readFileSync = replacement; export const load = () => readFileSync(new URL('../moldea/agent/instructions.md', import.meta.url), 'utf8');",
  "import { readFileSync } from 'node:fs'; import URL from 'custom-url'; export const load = () => readFileSync(new URL('../moldea/agent/instructions.md', import.meta.url), 'utf8');",
  "import { readFileSync } from 'node:fs'; export const load = () => readFileSync(new URL('../moldea/agent/instructions.md', import.meta.url), 'utf8'); load = replacement;",
])('does not retain a replaced callable or constructor (%s)', async (source) => {
  expect(await classify(source)).toStrictEqual({ kind: 'unverified' });
});
