import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isProcessRunning, runProcess } from 'jg-process';
import type * as JgProcess from 'jg-process';
import { expect, test, vi } from 'vitest';

import { parseTestSuiteArguments, runTestSuite } from '#test-suite/index';

const cli = fileURLToPath(new URL('./test-suite.cli.ts', import.meta.url));

const createFixture = async (environment: NodeJS.ProcessEnv = process.env) => {
  const root = await mkdtemp(join(tmpdir(), 'moldea-suite-'));
  const entry = join(root, 'pnpm.cjs');
  const record = join(root, 'commands.jsonl');
  try {
    await writeFile(
      entry,
      `const fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(process.env.MOLDEA_SUITE_RECORD,JSON.stringify({args,suite:process.env.MOLDEA_TEST_SUITE})+'\\n');if(process.env.MOLDEA_SUITE_FAIL && args.includes(process.env.MOLDEA_SUITE_FAIL))process.exitCode=7;`,
    );
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
  return {
    root,
    entry,
    record,
    env: {
      // remove case variants before overriding the package-manager entry on Windows
      ...Object.fromEntries(
        Object.entries(environment).filter(([name]) => name.toLowerCase() !== 'npm_execpath'),
      ),
      npm_execpath: entry,
      MOLDEA_SUITE_RECORD: record,
      MOLDEA_TEST_SUITE: 'invalid-parent',
    },
  };
};

test('package-manager discovery retains native environment lookup', async () => {
  const fixture = await createFixture();
  try {
    vi.stubEnv('npm_execpath', fixture.entry);
    vi.stubEnv('MOLDEA_SUITE_RECORD', fixture.record);
    vi.resetModules();
    vi.doMock('jg-process', async (importOriginal) => {
      const actual = await importOriginal<typeof JgProcess>();
      return {
        ...actual,
        resolvePackageManagerCommand: (
          ...args: Parameters<typeof actual.resolvePackageManagerCommand>
        ) => {
          const usesNativeEnvironment = args[1]?.env === undefined || args[1].env === process.env;
          expect(
            usesNativeEnvironment,
            'package-manager lookup must preserve native environment key semantics',
          ).toBe(true);
          return actual.resolvePackageManagerCommand(...args);
        },
      };
    });
    const boundary = await import('#test-suite');
    expect(await boundary.runTestSuite(parseTestSuiteArguments(['essential', 'unit']))).toBe(0);
  } finally {
    vi.doUnmock('jg-process');
    vi.resetModules();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('a cleanup failure rejects a successful child and stops later stages', async () => {
  const fixture = await createFixture();
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  try {
    vi.stubEnv('npm_execpath', fixture.entry);
    vi.stubEnv('MOLDEA_SUITE_RECORD', fixture.record);
    vi.resetModules();
    vi.doMock('jg-process', async (importOriginal) => {
      const actual = await importOriginal<typeof JgProcess>();
      return {
        ...actual,
        stopProcessTree: async (...args: Parameters<typeof actual.stopProcessTree>) => {
          await actual.stopProcessTree(...args);
          throw new Error('fixture cleanup failed');
        },
      };
    });
    const boundary = await import('#test-suite');
    await expect(boundary.runTestSuite(parseTestSuiteArguments(['essential']))).rejects.toThrow(
      'fixture cleanup failed',
    );
    expect((await readFile(fixture.record, 'utf8')).trim().split('\n')).toHaveLength(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('root PID'));
  } finally {
    vi.doUnmock('jg-process');
    vi.resetModules();
    stderr.mockRestore();
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test.each(['essential', 'full'])(
  'real root %s forces child mode and selects setup/categories',
  async (suite) => {
    const fixture = await createFixture({ ...process.env, NPM_EXECPATH: 'inherited-entry' });
    try {
      expect(
        Object.keys(fixture.env).filter((name) => name.toLowerCase() === 'npm_execpath'),
      ).toStrictEqual(['npm_execpath']);
      const result = await runProcess({
        command: process.execPath,
        args: [cli, suite],
        env: fixture.env,
        timeoutSeconds: 30,
      });
      expect(result.exitCode).toBe(0);
      const records = (await readFile(fixture.record, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { args: string[]; suite: string });
      expect(records).toHaveLength(6);
      expect(records.every((record) => record.suite === suite)).toBe(true);
      expect(records.map((record) => record.args.join(' '))).toStrictEqual(
        suite === 'essential'
          ? [
              'exec turbo run build --filter=@moldea.ai/cli...',
              'run test:root:unit',
              'exec turbo run test:unit --filter=!@moldea.ai/packages-website',
              'run test:root:integration',
              'exec turbo run test:integration --concurrency=1 --filter=!@moldea.ai/packages-website --filter=!@moldea.ai/website-ui',
              'exec turbo run test:e2e --concurrency=1 --filter=!@moldea.ai/packages-website',
            ]
          : [
              'run website:prepare',
              'run test:root:unit',
              'exec turbo run test:unit',
              'run test:root:integration',
              'exec turbo run test:integration --concurrency=1',
              'exec turbo run test:e2e --concurrency=1',
            ],
      );
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  },
);

test('real stage failure stops subsequent commands and optional stages stay isolated', async () => {
  const fixture = await createFixture();
  try {
    const result = await runProcess({
      command: process.execPath,
      args: [cli, 'essential', 'integration'],
      env: { ...fixture.env, MOLDEA_SUITE_FAIL: 'test:root:integration' },
      timeoutSeconds: 30,
    });
    expect(result.exitCode).toBe(7);
    const output = await readFile(fixture.record, 'utf8');
    expect(output).toContain('test:root:integration');
    expect(output).not.toContain('test:unit');
    expect(output).not.toContain('"test:integration"');
    expect(output).not.toContain('test:e2e');
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test('invalid root arguments fail without invoking package-manager preparation', async () => {
  const result = await runProcess({
    command: process.execPath,
    args: [cli, 'essential', 'invalid'],
    env: { ...process.env, npm_execpath: '/missing/pnpm.cjs' },
    timeoutSeconds: 30,
  });
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain('Expected essential or full');
  expect(result.stderr).not.toContain('package manager');
});

test('interruption fails, joins its owned child and never starts another stage', async () => {
  const fixture = await createFixture();
  const controller = new AbortController();
  let completion: Promise<number> | undefined;
  try {
    await writeFile(
      fixture.entry,
      `const fs=require('node:fs');fs.appendFileSync(process.env.MOLDEA_SUITE_RECORD,JSON.stringify({pid:process.pid,args:process.argv.slice(2)})+'\\n');setInterval(()=>{},1000);`,
    );
    for (const [name, value] of Object.entries(fixture.env)) vi.stubEnv(name, value);
    completion = runTestSuite(parseTestSuiteArguments(['essential']), controller.signal);
    await expect
      .poll(async () => {
        try {
          return await readFile(fixture.record, 'utf8');
        } catch {
          return '';
        }
      })
      .toContain('"pid":');
    controller.abort();
    expect(await completion).not.toBe(0);
    const records = (await readFile(fixture.record, 'utf8')).trim().split('\n');
    expect(records).toHaveLength(1);
    const record = JSON.parse(records[0]!) as { pid: number };
    expect(isProcessRunning(record.pid)).toBe(false);
  } finally {
    controller.abort();
    try {
      await completion;
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test('real Vitest selection omits full imports/tags and still rejects accidental empty discovery', async () => {
  const root = await mkdtemp(join(tmpdir(), 'moldea-selection-'));
  const vitestEntry = fileURLToPath(
    new URL('../../node_modules/vitest/vitest.mjs', import.meta.url),
  );
  const vitestModule = new URL('../../node_modules/vitest/dist/index.js', import.meta.url).href;
  const configModule = new URL('../../configs/vitest/test.config.ts', import.meta.url).href;
  const config = join(root, 'vitest.config.ts');
  try {
    await writeFile(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
    await writeFile(
      config,
      `import {createTestConfig} from ${JSON.stringify(configModule)};export default createTestConfig({suite:'unit',include:['*.test-unit.ts'],fullOnlyFiles:['**/secondary.test-unit.ts']});`,
    );
    await writeFile(
      join(root, 'rules.test-unit.ts'),
      `import {test,expect} from ${JSON.stringify(vitestModule)};test('essential',()=>expect(1).toBe(1));test('secondary',{tags:['full']},()=>expect(2).toBe(2));`,
    );
    await writeFile(
      join(root, 'secondary.test-unit.ts'),
      `import {test,expect} from ${JSON.stringify(vitestModule)};if(process.env.MOLDEA_TEST_SUITE==='essential')throw new Error('Full file imported during essential');test('whole file',()=>expect(3).toBe(3));`,
    );
    for (const suite of ['essential', 'full', undefined]) {
      const env = { ...process.env };
      if (suite === undefined) delete env['MOLDEA_TEST_SUITE'];
      else env['MOLDEA_TEST_SUITE'] = suite;
      const result = await runProcess({
        command: process.execPath,
        args: [vitestEntry, 'run', '--root', root, '--config', config, '--reporter=json'],
        env,
        timeoutSeconds: 30,
      });
      expect(result.exitCode, result.stderr).toBe(0);
      const report = JSON.parse(result.stdout) as { numPassedTests: number };
      expect(report.numPassedTests).toBe(suite === 'essential' ? 1 : 3);
    }
    await writeFile(
      config,
      `import {createTestConfig} from ${JSON.stringify(configModule)};export default createTestConfig({suite:'unit',include:['missing/*.test-unit.ts']});`,
    );
    const empty = await runProcess({
      command: process.execPath,
      args: [vitestEntry, 'run', '--root', root, '--config', config],
      env: { ...process.env, MOLDEA_TEST_SUITE: 'essential' },
      timeoutSeconds: 30,
    });
    expect(empty.exitCode).not.toBe(0);
    expect(empty.stderr).toContain('No test files found');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
