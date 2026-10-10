// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse, stringify } from 'yaml';
import { expect, test } from 'vitest';

import { OFFICIAL_RUNTIME_ADAPTER_PACKAGES, parseRuntimeCompatibilityMatrix } from './index.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const excluded = new Set(['_archive', '_archives', '_backup', '_backups']);

test('real compatibility entry point validates canonical composition and rejects matrix drift', async () => {
  // Keep the fixture below the repository so real package imports resolve installed build dependencies.
  const fixture = join(root, `.ci-compat-${randomUUID()}`);
  await mkdir(fixture);
  try {
    await cp(
      join(root, 'scripts/runtime-compatibility'),
      join(fixture, 'scripts/runtime-compatibility'),
      { recursive: true, filter: (path) => !excluded.has(basename(path)) },
    );
    const paths = [
      'compatibility/runtimes.yaml',
      'docs/runtime-compatibility.md',
      'projects/core/src/constants/index.ts',
      'projects/cli/src/core-composition/constants.ts',
      'projects/cli/src/composition/constants.ts',
      'projects/cli/package.json',
      ...new Set(
        [
          'core',
          'repository',
          'repository-fs',
          ...Object.values(OFFICIAL_RUNTIME_ADAPTER_PACKAGES).map((name) =>
            name.replace('@moldea.ai/', ''),
          ),
        ].map((name) => `projects/${name}/package.json`),
      ),
    ];
    for (const path of paths) {
      await mkdir(dirname(join(fixture, path)), { recursive: true });
      await cp(join(root, path), join(fixture, path));
    }
    // Resolve copied canonical composition imports to the real installed packages, without stubbing adapters.
    const fixtureCompositionUrl = pathToFileURL(
      join(fixture, 'projects/cli/src/core-composition/constants.ts'),
    ).href;
    const canonicalCompositionUrl = pathToFileURL(
      join(root, 'projects/cli/src/core-composition/constants.ts'),
    ).href;
    const resolverPath = join(fixture, 'resolver.mjs');
    await writeFile(
      resolverPath,
      `import { registerHooks } from 'node:module'; registerHooks({ resolve(specifier, context, nextResolve) { return nextResolve(specifier, context.parentURL === ${JSON.stringify(fixtureCompositionUrl)} && specifier.startsWith('@moldea.ai/') ? {...context, parentURL: ${JSON.stringify(canonicalCompositionUrl)}} : context); } });`,
    );
    const run = () =>
      spawnSync(
        process.execPath,
        [
          '--import',
          pathToFileURL(resolverPath).href,
          join(fixture, 'scripts/runtime-compatibility/check.ts'),
        ],
        {
          cwd: fixture,
          encoding: 'utf8',
        },
      );
    const baseline = run();
    expect(baseline.stderr).toBe('');
    expect(baseline.status).toBe(0);
    expect(baseline.stdout).toContain('Runtime compatibility sources are valid and synchronized.');
    const matrixPath = join(fixture, 'compatibility/runtimes.yaml');
    const matrix = parse(await readFile(matrixPath, 'utf8')) as {
      adapters: Record<string, { compatibleCoreRange: string }>;
    };
    const entry = matrix.adapters['openai'];
    if (entry === undefined) throw new Error('The canonical OpenAI entry is missing.');
    entry.compatibleCoreRange = '^999.0.0';
    const source = stringify(matrix);
    expect(parseRuntimeCompatibilityMatrix(source).valid).toBe(true);
    await writeFile(matrixPath, source);
    const mismatch = run();
    expect(mismatch.status).not.toBe(0);
    expect(mismatch.stderr).toContain(
      'The @moldea.ai/adapter-openai Core compatibility range is inconsistent.',
    );
    expect(mismatch.stderr).not.toMatch(/is stale|ENOENT/u);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
