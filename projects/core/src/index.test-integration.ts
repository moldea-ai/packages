// @vitest-environment node
import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { describe, expect, test } from 'vitest';
import ts from 'typescript';

const projectDirectory = path.resolve(import.meta.dirname, '..');
const repositoryProjectDirectory = path.resolve(projectDirectory, '..', 'repository');
const distributionDirectory = path.join(projectDirectory, 'dist');
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

const readDistributionFiles = (extension: string): readonly string[] => {
  const pending = [distributionDirectory];
  const contents: string[] = [];
  const excluded = new Set(['_archive', '_archives', '_backup', '_backups']);
  while (pending.length > 0) {
    const directory = pending.pop()!;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && entry.name.endsWith(extension))
        contents.push(readFileSync(target, 'utf8'));
    }
  }
  return contents;
};

/** Follows actual emitted static and dynamic imports instead of excluding Node-named chunks. */
const readNeutralImportGraphs = (): string => {
  const pending = ['index.js', 'format.js', 'adapter.js'].map((name) =>
    path.join(distributionDirectory, name),
  );
  const visited = new Set<string>();
  const contents: string[] = [];
  while (pending.length > 0) {
    const target = pending.pop()!;
    if (visited.has(target)) continue;
    visited.add(target);
    const relative = path.relative(distributionDirectory, target);
    expect(
      path.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + path.sep),
    ).toBe(false);
    expect(
      relative
        .split(path.sep)
        .some((part) => ['_archive', '_archives', '_backup', '_backups'].includes(part)),
    ).toBe(false);
    const source = readFileSync(target, 'utf8');
    contents.push(source);
    const visit = (node: ts.Node): void => {
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? node.arguments[0]
            : undefined;
      if (
        specifier !== undefined &&
        ts.isStringLiteral(specifier) &&
        specifier.text.startsWith('.')
      )
        pending.push(path.resolve(path.dirname(target), specifier.text));
      ts.forEachChild(node, visit);
    };
    visit(ts.createSourceFile(target, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS));
  }
  return contents.join('\n');
};

/**
 * Packs one project and returns the single newly created tarball name.
 * @param packageDirectory The package project to pack.
 * @param packDirectory The isolated destination for generated tarballs.
 * @returns The generated tarball basename.
 * @throws
 * - If the package-manager entrypoint is unavailable or packing is not deterministic
 */
const packPackageTarball = (packageDirectory: string, packDirectory: string): string => {
  const packageManagerEntrypoint = process.env['npm_execpath'];

  if (packageManagerEntrypoint === undefined) {
    throw new Error('The package-manager entrypoint is unavailable.');
  }

  const existingFiles = new Set(readdirSync(packDirectory));

  runPackageManager(packageManagerEntrypoint, ['pack', '--pack-destination', packDirectory], {
    cwd: packageDirectory,
    encoding: 'utf8',
  });
  const tarballNames = readdirSync(packDirectory).filter(
    (fileName) => fileName.endsWith('.tgz') && !existingFiles.has(fileName),
  );

  if (tarballNames.length !== 1 || tarballNames[0] === undefined) {
    throw new Error('The package tarball was not created deterministically.');
  }

  return tarballNames[0];
};

/**
 * Reads one regular entry from the uncompressed USTAR-compatible package archive.
 * @param tarball The complete gzip-compressed package tarball.
 * @param entryPath The exact archive path to locate.
 * @returns The entry content as a view over the decompressed archive.
 * @throws
 * - If the requested archive entry is absent
 */
const readTarEntry = (tarball: Buffer, entryPath: string): Buffer => {
  const archive = gunzipSync(tarball);
  let offset = 0;

  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    const nameEnd = header.indexOf(0);

    if (nameEnd === 0) {
      break;
    }

    const name = header.subarray(0, nameEnd).toString('utf8');
    const sizeText = header.subarray(124, 136).toString('ascii').replaceAll('\0', '').trim();
    const size = Number.parseInt(sizeText, 8);
    const contentOffset = offset + 512;

    if (name === entryPath) {
      return archive.subarray(contentOffset, contentOffset + size);
    }

    offset = contentOffset + Math.ceil(size / 512) * 512;
  }

  throw new Error(`The packed archive does not contain ${entryPath}.`);
};

describe('published Core package artifacts', () => {
  test('packs only the intended public-package files and runtime dependencies', () => {
    const packageManagerEntrypoint = process.env['npm_execpath'];

    if (packageManagerEntrypoint === undefined) {
      throw new Error('The package-manager entrypoint is unavailable.');
    }

    const output = runPackageManager(packageManagerEntrypoint, ['pack', '--dry-run', '--json'], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });
    const packResult = JSON.parse(output) as IPackDryRunResult;
    const manifest = JSON.parse(
      readFileSync(path.join(projectDirectory, 'package.json'), 'utf8'),
    ) as { readonly dependencies?: Readonly<Record<string, string>> };
    const packedPaths = packResult.files.map((file) => file.path);

    expect(packResult).toMatchObject({ name: '@moldea.ai/core', version: '6.0.0' });
    for (const entryName of [
      'index',
      'format',
      'adapter',
      'node',
      'node-runner',
      'analysis-worker',
    ]) {
      expect(packedPaths).toContain(`dist/${entryName}.js`);
    }
    expect(packedPaths).toContain('dist/index.d.ts');
    expect(packedPaths).toContain('dist/format/index.d.ts');
    expect(packedPaths).toContain('dist/adapter/index.d.ts');
    expect(packedPaths).toContain('dist/node/index.d.ts');
    expect(
      packedPaths.some((filePath) => /\.test-(?:unit|integration|e2e|bench)\./u.test(filePath)),
    ).toBe(false);
    expect(packedPaths).toContain('LICENSE');
    expect(packedPaths).toContain('README.md');
    expect(packedPaths).toContain('cover.png');
    expect(packedPaths).toContain('package.json');
    expect(
      packedPaths.every(
        (filePath) =>
          filePath.startsWith('dist/') ||
          filePath === 'LICENSE' ||
          filePath === 'README.md' ||
          filePath === 'cover.png' ||
          filePath === 'package.json',
      ),
    ).toBe(true);
    expect(manifest.dependencies).toStrictEqual({
      '@moldea.ai/repository': 'workspace:^2.0.0',
      'error-message-utils': '1.2.11',
      yaml: '2.9.0',
    });
  });

  test('loads only documented named runtime exports through package self-resolution', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        [
          "const root = await import('@moldea.ai/core');",
          "const format = await import('@moldea.ai/core/format');",
          "const adapter = await import('@moldea.ai/core/adapter');",
          "const node = await import('@moldea.ai/core/node');",
          'console.log(JSON.stringify({ root: Object.keys(root).sort(), format: Object.keys(format).sort(), adapter: Object.keys(adapter).sort(), node: Object.keys(node).sort() }));',
        ].join(''),
      ],
      { cwd: projectDirectory, encoding: 'utf8' },
    );

    expect(JSON.parse(output)).toStrictEqual({
      adapter: [
        'createRuntimeAdapterResultCollector',
        'iterateRuntimeAdapterEntries',
        'readRuntimeAdapterFile',
      ],
      format: [],
      node: ['NODE_INSPECTION_PROFILE', 'createNodeProjectInspection'],
      root: [
        'CoreConfigurationException',
        'CoreOperationException',
        'DEFAULT_CORE_RESOURCE_LIMITS',
        'SUPPORTED_REPOSITORY_FORMAT_VERSIONS',
        'createCore',
      ],
    });
  });

  test('rewrites the Repository workspace dependency in the real tarball manifest', () => {
    const packageManagerEntrypoint = process.env['npm_execpath'];

    if (packageManagerEntrypoint === undefined) {
      throw new Error('The package-manager entrypoint is unavailable.');
    }

    const packDirectory = mkdtempSync(path.join(tmpdir(), 'moldea-core-pack-'));

    try {
      runPackageManager(packageManagerEntrypoint, ['pack', '--pack-destination', packDirectory], {
        cwd: projectDirectory,
        encoding: 'utf8',
      });
      const tarballName = readdirSync(packDirectory).find((fileName) => fileName.endsWith('.tgz'));

      if (tarballName === undefined) {
        throw new Error('The Core tarball was not created.');
      }

      const manifest = JSON.parse(
        readTarEntry(
          readFileSync(path.join(packDirectory, tarballName)),
          'package/package.json',
        ).toString('utf8'),
      ) as { readonly dependencies?: Readonly<Record<string, string>> };

      expect(manifest.dependencies).toStrictEqual({
        '@moldea.ai/repository': '^2.0.0',
        'error-message-utils': '1.2.11',
        yaml: '2.9.0',
      });
    } finally {
      rmSync(packDirectory, { force: true, recursive: true });
    }
  });

  test('emits all public declarations without obsolete or private workspace types', () => {
    const indexDeclaration = readFileSync(path.join(distributionDirectory, 'index.d.ts'), 'utf8');
    const contractsDeclaration = readFileSync(
      path.join(distributionDirectory, 'contracts', 'index.d.ts'),
      'utf8',
    );
    const formatDeclaration = readFileSync(
      path.join(distributionDirectory, 'format', 'index.d.ts'),
      'utf8',
    );
    const adapterDeclaration = readFileSync(
      path.join(distributionDirectory, 'adapter', 'index.d.ts'),
      'utf8',
    );
    const allDeclarations = readDistributionFiles('.d.ts').join('\n');

    expect(indexDeclaration).toContain('IRuntimeAdapterEvidence');
    expect(indexDeclaration).toContain('createCore');
    expect(contractsDeclaration).toContain('validateProject');
    expect(contractsDeclaration).not.toMatch(/\binspectProject\(/u);
    expect(indexDeclaration).not.toContain('IYaml');
    expect(formatDeclaration).toContain('IMoldeaManifestV1');
    expect(formatDeclaration).toContain('IParsedDecision');
    expect(formatDeclaration).not.toContain('IHandoffManifestEntry');
    expect(adapterDeclaration).toContain('inspect(');
    expect(adapterDeclaration).toContain('IRuntimeAdapterEvidence');
    expect(allDeclarations).not.toMatch(/from ['"]@moldea\.ai\/(?!repository(?:['"/]))/u);
    expect(allDeclarations).not.toMatch(/from ['"]yaml['"]/u);
    expect(allDeclarations).not.toContain('ParsedNode');
    expect(allDeclarations).not.toContain('packages/');
    expect(allDeclarations).toContain('parseDecision');
  });

  test('installs real Core and Repository tarballs and typechecks a consumer', () => {
    const packageManagerEntrypoint = process.env['npm_execpath'];

    if (packageManagerEntrypoint === undefined) {
      throw new Error('The package-manager entrypoint is unavailable.');
    }

    const consumerDirectory = mkdtempSync(path.join(tmpdir(), 'moldea-core-consumer-'));

    try {
      const repositoryTarballName = packPackageTarball(
        repositoryProjectDirectory,
        consumerDirectory,
      );
      const coreTarballName = packPackageTarball(projectDirectory, consumerDirectory);

      writeFileSync(
        path.join(consumerDirectory, 'package.json'),
        `${JSON.stringify(
          {
            dependencies: {
              '@moldea.ai/core': `file:./${coreTarballName}`,
              '@moldea.ai/repository': `file:./${repositoryTarballName}`,
            },
            name: 'moldea-core-tarball-consumer',
            private: true,
            type: 'module',
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
      writeFileSync(
        path.join(consumerDirectory, 'pnpm-workspace.yaml'),
        `packages:\n  - .\noverrides:\n  '@moldea.ai/repository': file:./${repositoryTarballName}\n`,
        'utf8',
      );
      copyFileSync(
        path.join(publicApiFixtureDirectory, 'public-api.test-fixture.mts'),
        path.join(consumerDirectory, 'public-api.test-fixture.mts'),
      );
      writeFileSync(
        path.join(consumerDirectory, 'tsconfig.json'),
        `${JSON.stringify(
          {
            compilerOptions: { skipLibCheck: false },
            extends: path.resolve(
              projectDirectory,
              '..',
              '..',
              'configs',
              'typescript',
              'environment-neutral.json',
            ),
            files: ['public-api.test-fixture.mts'],
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
      runPackageManager(
        packageManagerEntrypoint,
        ['install', '--ignore-scripts', '--prefer-offline'],
        {
          cwd: consumerDirectory,
          encoding: 'utf8',
          env: { ...process.env, CI: 'true' },
        },
      );
      execFileSync(process.execPath, [typescriptEntrypoint, '--project', 'tsconfig.json'], {
        cwd: consumerDirectory,
        encoding: 'utf8',
      });
      const runtimeOutput = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          [
            "import { createCore } from '@moldea.ai/core';",
            "import { parseRepositoryPath } from '@moldea.ai/repository';",
            "import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';",
            "import { createNodeProjectInspection } from '@moldea.ai/core/node';",
            "import { writeFileSync } from 'node:fs';",
            "const registryUrl = new URL('./registry.mjs', import.meta.url);",
            "writeFileSync(registryUrl, 'export const adapters = [];');",
            'const isolated = await createNodeProjectInspection({ repository: createMemoryRepositoryReader([]), adapterRegistryUrl: registryUrl });',
            "const page = await isolated.readPage({ maxItems: 1, view: 'diagnostics' });",
            'const isolatedResult = { hasHeap: isolated.maxAnalysisHeapBytes > 0, hasDiagnostics: page.page.records.length > 0 };',
            'await isolated.dispose(); await isolated.dispose();',
            'const core = createCore();',
            "const manifest = await core.parseManifest({ content: 'version: 1\\n', path: parseRepositoryPath('/moldea/moldea.yaml') });",
            "const scope = await core.matchManifestScope({ manifest: { content: 'version: 1\\n', path: parseRepositoryPath('/moldea/moldea.yaml') }, paths: ['/src/index.ts'] });",
            "const decision = await core.parseDecision({ content: '---\\nstatus: accepted\\ncreatedAt: \"2026-08-07T19:42:03.456Z\"\\n---\\nBody.\\n', path: parseRepositoryPath('/moldea/decisions/1786131723456-use-postgresql.md') });",
            'console.log(JSON.stringify({ decision, manifest, scope, isolated: isolatedResult }));',
          ].join(''),
        ],
        { cwd: consumerDirectory, encoding: 'utf8', timeout: 10_000 },
      );
      const runtimeResult = JSON.parse(runtimeOutput) as {
        readonly decision: {
          readonly decision: {
            readonly asset: { readonly digest: string };
            readonly id: string;
          } | null;
          readonly diagnostics: readonly unknown[];
          readonly valid: boolean;
        };
        readonly manifest: {
          readonly asset: { readonly digest: string } | null;
          readonly diagnostics: readonly unknown[];
          readonly manifest: { readonly version: number } | null;
          readonly valid: boolean;
        };
        readonly scope: {
          readonly counts: { readonly matches: number };
          readonly relevant: boolean;
          readonly valid: boolean;
        };
      };

      expect(runtimeResult).toMatchObject({
        isolated: { hasHeap: true, hasDiagnostics: true },
        decision: {
          decision: {
            asset: {
              digest: 'sha256:2fe38755065f6267d0a90af76cd089532b959ecfa8e2699990b9f5bfce8fe304',
            },
            id: '1786131723456',
          },
          diagnostics: [],
          valid: true,
        },
        manifest: {
          asset: {
            digest: 'sha256:09bfcc6a14b83e2192b8673677725c84883ee9cd0c70e45c9ec09daa8f2b2847',
          },
          diagnostics: [],
          manifest: { version: 1 },
          valid: true,
        },
        scope: {
          counts: { matches: 0 },
          relevant: false,
          valid: true,
        },
      });
    } finally {
      rmSync(consumerDirectory, { force: true, recursive: true });
    }
  });

  test('keeps main, format and adapter import graphs environment-neutral', () => {
    const javascript = readNeutralImportGraphs();

    expect(javascript).not.toMatch(/from ['"]node:/u);
    expect(javascript).not.toMatch(/require\(['"](?:node:)?/u);
    expect(javascript).not.toContain('process.');
  });
});
