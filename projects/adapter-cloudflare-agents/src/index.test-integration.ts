// @vitest-environment node
import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { createCore } from '@moldea.ai/core';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { parseDocumentationExample } from '../../../configs/package-documentation/example/index.js';
import { verifyPackedDocumentation } from '../../../configs/package-documentation/index.js';

import * as publicApi from './index.js';

const projectDirectory = path.resolve(import.meta.dirname, '..');
const publicApiFixtureDirectory = path.join(projectDirectory, 'src', 'index.test-fixtures');
const typescriptEntrypoint = path.join(
  projectDirectory,
  'node_modules',
  'typescript',
  'bin',
  'tsc',
);

interface IPackDryRunResult {
  readonly files: readonly { readonly path: string }[];
  readonly name: string;
  readonly version: string;
}

/** Executes native or JavaScript package-manager entrypoints without a platform shell. */
const runPackageManager = (
  packageManagerEntrypoint: string,
  commandArguments: readonly string[],
  options: ExecFileSyncOptionsWithStringEncoding,
): string => {
  const isJavaScriptEntrypoint = /\.(?:c|m)?js$/u.test(packageManagerEntrypoint);

  return execFileSync(
    isJavaScriptEntrypoint ? process.execPath : packageManagerEntrypoint,
    isJavaScriptEntrypoint ? [packageManagerEntrypoint, ...commandArguments] : commandArguments,
    options,
  );
};

describe('@moldea.ai/adapter-cloudflare-agents public API', () => {
  test('exposes only the intended runtime symbol', () => {
    expect(Object.keys(publicApi)).toStrictEqual(['cloudflareAgentsAdapter']);
  });

  test('emits consumable public artifacts without private imports or test files', () => {
    const declaration = readFileSync(new URL('../dist/index.d.ts', import.meta.url), 'utf8');
    const runtime = readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8');

    expect(declaration).toContain('cloudflareAgentsAdapter');
    expect(declaration).not.toContain('CLOUDFLARE_AGENTS_ADAPTER_DIAGNOSTICS');
    expect(declaration).not.toContain('@moldea.ai/adapter-static-analysis');
    expect(declaration).not.toContain('.test-');
    expect(runtime).not.toContain('@moldea.ai/adapter-static-analysis');
    execFileSync(
      process.execPath,
      [typescriptEntrypoint, '--project', path.join(publicApiFixtureDirectory, 'tsconfig.json')],
      { cwd: projectDirectory, stdio: 'pipe' },
    );
  });

  test('packs only intended files and compatible runtime dependency composition', () => {
    const packageManagerEntrypoint = process.env['npm_execpath'];

    if (packageManagerEntrypoint === undefined) {
      throw new Error('The package-manager entrypoint is unavailable.');
    }

    const output = runPackageManager(packageManagerEntrypoint, ['pack', '--dry-run', '--json'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    const packResult = JSON.parse(output) as IPackDryRunResult;
    verifyPackedDocumentation(
      projectDirectory,
      packResult.files.map((file) => file.path),
    );
    const manifest = JSON.parse(
      readFileSync(path.join(projectDirectory, 'package.json'), 'utf8'),
    ) as {
      readonly dependencies?: Readonly<Record<string, string>>;
    };

    expect(packResult).toMatchObject({
      name: '@moldea.ai/adapter-cloudflare-agents',
      version: '3.0.2',
    });
    expect(packResult.files.map(({ path: filePath }) => filePath)).toEqual(
      expect.arrayContaining([
        'LICENSE',
        'README.md',
        'cover.png',
        'dist/index.d.ts',
        'dist/index.js',
      ]),
    );
    expect(manifest.dependencies).toStrictEqual({
      '@moldea.ai/core': 'workspace:^4.0.0',
      '@moldea.ai/repository': 'workspace:^2.0.0',
      semver: '7.8.5',
      typescript: '6.0.3',
    });
  });
});

describe('published binding example', () => {
  const files = parseDocumentationExample(
    readFileSync(new URL('../docs/binding-example.md', import.meta.url), 'utf8'),
  );

  test('establishes every documented relationship through the real adapter', async () => {
    const result = await createCore({
      adapters: [publicApi.cloudflareAgentsAdapter],
    }).validateProject({
      repository: createMemoryRepositoryReader(files),
    });
    expect(result.diagnostics).toStrictEqual([]);
    expect(result.valid).toBe(true);
    for (const { path: sourcePath, symbol, ...identity } of [
      {
        agentId: 'support',
        kind: 'agent-definition',
        path: '/src/agents.ts',
        symbol: 'SupportAgent',
      },
      {
        agentId: 'support',
        kind: 'instruction-loader',
        path: '/src/instructions.ts',
        symbol: 'loadSupportInstruction',
      },
      {
        agentId: 'support',
        kind: 'tool-registration',
        capabilityId: 'find-order',
        path: '/src/tools.ts',
        symbol: 'findOrderTool',
      },
      {
        agentId: 'support',
        kind: 'schema',
        capabilityId: 'find-order',
        path: '/src/contracts.ts',
        symbol: 'FindOrderInputSchema',
      },
      {
        agentId: 'support',
        kind: 'schema',
        capabilityId: 'find-order',
        path: '/src/contracts.ts',
        symbol: 'FindOrderOutputSchema',
      },
      {
        agentId: 'summary',
        kind: 'agent-definition',
        path: '/src/agents.ts',
        symbol: 'SummaryAgent',
      },
      {
        agentId: 'summary',
        kind: 'instruction-loader',
        path: '/src/instructions.ts',
        symbol: 'loadSummaryInstruction',
      },
      {
        agentId: 'summary',
        kind: 'schema',
        path: '/src/contracts.ts',
        symbol: 'SummaryOutputSchema',
      },
      {
        agentId: 'summary',
        kind: 'tool-registration',
        capabilityId: 'find-order',
        path: '/src/tools.ts',
        symbol: 'findOrderTool',
      },
      {
        agentId: 'summary',
        kind: 'schema',
        capabilityId: 'find-order',
        path: '/src/contracts.ts',
        symbol: 'FindOrderInputSchema',
      },
      {
        agentId: 'summary',
        kind: 'schema',
        capabilityId: 'find-order',
        path: '/src/contracts.ts',
        symbol: 'FindOrderOutputSchema',
      },
    ]) {
      const match = result.evidence.find(
        (entry) =>
          entry.source === 'cloudflare-agents' &&
          entry.agentId === identity.agentId &&
          entry.kind === identity.kind &&
          (!('capabilityId' in identity) || entry.capabilityId === identity.capabilityId) &&
          entry.references.some(
            (reference) =>
              reference.path === sourcePath &&
              (symbol === undefined || reference.symbol === symbol),
          ),
      );
      expect(match, JSON.stringify({ ...identity, sourcePath, symbol })).toBeDefined();
    }
    expect(
      result.evidence.find(
        (entry) => entry.kind === 'handoff-registration' && entry.source === 'cloudflare-agents',
      ),
    ).toMatchObject({ details: { targetAgentId: 'summary' } });
  });

  test('rejects routing text that differs from the canonical handoff description', async () => {
    const changed = files.map((file) =>
      file.path === '/moldea/agents/summary/handoff-description.md'
        ? { ...file, content: 'Route a different class of requests here.\n' }
        : file,
    );
    const result = await createCore({
      adapters: [publicApi.cloudflareAgentsAdapter],
    }).validateProject({
      repository: createMemoryRepositoryReader(changed),
    });
    expect(result.valid).toBe(false);
    expect(
      result.diagnostics.some(
        (entry) =>
          entry.source === 'cloudflare-agents' &&
          entry.code.includes('ROUTING_DESCRIPTION_NOT_WIRED'),
      ),
    ).toBe(true);
  });

  test('does not establish runtime evidence for a misspelled binding', async () => {
    const changed = files.map((file) =>
      file.path === '/moldea/moldea.yaml'
        ? {
            ...file,
            content: file.content.replace(
              /symbol: ['"]?[A-Za-z0-9_-]+['"]?/u,
              'symbol: missingExampleAgent',
            ),
          }
        : file,
    );
    const result = await createCore({
      adapters: [publicApi.cloudflareAgentsAdapter],
    }).validateProject({
      repository: createMemoryRepositoryReader(changed),
    });
    expect(changed[0]?.content).toContain('symbol: missingExampleAgent');
    expect(
      result.evidence.filter(
        (entry) =>
          entry.agentId === 'support' &&
          (entry.kind === 'agent-definition' || entry.kind === 'runtime-pattern'),
      ),
    ).toStrictEqual([]);
  });
});
