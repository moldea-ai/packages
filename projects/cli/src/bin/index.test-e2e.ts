// @vitest-environment node
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

import type { IMoldeaCliValidateResult } from '../presentation/index.js';

import { createGitProcessEnvironment } from '../git-process/index.js';

import {
  CLI_DISTRIBUTION_PATH,
  CLI_PROJECT_DIRECTORY,
  CORE_PROJECT_DIRECTORY,
  expectPackageManifest,
  type IMoldeaCliPackageManifest,
  type IPackDryRunResult,
  packPackageTarball,
  readCliPackageManifest,
  readTarEntry,
  REPOSITORY_FILESYSTEM_PROJECT_DIRECTORY,
  REPOSITORY_PROJECT_DIRECTORY,
  runPackageManager,
  spawnPackageManager,
} from './index.test-fixtures.js';

interface IGitStateSnapshot {
  readonly config: string | null;
  readonly configWorktree: string | null;
  readonly head: string | null;
  readonly index: string | null;
  readonly objectMetadata: readonly string[];
  readonly packedRefs: string | null;
  readonly refs: readonly string[];
  readonly stagedEntries: string;
  readonly status: string;
  readonly submodules: string | null;
}

/** Reads one optional Git administrative file without interpreting its contents. */
const readOptionalFile = (filePath: string): string | null =>
  existsSync(filePath) ? readFileSync(filePath).toString('base64') : null;

/** Captures stable relative metadata for one Git administrative tree. */
const captureMetadataTree = (
  root: string,
  includeContent: boolean,
  currentDirectory = root,
): readonly string[] => {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(currentDirectory)
    .sort()
    .flatMap((name) => {
      const childPath = path.join(currentDirectory, name);
      const statistics = lstatSync(childPath, { bigint: true });
      const relativePath = path.relative(root, childPath).split(path.sep).join('/');
      const metadata = `${relativePath}\0${statistics.mode}\0${statistics.size}\0${statistics.mtimeNs}`;

      if (statistics.isDirectory()) {
        return [metadata, ...captureMetadataTree(root, includeContent, childPath)];
      }

      return [
        includeContent ? `${metadata}\0${readFileSync(childPath).toString('base64')}` : metadata,
      ];
    });
};

/** Captures the complete Git state that a read-only installed command must preserve. */
const captureGitState = (
  repositoryRoot: string,
  environment: NodeJS.ProcessEnv,
): IGitStateSnapshot => {
  const gitDirectory = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: environment,
  }).trim();
  const executeGit = (arguments_: readonly string[]): string =>
    execFileSync('git', ['-c', 'core.fsmonitor=false', ...arguments_], {
      cwd: repositoryRoot,
      encoding: 'buffer',
      env: environment,
    }).toString('base64');
  const gitModulesPath = path.join(repositoryRoot, '.gitmodules');

  return {
    config: readOptionalFile(path.join(gitDirectory, 'config')),
    configWorktree: readOptionalFile(path.join(gitDirectory, 'config.worktree')),
    head: readOptionalFile(path.join(gitDirectory, 'HEAD')),
    index: readOptionalFile(path.join(gitDirectory, 'index')),
    objectMetadata: captureMetadataTree(path.join(gitDirectory, 'objects'), false),
    packedRefs: readOptionalFile(path.join(gitDirectory, 'packed-refs')),
    refs: captureMetadataTree(path.join(gitDirectory, 'refs'), true),
    stagedEntries: executeGit(['ls-files', '--stage', '-z']),
    status: executeGit(['status', '--porcelain=v2', '-z', '--ignore-submodules=none']),
    submodules: existsSync(gitModulesPath)
      ? executeGit(['submodule', 'status', '--recursive'])
      : null,
  };
};

/** Waits until a process-owned signal fixture is materialized. */
const waitForFixturePath = async (fixturePath: string): Promise<void> => {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    if (existsSync(fixturePath)) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 25);
    });
  }

  throw new Error('The signal fixture was not created before the test deadline.');
};

/** Determines whether process-group cleanup raced with normal process exit. */
const isMissingProcessError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ESRCH';

/** Spawns the installed CLI, signals its active Git child, and captures process completion. */
const executeInstalledSignalCase = async (
  executablePath: string,
  command: 'inspect' | 'validate',
  signal: 'SIGINT' | 'SIGTERM',
  cwd: string,
  environment: NodeJS.ProcessEnv,
  startedPath: string,
  stoppedPath: string,
): Promise<{ readonly code: number | null; readonly stderr: string; readonly stdout: string }> => {
  const childProcess = spawn(process.execPath, [executablePath, command, '--json'], {
    cwd,
    detached: true,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stderrChunks: Buffer[] = [];
  const stdoutChunks: Buffer[] = [];
  let hasClosed = false;
  const closeCompletion = new Promise<number | null>((resolve) => {
    childProcess.once('close', (code) => {
      hasClosed = true;
      resolve(code);
    });
  });
  const processFailure = new Promise<{
    readonly error: Error;
    readonly kind: 'failed';
  }>((resolve) => {
    childProcess.once('error', (error) => resolve({ error, kind: 'failed' }));
  });

  childProcess.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
  childProcess.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));

  let cleanupFailure: unknown;
  let executionFailure: unknown;
  let executionResult: {
    readonly code: number | null;
    readonly stderr: string;
    readonly stdout: string;
  } | null = null;
  let hasCleanupFailed = false;
  let hasExecutionFailed = false;

  try {
    const startupResult = await Promise.race([
      waitForFixturePath(startedPath).then(() => Object.freeze({ kind: 'started' as const })),
      processFailure,
    ]);

    if (startupResult.kind === 'failed') {
      throw startupResult.error;
    }

    if (!childProcess.kill(signal)) {
      throw new Error('The installed CLI process exited before it could receive the test signal.');
    }

    const completionResult = await Promise.race([
      closeCompletion.then((code) => Object.freeze({ code, kind: 'closed' as const })),
      processFailure,
    ]);

    if (completionResult.kind === 'failed') {
      throw completionResult.error;
    }

    await waitForFixturePath(stoppedPath);

    executionResult = {
      code: completionResult.code,
      stderr: Buffer.concat(stderrChunks).toString('utf8'),
      stdout: Buffer.concat(stdoutChunks).toString('utf8'),
    };
  } catch (error) {
    executionFailure = error;
    hasExecutionFailed = true;
  } finally {
    if (!hasClosed && childProcess.pid !== undefined) {
      try {
        process.kill(-childProcess.pid, 'SIGKILL');
      } catch (error) {
        if (!isMissingProcessError(error)) {
          cleanupFailure = error;
          hasCleanupFailed = true;
        }
      }

      await closeCompletion;
    }
  }

  if (hasExecutionFailed && hasCleanupFailed) {
    throw new AggregateError(
      [executionFailure, cleanupFailure],
      'The installed CLI signal case and its cleanup both failed.',
    );
  }

  if (hasExecutionFailed) {
    throw executionFailure;
  }

  if (hasCleanupFailed) {
    throw cleanupFailure;
  }

  if (executionResult === null) {
    throw new Error('The installed CLI signal case did not produce a completion result.');
  }

  return executionResult;
};

describe('published CLI package and executable', () => {
  test('packs only the executable package surface and exact metadata', () => {
    const packageManagerEntrypoint = process.env['npm_execpath'];

    if (packageManagerEntrypoint === undefined) {
      throw new Error('The package-manager entrypoint is unavailable.');
    }

    const output = runPackageManager(packageManagerEntrypoint, ['pack', '--dry-run', '--json'], {
      cwd: CLI_PROJECT_DIRECTORY,
      encoding: 'utf8',
    });
    const packResult = JSON.parse(output) as IPackDryRunResult;
    const manifest = readCliPackageManifest();
    const packedPaths = packResult.files.map((file) => file.path);

    expect(packResult).toMatchObject({ name: '@moldea.ai/cli', version: '11.0.6' });
    expect(packedPaths).toContain('dist/moldea.js');
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
    expect(packedPaths.every((filePath) => !filePath.includes('.test-'))).toBe(true);
    expectPackageManifest(manifest, 'workspace:^7.0.4', 'workspace:^2.0.0', 'workspace:^2.0.7');
    const executable = readFileSync(CLI_DISTRIBUTION_PATH, 'utf8');
    const executableChunks = packedPaths
      .filter((filePath) => filePath.startsWith('dist/chunks/') && filePath.endsWith('.js'))
      .map((filePath) => readFileSync(path.join(CLI_PROJECT_DIRECTORY, filePath), 'utf8'))
      .join('\n');

    expect(executable.startsWith('#!/usr/bin/env node\n')).toBe(true);
    expect(executable).toContain('import("./chunks/');
    expect(executableChunks).toContain('minimumGitVersion');
  });

  test('rewrites compatible workspace dependencies in the real tarball', () => {
    const packageManagerEntrypoint = process.env['npm_execpath'];

    if (packageManagerEntrypoint === undefined) {
      throw new Error('The package-manager entrypoint is unavailable.');
    }

    const packDirectory = mkdtempSync(path.join(tmpdir(), 'moldea-cli-pack-'));

    try {
      const tarballName = packPackageTarball(
        packageManagerEntrypoint,
        CLI_PROJECT_DIRECTORY,
        packDirectory,
      );
      const tarball = readFileSync(path.join(packDirectory, tarballName));
      const manifest = JSON.parse(
        readTarEntry(tarball, 'package/package.json').toString('utf8'),
      ) as IMoldeaCliPackageManifest;
      const executable = readTarEntry(tarball, 'package/dist/moldea.js').toString('utf8');

      expectPackageManifest(manifest, '^7.0.4', '^2.0.0', '^2.0.7');
      expect(executable.startsWith('#!/usr/bin/env node\n')).toBe(true);
      expect(executable).toContain('import("./chunks/');
    } finally {
      rmSync(packDirectory, { force: true, recursive: true });
    }
  });

  test('preserves authored relationship pointers across installed validation pages', () => {
    const packageManagerEntrypoint = process.env['npm_execpath'];
    if (packageManagerEntrypoint === undefined) {
      throw new Error('The package-manager entrypoint is unavailable.');
    }
    const directory = mkdtempSync(path.join(tmpdir(), 'moldea-cli-pointers-'));
    const repository = path.join(directory, 'repository');
    const gitHome = path.join(directory, 'home');
    const gitConfig = path.join(directory, 'config');
    const environment = createGitProcessEnvironment({
      ...process.env,
      HOME: gitHome,
      XDG_CONFIG_HOME: gitConfig,
    });

    try {
      for (const target of [repository, gitHome, gitConfig]) mkdirSync(target);
      const tarballs = Object.fromEntries(
        (
          [
            ['@moldea.ai/repository', REPOSITORY_PROJECT_DIRECTORY],
            ['@moldea.ai/repository-fs', REPOSITORY_FILESYSTEM_PROJECT_DIRECTORY],
            ['@moldea.ai/core', CORE_PROJECT_DIRECTORY],
            ['@moldea.ai/cli', CLI_PROJECT_DIRECTORY],
          ] as const
        ).map(([name, project]) => [
          name,
          `file:./${packPackageTarball(packageManagerEntrypoint, project, directory)}`,
        ]),
      );
      writeFileSync(
        path.join(directory, 'package.json'),
        JSON.stringify({
          name: 'moldea-cli-pointers',
          private: true,
          type: 'module',
          dependencies: tarballs,
        }),
      );
      writeFileSync(
        path.join(directory, 'pnpm-workspace.yaml'),
        `packages:\n  - .\noverrides:\n${Object.entries(tarballs)
          .map(([name, tarball]) => `  '${name}': ${tarball}`)
          .join('\n')}\n`,
      );
      runPackageManager(
        packageManagerEntrypoint,
        ['install', '--ignore-scripts', '--prefer-offline'],
        {
          cwd: directory,
          encoding: 'utf8',
          env: { ...process.env, CI: 'true' },
        },
      );
      execFileSync('git', ['init', '--quiet'], { cwd: repository, env: environment });

      const instruction = 'You are the `reviewer` agent. Follow project policy.\n';
      const mirrors = Array.from(
        { length: 32 },
        (_, index) => `/mirrors/mirror-${String(31 - index).padStart(2, '0')}.md`,
      );
      const files = {
        '/moldea/project.md': '# Project\n',
        '/moldea/context/z.md': '# Existing context\n',
        '/moldea/decisions/1767225600001-z.md':
          '---\nstatus: proposed\ncreatedAt: "2026-01-01T00:00:00.001Z"\n---\nProposed decision.\n',
        '/moldea/agents/reviewer/description.md': 'Reviewer.\n',
        '/moldea/agents/reviewer/instruction.md': instruction,
        [mirrors[0]!]: instruction,
        [mirrors[1]!]: 'Different instruction.\n',
        '/moldea/moldea.yaml': JSON.stringify({
          version: 1,
          agents: {
            reviewer: {
              runtime: { id: 'custom' },
              context: ['/moldea/context/z.md', '/moldea/context/a.md'],
              decisions: [
                '/moldea/decisions/1767225600001-z.md',
                '/moldea/decisions/1767225600000-a.md',
              ],
              mirrors,
            },
          },
        }),
      };
      for (const [logicalPath, content] of Object.entries(files)) {
        const target = path.join(repository, logicalPath.slice(1));
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, content);
      }

      const executable = path.join(
        directory,
        'node_modules',
        '@moldea.ai',
        'cli',
        'dist',
        'moldea.js',
      );
      const diagnostics: { code: string; pointer: string | null }[] = [];
      const keys = new Set<string>();
      let cursor: string | null = null;
      let pages = 0;
      do {
        const response = spawnSync(
          process.execPath,
          [
            executable,
            'validate',
            '--json',
            '--max-output-bytes',
            '4096',
            ...(cursor === null ? [] : ['--cursor', cursor]),
          ],
          {
            cwd: repository,
            env: environment,
            encoding: 'utf8',
          },
        );
        expect(response.status, response.stdout || response.stderr).toBe(1);
        expect(response.stderr).toBe('');
        expect(Buffer.byteLength(response.stdout)).toBeLessThanOrEqual(4096);
        const envelope = JSON.parse(response.stdout) as { result: IMoldeaCliValidateResult };
        expect(envelope.result.errorCount).toBe(mirrors.length + 2);
        for (const record of envelope.result.page.records) {
          expect(keys.has(record.key)).toBe(false);
          keys.add(record.key);
          if (record.kind === 'diagnostic' && record.severity === 'error') {
            diagnostics.push({ code: record.code, pointer: record.pointer });
          }
        }
        cursor = envelope.result.page.cursor;
        expect(++pages).toBeLessThanOrEqual(64);
      } while (cursor !== null);

      expect(pages).toBeGreaterThan(1);
      expect(diagnostics).toHaveLength(mirrors.length + 2);
      expect(new Map(diagnostics.map(({ code, pointer }) => [pointer, code]))).toStrictEqual(
        new Map([
          ['/agents/reviewer/context/1', 'MOLDEA_REFERENCE_MISSING'],
          ['/agents/reviewer/decisions/0', 'MOLDEA_DECISION_RELATIONSHIP_INACTIVE'],
          ['/agents/reviewer/decisions/1', 'MOLDEA_DECISION_REFERENCE_MISSING'],
          ['/agents/reviewer/mirrors/1', 'MOLDEA_MIRROR_STALE'],
          ...mirrors
            .slice(2)
            .map((_, index): [string, string] => [
              `/agents/reviewer/mirrors/${index + 2}`,
              'MOLDEA_MIRROR_MISSING',
            ]),
        ]),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 120_000);

  test.skipIf(process.platform === 'win32')(
    'omits invalid external filenames and rejects canonical filenames in installed commands',
    () => {
      const packageManagerEntrypoint = process.env['npm_execpath'];
      if (packageManagerEntrypoint === undefined) {
        throw new Error('The package-manager entrypoint is unavailable.');
      }
      const directory = mkdtempSync(path.join(tmpdir(), 'moldea-cli-paths-'));
      const gitHome = path.join(directory, 'home');
      const gitConfig = path.join(directory, 'config');
      const environment = createGitProcessEnvironment({
        ...process.env,
        HOME: gitHome,
        XDG_CONFIG_HOME: gitConfig,
      });

      try {
        mkdirSync(gitHome);
        mkdirSync(gitConfig);
        const tarballs = Object.fromEntries(
          (
            [
              ['@moldea.ai/repository', REPOSITORY_PROJECT_DIRECTORY],
              ['@moldea.ai/repository-fs', REPOSITORY_FILESYSTEM_PROJECT_DIRECTORY],
              ['@moldea.ai/core', CORE_PROJECT_DIRECTORY],
              ['@moldea.ai/cli', CLI_PROJECT_DIRECTORY],
            ] as const
          ).map(([name, project]) => [
            name,
            `file:./${packPackageTarball(packageManagerEntrypoint, project, directory)}`,
          ]),
        );
        writeFileSync(
          path.join(directory, 'package.json'),
          JSON.stringify({
            name: 'moldea-cli-paths',
            private: true,
            type: 'module',
            dependencies: tarballs,
          }),
        );
        writeFileSync(
          path.join(directory, 'pnpm-workspace.yaml'),
          `packages:\n  - .\noverrides:\n${Object.entries(tarballs)
            .map(([name, tarball]) => `  '${name}': ${tarball}`)
            .join('\n')}\n`,
        );
        runPackageManager(
          packageManagerEntrypoint,
          ['install', '--ignore-scripts', '--prefer-offline'],
          { cwd: directory, encoding: 'utf8', env: { ...process.env, CI: 'true' } },
        );
        const executable = path.join(directory, 'node_modules/@moldea.ai/cli/dist/moldea.js');

        for (const kind of ['tracked', 'untracked']) {
          for (const canonical of [false, true]) {
            const repository = path.join(
              directory,
              `${kind}-${canonical ? 'canonical' : 'external'}`,
            );
            mkdirSync(path.join(repository, 'moldea'), { recursive: true });
            execFileSync('git', ['init', '--quiet'], { cwd: repository, env: environment });
            writeFileSync(path.join(repository, 'moldea/project.md'), '# Project\n');
            writeFileSync(path.join(repository, 'moldea/moldea.yaml'), 'version: 1\n');
            const invalidPath = `${canonical ? 'moldea/' : ''}control\npath.md`;
            writeFileSync(path.join(repository, invalidPath), '# Source\n');
            if (kind === 'tracked') {
              execFileSync('git', ['add', '--', invalidPath], {
                cwd: repository,
                env: environment,
              });
            }
            const before = captureGitState(repository, environment);

            for (const command of ['validate', 'inspect']) {
              const response = spawnSync(process.execPath, [executable, command, '--json'], {
                cwd: repository,
                env: environment,
                encoding: 'utf8',
              });
              expect(response.status, response.stdout || response.stderr).toBe(canonical ? 3 : 0);
              expect(response.stderr).toBe('');
              if (canonical) {
                expect(JSON.parse(response.stdout)).toMatchObject({
                  command,
                  error: { code: 'GIT_OUTPUT_INVALID', source: 'git' },
                  result: null,
                  schemaVersion: 7,
                  status: 'error',
                });
              } else {
                expect(JSON.parse(response.stdout)).toMatchObject({
                  command,
                  error: null,
                  schemaVersion: 7,
                  status: 'valid',
                });
                expect(response.stdout).not.toContain('control');
                expect(response.stdout).not.toContain('GIT_OUTPUT_INVALID');
              }
            }
            expect(captureGitState(repository, environment)).toStrictEqual(before);
          }
        }
      } finally {
        rmSync(directory, { force: true, recursive: true });
      }
    },
    120_000,
  );

  test('installs and executes the real CLI and foundational package tarballs', async () => {
    const packageManagerEntrypoint = process.env['npm_execpath'];

    if (packageManagerEntrypoint === undefined) {
      throw new Error('The package-manager entrypoint is unavailable.');
    }

    const testDirectory = mkdtempSync(path.join(tmpdir(), 'moldea-cli-consumer-'));
    const consumerDirectory = path.join(testDirectory, 'consumer');
    const gitHomeDirectory = path.join(testDirectory, 'home');
    const gitConfigDirectory = path.join(testDirectory, 'config');
    const gitHooksDirectory = path.join(testDirectory, 'hooks');
    const gitEnvironment: NodeJS.ProcessEnv = createGitProcessEnvironment({
      ...process.env,
      HOME: gitHomeDirectory,
      XDG_CONFIG_HOME: gitConfigDirectory,
    });

    for (const directory of [
      consumerDirectory,
      gitHomeDirectory,
      gitConfigDirectory,
      gitHooksDirectory,
    ]) {
      mkdirSync(directory, { recursive: true });
    }

    try {
      const repositoryTarballName = packPackageTarball(
        packageManagerEntrypoint,
        REPOSITORY_PROJECT_DIRECTORY,
        consumerDirectory,
      );
      const repositoryFilesystemTarballName = packPackageTarball(
        packageManagerEntrypoint,
        REPOSITORY_FILESYSTEM_PROJECT_DIRECTORY,
        consumerDirectory,
      );
      const coreTarballName = packPackageTarball(
        packageManagerEntrypoint,
        CORE_PROJECT_DIRECTORY,
        consumerDirectory,
      );
      const cliTarballName = packPackageTarball(
        packageManagerEntrypoint,
        CLI_PROJECT_DIRECTORY,
        consumerDirectory,
      );
      const packageTarballs = {
        '@moldea.ai/cli': `file:./${cliTarballName}`,
        '@moldea.ai/core': `file:./${coreTarballName}`,
        '@moldea.ai/repository': `file:./${repositoryTarballName}`,
        '@moldea.ai/repository-fs': `file:./${repositoryFilesystemTarballName}`,
      };

      writeFileSync(
        path.join(consumerDirectory, 'package.json'),
        `${JSON.stringify(
          {
            dependencies: packageTarballs,
            name: 'moldea-cli-tarball-consumer',
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
        `packages:\n  - .\noverrides:\n${Object.entries(packageTarballs)
          .map(([packageName, tarball]) => `  '${packageName}': ${tarball}`)
          .join('\n')}\n`,
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

      const installedExecutablePath = path.join(
        consumerDirectory,
        'node_modules',
        '@moldea.ai',
        'cli',
        'dist',
        'moldea.js',
      );

      expect(existsSync(path.join(consumerDirectory, 'node_modules', '.bin', 'moldea'))).toBe(true);
      expect(
        runPackageManager(packageManagerEntrypoint, ['exec', 'moldea', '--version'], {
          cwd: consumerDirectory,
          encoding: 'utf8',
        }),
      ).toBe('11.0.6\n');

      const warningRepositoryDirectory = path.join(testDirectory, 'warning-repository');
      mkdirSync(path.join(warningRepositoryDirectory, 'moldea'), { recursive: true });
      mkdirSync(path.join(warningRepositoryDirectory, 'src'));
      execFileSync('git', ['init', '--quiet'], {
        cwd: warningRepositoryDirectory,
        env: gitEnvironment,
      });
      const warningManifestPath = path.join(warningRepositoryDirectory, 'moldea', 'moldea.yaml');
      const warningSourcePath = path.join(warningRepositoryDirectory, 'src', 'agent.ts');
      const warningManifest = {
        version: 1,
        context: {
          '/moldea/project.md': {
            affectedBy: ['/future/**'],
            bindings: [
              { path: '/src/agent.ts', symbol: 'supportAgent' },
              { path: '/src/other.cjs', symbol: 'other' },
            ],
          },
        },
        acceptedWarnings: [
          {
            code: 'MOLDEA_INTEGRATION_BLOCK_MISSING',
            subject: '/AGENTS.md',
            reason: 'This fixture deliberately has no installed coding agent.',
          },
        ],
      };
      writeFileSync(warningManifestPath, JSON.stringify(warningManifest));
      writeFileSync(path.join(warningRepositoryDirectory, 'moldea', 'project.md'), '# Project\n');
      writeFileSync(warningSourcePath, 'export const supportAgent = () => null;\n');
      writeFileSync(
        path.join(warningRepositoryDirectory, 'src', 'other.cjs'),
        'exports.other = 1;\n',
      );
      const executeWarningCase = (
        command: 'inspect' | 'validate',
        options: string[] = ['--json'],
      ) =>
        spawnSync(process.execPath, [installedExecutablePath, command, ...options], {
          cwd: warningRepositoryDirectory,
          encoding: 'utf8',
          env: gitEnvironment,
        });
      const warningValidation = executeWarningCase('validate');
      expect(warningValidation.status).toBe(0);
      const warningResult = JSON.parse(warningValidation.stdout) as {
        result: IMoldeaCliValidateResult;
      };
      expect(warningResult).toMatchObject({
        schemaVersion: 7,
        status: 'valid',
        result: {
          errorCount: 0,
          warningCount: 1,
          acceptedWarningCount: 1,
          diagnosticCount: 2,
          coverageCounts: { bindings: 2, exportsPassed: 1, exportsFailed: 0, exportsNotChecked: 1 },
        },
      });
      expect(warningResult.result.page.records).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: 'diagnostic',
            group: 'integration',
            severity: 'warning',
            subject: '/AGENTS.md',
            qualifier: null,
            acceptable: true,
            accepted: true,
            reason: warningManifest.acceptedWarnings[0]?.reason,
          }),
          expect.objectContaining({
            kind: 'diagnostic',
            group: 'references',
            severity: 'warning',
            subject: '/moldea/project.md',
            qualifier: '/future/**',
            acceptable: true,
            accepted: false,
            reason: null,
          }),
          expect.objectContaining({
            kind: 'coverage',
            path: '/src/agent.ts',
            fileCheck: 'passed',
            exportCheck: 'passed',
          }),
          expect.objectContaining({
            kind: 'coverage',
            path: '/src/other.cjs',
            fileCheck: 'passed',
            exportCheck: 'not-checked',
            exportNotCheckedReason: 'unsupported-file-type',
          }),
        ]),
      );
      const warningInspection = executeWarningCase('inspect');
      expect(warningInspection.status).toBe(0);
      expect(JSON.parse(warningInspection.stdout)).toMatchObject({
        schemaVersion: 7,
        result: {
          counts: { errors: 0, warnings: 1, acceptedWarnings: 1, diagnostics: 2, coverage: 2 },
          coverageCounts: warningResult.result.coverageCounts,
        },
      });
      const humanWarnings = executeWarningCase('validate', []);
      expect(humanWarnings.stdout).toContain(
        'Coverage: 2 bindings, 1 exports confirmed, 0 exports missing, 1 not checked\n',
      );
      expect(humanWarnings.stdout).toContain('1 accepted warning\n');
      expect(humanWarnings.stdout).toContain(
        '  subject: /moldea/project.md\n  qualifier: /future/**\n',
      );
      expect(humanWarnings.stdout).not.toContain('MOLDEA_INTEGRATION_BLOCK_MISSING');
      const coverageLimit = executeWarningCase('validate', ['--json', '--max-coverage', '1']);
      expect(coverageLimit.status).toBe(3);
      expect(JSON.parse(coverageLimit.stdout)).toMatchObject({
        status: 'error',
        error: { code: 'RESOURCE_LIMIT_EXCEEDED' },
      });
      writeFileSync(warningSourcePath, 'export const otherAgent = () => null;\n');
      const mixedValidation = executeWarningCase('validate');
      expect(mixedValidation.status).toBe(1);
      expect(JSON.parse(mixedValidation.stdout)).toMatchObject({
        status: 'invalid',
        result: {
          errorCount: 1,
          warningCount: 1,
          acceptedWarningCount: 1,
          diagnosticCount: 3,
          coverageCounts: { bindings: 2, exportsPassed: 0, exportsFailed: 1, exportsNotChecked: 1 },
        },
      });
      expect(
        (JSON.parse(mixedValidation.stdout) as { result: IMoldeaCliValidateResult }).result.page
          .records,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'MOLDEA_REFERENCE_EXPORT_MISSING',
            severity: 'error',
            group: 'references',
          }),
          expect.objectContaining({ kind: 'coverage', exportCheck: 'failed' }),
        ]),
      );

      warningManifest.context['/moldea/project.md'].bindings = Array.from(
        { length: 201 },
        (_, index) => ({ path: '/src/agent.ts', symbol: `entry${index}` }),
      );
      writeFileSync(warningManifestPath, JSON.stringify(warningManifest));
      writeFileSync(
        warningSourcePath,
        Array.from({ length: 200 }, (_, index) => `export const entry${index} = ${index};`).join(
          '\n',
        ),
      );
      const coverageKeys = new Set<string>();
      let coverageCursor: string | null = null;
      let coveragePages = 0;
      do {
        const options = ['--json', '--max-output-bytes', '32768'];
        if (coverageCursor !== null) options.push('--cursor', coverageCursor);
        const response = executeWarningCase('validate', options);
        expect(response.status).toBe(1);
        expect(Buffer.byteLength(response.stdout)).toBeLessThanOrEqual(32768);
        const envelope = JSON.parse(response.stdout) as { result: IMoldeaCliValidateResult };
        expect(envelope.result.coverageCounts).toStrictEqual({
          bindings: 201,
          exportsPassed: 200,
          exportsFailed: 1,
          exportsNotChecked: 0,
        });
        expect(envelope.result.diagnosticCount).toBe(3);
        if (coveragePages === 0) {
          expect(envelope.result.page.records).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                kind: 'diagnostic',
                code: 'MOLDEA_REFERENCE_EXPORT_MISSING',
              }),
            ]),
          );
          expect(envelope.result.page.records[0]?.kind).toBe('diagnostic');
        }
        for (const record of envelope.result.page.records) {
          expect(coverageKeys.has(record.key)).toBe(false);
          coverageKeys.add(record.key);
        }
        coverageCursor = envelope.result.page.cursor;
        expect(++coveragePages).toBeLessThanOrEqual(64);
      } while (coverageCursor !== null);
      expect(coveragePages).toBeGreaterThan(1);
      expect(coverageKeys.size).toBe(204);

      const topLevelHelp = runPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', '--help'],
        {
          cwd: consumerDirectory,
          encoding: 'utf8',
        },
      );

      expect(topLevelHelp).toContain('Usage: moldea <command> [options]\n');

      const zeroArgumentHelp = spawnSync(process.execPath, [installedExecutablePath], {
        cwd: consumerDirectory,
        encoding: 'utf8',
      });

      expect(zeroArgumentHelp).toMatchObject({ status: 0, stderr: '', stdout: topLevelHelp });

      for (const command of ['composition', 'inspect', 'validate']) {
        const commandHelp = spawnSync(
          process.execPath,
          [installedExecutablePath, command, '--help'],
          { cwd: consumerDirectory, encoding: 'utf8' },
        );

        expect(commandHelp.status).toBe(0);
        expect(commandHelp.stderr).toBe('');
        expect(commandHelp.stdout).toContain(`Usage: moldea ${command} [options]\n`);
      }

      for (const invalidArguments of [
        ['--help', 'extra'],
        ['--version', '--no-color'],
        ['unknown'],
        ['compatibility'],
        ['validate', '--unknown'],
        ['validate', '--repository', '.', '--repository', '..'],
        ['validate', '--repository'],
        ['validate', '--max-entries', '0'],
        ['validate', '--max-entries', '1', '--max-entries', '2'],
        ['composition', '--repository', '.'],
      ]) {
        const usageFailure = spawnSync(
          process.execPath,
          [installedExecutablePath, ...invalidArguments],
          { cwd: consumerDirectory, encoding: 'utf8' },
        );

        expect(usageFailure.status).toBe(2);
        expect(usageFailure.stdout).toBe('');
        expect(usageFailure.stderr).toMatch(
          /^(?:cli:INVALID_ARGUMENT|cli:RESOURCE_LIMIT_CONFIGURATION_INVALID) /u,
        );
        expect(usageFailure.stderr.endsWith('\n')).toBe(true);
      }

      const jsonHelpFailure = spawnSync(
        process.execPath,
        [installedExecutablePath, 'validate', '--help', '--json'],
        { cwd: consumerDirectory, encoding: 'utf8' },
      );

      expect(jsonHelpFailure.status).toBe(2);
      expect(jsonHelpFailure.stderr).toBe('');
      expect(JSON.parse(jsonHelpFailure.stdout)).toMatchObject({
        command: 'validate',
        error: { code: 'INVALID_ARGUMENT' },
        result: null,
        status: 'error',
      });

      const humanComposition = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'composition'],
        consumerDirectory,
      );

      expect(humanComposition.status).toBe(0);
      expect(humanComposition.stderr).toBe('');
      expect(humanComposition.stdout).toContain(
        'The installed CLI composition state is valid.\nCLI version: 11.0.6\n',
      );

      const jsonComposition = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'composition', '--json'],
        consumerDirectory,
      );
      const compositionEnvelope = JSON.parse(jsonComposition.stdout) as {
        readonly command: string;
        readonly result: {
          readonly packages: readonly { readonly name: string; readonly version: string }[];
        };
        readonly status: string;
      };

      expect(jsonComposition.status).toBe(0);
      expect(jsonComposition.stderr).toBe('');
      expect(compositionEnvelope).toMatchObject({
        command: 'composition',
        status: 'valid',
      });
      expect(compositionEnvelope.result.packages).toStrictEqual(
        [
          CORE_PROJECT_DIRECTORY,
          REPOSITORY_PROJECT_DIRECTORY,
          REPOSITORY_FILESYSTEM_PROJECT_DIRECTORY,
        ].map((projectDirectory) => {
          const { name, version } = JSON.parse(
            readFileSync(path.join(projectDirectory, 'package.json'), 'utf8'),
          ) as IMoldeaCliPackageManifest;

          return { name, version };
        }),
      );

      const jsonUsageFailure = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', '--json'],
        consumerDirectory,
      );

      expect(jsonUsageFailure.status).toBe(2);
      expect(jsonUsageFailure.stderr).toBe('');
      expect(jsonUsageFailure.stdout).toBe(
        '{"cliVersion":"11.0.6","command":null,"error":{"code":"INVALID_ARGUMENT","details":{},"message":"The command invocation is invalid.","path":null,"retryable":false,"source":"cli"},"result":null,"schemaVersion":7,"status":"error"}\n',
      );

      const nonRepositoryCommand = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'inspect', '--json'],
        consumerDirectory,
        gitEnvironment,
      );

      expect(nonRepositoryCommand.status).toBe(3);
      expect(nonRepositoryCommand.stderr).toBe('');
      expect(nonRepositoryCommand.stdout).not.toContain(consumerDirectory);
      expect(nonRepositoryCommand.stdout).toContain('"code":"GIT_REPOSITORY_NOT_FOUND"');

      execFileSync(
        'git',
        ['-c', `core.hooksPath=${gitHooksDirectory}`, '-c', 'init.defaultBranch=main', 'init'],
        {
          cwd: consumerDirectory,
          encoding: 'utf8',
          env: gitEnvironment,
        },
      );
      execFileSync('git', ['config', '--local', 'core.sparseCheckout', 'false'], {
        cwd: consumerDirectory,
        encoding: 'utf8',
        env: gitEnvironment,
      });
      writeFileSync(
        path.join(consumerDirectory, '.gitignore'),
        '*\n!inventory-one.txt\n!inventory-two.txt\n',
        'utf8',
      );
      writeFileSync(path.join(consumerDirectory, 'inventory-one.txt'), 'one', 'utf8');
      writeFileSync(path.join(consumerDirectory, 'inventory-two.txt'), 'two', 'utf8');

      const discoveredRepositoryCommand = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'inspect', '--json'],
        consumerDirectory,
        gitEnvironment,
      );

      expect(discoveredRepositoryCommand.status).toBe(1);
      expect(discoveredRepositoryCommand.stderr).toBe('');
      expect(discoveredRepositoryCommand.stdout).not.toContain(consumerDirectory);
      expect(JSON.parse(discoveredRepositoryCommand.stdout)).toMatchObject({
        cliVersion: '11.0.6',
        command: 'inspect',
        result: {
          counts: { diagnostics: 3, errors: 2, warnings: 1, acceptedWarnings: 0 },
          formatVersion: null,
          page: {
            records: [{ kind: 'diagnostic' }, { kind: 'diagnostic' }, { kind: 'diagnostic' }],
          },
          project: null,
        },
        schemaVersion: 7,
        status: 'invalid',
      });

      const invalidValidationCommand = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'validate', '--json'],
        consumerDirectory,
        gitEnvironment,
      );

      expect(invalidValidationCommand.status).toBe(1);
      expect(invalidValidationCommand.stderr).toBe('');
      expect(invalidValidationCommand.stdout).not.toContain(consumerDirectory);
      expect(JSON.parse(invalidValidationCommand.stdout)).toMatchObject({
        cliVersion: '11.0.6',
        command: 'validate',
        result: {
          diagnosticCount: 3,
          formatVersion: null,
          page: {
            records: [{ kind: 'diagnostic' }, { kind: 'diagnostic' }, { kind: 'diagnostic' }],
          },
        },
        schemaVersion: 7,
        status: 'invalid',
      });

      const moldeaDirectory = path.join(consumerDirectory, 'moldea');
      const agentDirectory = path.join(moldeaDirectory, 'agents', 'assistant');

      mkdirSync(agentDirectory, { recursive: true });
      writeFileSync(
        path.join(moldeaDirectory, 'moldea.yaml'),
        JSON.stringify({
          version: 1,
          agents: {
            assistant: {
              runtime: { id: 'custom' },
              unresolved: Object.fromEntries(
                Array.from({ length: 4 }, (_, index) => [
                  `requirement-${index}`,
                  {
                    category: 'policy',
                    effect: 'blocking',
                    description: 'The policy needs an accepted decision.',
                    resolution: 'Record the accepted policy.',
                  },
                ]),
              ),
            },
          },
        }),
        'utf8',
      );
      writeFileSync(path.join(moldeaDirectory, 'project.md'), '# Project\n', 'utf8');
      writeFileSync(path.join(agentDirectory, 'description.md'), 'Assistant agent.\n', 'utf8');
      writeFileSync(
        path.join(agentDirectory, 'instruction.md'),
        'You are the `assistant` agent.\n',
        'utf8',
      );
      execFileSync(
        'git',
        [
          'add',
          '--force',
          '--',
          'moldea/moldea.yaml',
          'moldea/project.md',
          'moldea/agents/assistant/description.md',
          'moldea/agents/assistant/instruction.md',
        ],
        {
          cwd: consumerDirectory,
          encoding: 'utf8',
          env: gitEnvironment,
        },
      );

      const integrationTemplate =
        '<!-- moldea:start -->\nnode "<repo-root>/{{skill-path}}/scripts/relevance-gate.mjs" --repository "<repo-root>"\n<!-- moldea:end -->\n';
      for (const [name, content] of [
        ['AGENTS.md', integrationTemplate.replaceAll('{{skill-path}}', '.agents/skills/moldea')],
        ['.agents/skills/moldea/SKILL.md', '# Skill\n'],
        ['.agents/skills/moldea/scripts/relevance-gate.mjs', '// Gate\n'],
        ['.agents/skills/moldea/assets/managed-agents-block.md', integrationTemplate],
      ]) {
        const entryPath = path.join(consumerDirectory, name!);
        mkdirSync(path.dirname(entryPath), { recursive: true });
        writeFileSync(entryPath, content!);
        execFileSync('git', ['add', '--force', '--', name!], {
          cwd: consumerDirectory,
          env: gitEnvironment,
        });
      }

      const repositoryStatusBefore = execFileSync('git', ['status', '--porcelain=v2', '-z'], {
        cwd: consumerDirectory,
        encoding: 'buffer',
        env: gitEnvironment,
      });
      const repositoryExecutionMarker = path.join(testDirectory, 'repository-code-executed');

      if (process.platform !== 'win32') {
        const repositoryExecutablePath = path.join(testDirectory, 'repository-executable');

        writeFileSync(
          repositoryExecutablePath,
          `#!/usr/bin/env node
require('node:fs').writeFileSync(${JSON.stringify(repositoryExecutionMarker)}, 'executed');
process.exit(0);
`,
          'utf8',
        );
        chmodSync(repositoryExecutablePath, 0o755);
        writeFileSync(
          path.join(consumerDirectory, '.git', 'info', 'attributes'),
          'inventory-one.txt filter=moldea\n',
          'utf8',
        );
        execFileSync('git', ['config', '--local', 'core.fsmonitor', repositoryExecutablePath], {
          cwd: consumerDirectory,
          encoding: 'utf8',
          env: gitEnvironment,
        });
        execFileSync(
          'git',
          ['config', '--local', 'filter.moldea.process', repositoryExecutablePath],
          { cwd: consumerDirectory, encoding: 'utf8', env: gitEnvironment },
        );
      }

      const gitStateBeforeReadOnlyCommands = captureGitState(consumerDirectory, gitEnvironment);

      const validHumanValidationCommand = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'validate'],
        consumerDirectory,
        gitEnvironment,
      );

      expect(validHumanValidationCommand.status).toBe(0);
      expect(validHumanValidationCommand.stderr).toBe('');
      expect(validHumanValidationCommand.stdout).toBe(
        'The moldea project is valid.\nRepository format: 1\nCoverage: 0 bindings, 0 exports confirmed, 0 exports missing, 0 not checked\nDiagnostics: 0\nErrors: 0\nWarnings: 0\n0 accepted warnings\n',
      );

      const validJsonValidationCommand = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'validate', '--json'],
        consumerDirectory,
        gitEnvironment,
      );

      expect(validJsonValidationCommand.status).toBe(0);
      expect(validJsonValidationCommand.stderr).toBe('');
      expect(JSON.parse(validJsonValidationCommand.stdout)).toMatchObject({
        cliVersion: '11.0.6',
        command: 'validate',
        result: {
          diagnosticCount: 0,
          formatVersion: 1,
          page: { cursor: null, records: [] },
        },
        schemaVersion: 7,
        status: 'valid',
      });

      const validHumanInspectionCommand = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'inspect'],
        consumerDirectory,
        gitEnvironment,
      );

      expect(validHumanInspectionCommand.status).toBe(0);
      expect(validHumanInspectionCommand.stderr).toBe('');
      expect(validHumanInspectionCommand.stdout).toBe(
        `The moldea project is valid.
Repository format: 1
Coverage: 0 bindings, 0 exports confirmed, 0 exports missing, 0 not checked
0 accepted warnings
agents: 1
context: 0
decisions: 0
diagnostics: 0
errors: 0
coverage: 0
metadata: 4
mirrors: 0
runtimes: 0
unresolved: 4
warnings: 0
acceptedWarnings: 0
`,
      );

      const validJsonInspectionCommand = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'inspect', '--json'],
        consumerDirectory,
        gitEnvironment,
      );
      const validInspectionEnvelope = JSON.parse(validJsonInspectionCommand.stdout) as {
        readonly result: {
          readonly counts: Readonly<Record<string, number>>;
          readonly formatVersion: number | null;
          readonly page: { readonly cursor: string | null; readonly records: readonly unknown[] };
          readonly project: {
            readonly manifest: { readonly path: string };
            readonly project: { readonly path: string };
          } | null;
          readonly source: { readonly kind: string };
        };
        readonly status: string;
      };

      expect(validJsonInspectionCommand.status).toBe(0);
      expect(validJsonInspectionCommand.stderr).toBe('');
      expect(validInspectionEnvelope).toMatchObject({
        cliVersion: '11.0.6',
        command: 'inspect',
        error: null,
        result: {
          counts: {
            agents: 1,
            context: 0,
            decisions: 0,
            diagnostics: 0,
            coverage: 0,
            metadata: 4,
            mirrors: 0,
            runtimes: 0,
            unresolved: 4,
          },
          formatVersion: 1,
          page: {
            cursor: null,
            records: [
              { kind: 'metadata' },
              { kind: 'metadata' },
              { kind: 'metadata' },
              { kind: 'metadata' },
              { agentId: 'assistant', kind: 'agent', runtimeId: 'custom' },
            ],
          },
          project: {
            manifest: { path: '/moldea/moldea.yaml' },
            project: { path: '/moldea/project.md' },
          },
          source: { kind: 'git-working-tree' },
        },
        schemaVersion: 7,
        status: 'valid',
      });
      expect(validInspectionEnvelope.result.project).not.toBeNull();
      expect(validJsonInspectionCommand.stdout).not.toContain('# Project');
      expect(validJsonInspectionCommand.stdout).not.toContain('"content"');

      const unrelatedScopeCommand = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'scope', '--path', '/README.md', '--json'],
        consumerDirectory,
        gitEnvironment,
      );

      expect(unrelatedScopeCommand.status).toBe(0);
      expect(unrelatedScopeCommand.stderr).toBe('');
      expect(Buffer.byteLength(unrelatedScopeCommand.stdout, 'utf8')).toBeLessThanOrEqual(65_536);
      expect(JSON.parse(unrelatedScopeCommand.stdout)).toMatchObject({
        cliVersion: '11.0.6',
        command: 'scope',
        result: {
          counts: { declarations: 0, inputPaths: 1, matches: 0 },
          page: { cursor: null, records: [] },
          relevant: false,
          valid: true,
        },
        schemaVersion: 7,
        status: 'valid',
      });

      const stdinScopeCommand = spawnSync(
        process.execPath,
        [installedExecutablePath, 'scope', '--paths-stdin', '--json'],
        {
          cwd: consumerDirectory,
          encoding: 'utf8',
          env: gitEnvironment,
          input: Buffer.from('/README.md\0', 'utf8'),
        },
      );

      expect(stdinScopeCommand.status).toBe(0);
      expect(stdinScopeCommand.stderr).toBe('');
      expect(JSON.parse(stdinScopeCommand.stdout)).toMatchObject({
        command: 'scope',
        result: { relevant: false, valid: true },
        schemaVersion: 7,
      });

      for (const pathsInput of ['path', 'stdin'] as const) {
        const inputArguments =
          pathsInput === 'path' ? ['--path', 'src/private.ts'] : ['--paths-stdin'];
        const executionOptions = {
          cwd: consumerDirectory,
          encoding: 'utf8' as const,
          env: gitEnvironment,
          ...(pathsInput === 'stdin' ? { input: Buffer.from('/README.md\0src/private.ts\0') } : {}),
        };
        const invalidScope = spawnSync(
          process.execPath,
          [installedExecutablePath, 'scope', ...inputArguments, '--json'],
          executionOptions,
        );

        expect(invalidScope.status).toBe(3);
        expect(invalidScope.stderr).toBe('');
        expect(JSON.parse(invalidScope.stdout)).toStrictEqual({
          cliVersion: '11.0.6',
          command: 'scope',
          schemaVersion: 7,
          status: 'error',
          result: null,
          error: {
            code: 'PATH_INPUT_INVALID',
            details: {},
            path: null,
            retryable: false,
            source: 'cli',
            message:
              'The scope path input is invalid. Use leading-slash repository-logical paths and NUL-delimited UTF-8 on stdin.',
          },
        });
        const humanScope = spawnSync(
          process.execPath,
          [installedExecutablePath, 'scope', ...inputArguments],
          executionOptions,
        );
        expect(humanScope.status).toBe(3);
        expect(humanScope.stdout).toBe('');
        expect(humanScope.stderr).toContain(
          'The scope path input is invalid. Use leading-slash repository-logical paths and NUL-delimited UTF-8 on stdin.',
        );
        expect(humanScope.stderr).not.toContain('src/private.ts');
      }

      for (const input of ['', '/\0', '/src/😀.ts\0']) {
        const validScope = spawnSync(
          process.execPath,
          [installedExecutablePath, 'scope', '--paths-stdin', '--json'],
          {
            cwd: consumerDirectory,
            encoding: 'utf8',
            env: gitEnvironment,
            input,
          },
        );
        expect(validScope.status).toBe(0);
        expect(validScope.stderr).toBe('');
        expect(JSON.parse(validScope.stdout)).toMatchObject({
          error: null,
          status: 'valid',
          result: { valid: true },
        });
      }

      const explicitContentCommand = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'content', '--path', '/moldea/project.md', '--json'],
        consumerDirectory,
        gitEnvironment,
      );

      expect(explicitContentCommand.status).toBe(0);
      expect(explicitContentCommand.stderr).toBe('');
      expect(JSON.parse(explicitContentCommand.stdout)).toMatchObject({
        cliVersion: '11.0.6',
        command: 'content',
        result: {
          asset: { path: '/moldea/project.md' },
          chunk: { byteEnd: 10, byteStart: 0, content: '# Project\n' },
          cursor: null,
        },
        schemaVersion: 7,
        status: 'valid',
      });

      const unsafeWindowsContentCommand = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'content', '--path', 'C:\\private\\project.md', '--json'],
        consumerDirectory,
        gitEnvironment,
      );

      expect(unsafeWindowsContentCommand.status).toBe(3);
      expect(unsafeWindowsContentCommand.stderr).toBe('');
      expect(JSON.parse(unsafeWindowsContentCommand.stdout)).toMatchObject({
        command: 'content',
        error: { code: 'CONTENT_PATH_INVALID' },
        result: null,
        schemaVersion: 7,
        status: 'error',
      });

      const hostileEnvironmentInspection = spawnSync(
        process.execPath,
        [installedExecutablePath, 'inspect', '--json'],
        {
          cwd: consumerDirectory,
          encoding: 'utf8',
          env: {
            ...Object.fromEntries(
              Object.entries(gitEnvironment).filter(([name]) => name.toUpperCase() !== 'NO_COLOR'),
            ),
            FORCE_COLOR: '3',
            LANG: 'tr_TR.UTF-8',
            LC_ALL: 'tr_TR.UTF-8',
            TERM: 'xterm-256color',
            TZ: 'Pacific/Kiritimati',
          },
        },
      );

      expect(hostileEnvironmentInspection.status).toBe(0);
      expect(hostileEnvironmentInspection.stderr).toBe('');
      expect(hostileEnvironmentInspection.stdout).toBe(validJsonInspectionCommand.stdout);
      expect(hostileEnvironmentInspection.stdout).not.toContain('\u001b[');
      expect(captureGitState(consumerDirectory, gitEnvironment)).toStrictEqual(
        gitStateBeforeReadOnlyCommands,
      );
      expect(
        execFileSync(
          'git',
          [
            '-c',
            'core.fsmonitor=false',
            '-c',
            'submodule.recurse=false',
            'status',
            '--porcelain=v2',
            '-z',
          ],
          {
            cwd: consumerDirectory,
            encoding: 'buffer',
            env: gitEnvironment,
          },
        ),
      ).toStrictEqual(repositoryStatusBefore);
      expect(existsSync(repositoryExecutionMarker)).toBe(false);

      const contextDirectory = path.join(moldeaDirectory, 'context');
      const largeCanonicalBody = 'private-canonical-body-😀\n'.repeat(400);
      const contextNames = Array.from(
        { length: 32 },
        (_, index) => `context-${String(index).padStart(2, '0')}.md`,
      );
      const largeManifest = [
        'version: 1',
        'context:',
        ...contextNames.flatMap((contextName, index) => [
          `  /moldea/context/${contextName}:`,
          '    affectedBy:',
          `      - /src/${String(index).padStart(2, '0')}/**`,
        ]),
        'agents:',
        '  assistant:',
        '    runtime: { id: custom }',
        '',
      ].join('\n');

      mkdirSync(contextDirectory);
      writeFileSync(path.join(moldeaDirectory, 'moldea.yaml'), largeManifest, 'utf8');

      for (const contextName of contextNames) {
        writeFileSync(path.join(contextDirectory, contextName), largeCanonicalBody, 'utf8');
      }

      execFileSync('git', ['add', '--force', '--', 'moldea/moldea.yaml', 'moldea/context'], {
        cwd: consumerDirectory,
        encoding: 'utf8',
        env: gitEnvironment,
      });

      const largeGitStateBefore = captureGitState(consumerDirectory, gitEnvironment);
      const inspectedRecordKeys = new Set<string>();
      let inspectCursor: string | null = null;
      let inspectPageCount = 0;

      do {
        const arguments_ = [
          'exec',
          'moldea',
          'inspect',
          '--json',
          '--max-output-bytes',
          '4096',
          ...(inspectCursor === null ? [] : ['--cursor', inspectCursor]),
        ];
        const pageResult = spawnPackageManager(
          packageManagerEntrypoint,
          arguments_,
          consumerDirectory,
          gitEnvironment,
        );
        const envelope = JSON.parse(pageResult.stdout) as {
          readonly result: {
            readonly counts: { readonly context: number };
            readonly page: {
              readonly cursor: string | null;
              readonly records: readonly { readonly key: string }[];
            };
          };
        };

        expect(pageResult.status).toBe(0);
        expect(pageResult.stderr).toBe('');
        expect(Buffer.byteLength(pageResult.stdout, 'utf8')).toBeLessThanOrEqual(4096);
        expect(pageResult.stdout).not.toContain('private-canonical-body');
        expect(envelope.result.counts).toMatchObject({
          context: 32,
          warnings: 32,
          diagnostics: 32,
          errors: 0,
          acceptedWarnings: 0,
          coverage: 0,
        });

        for (const record of envelope.result.page.records) {
          expect(inspectedRecordKeys.has(record.key)).toBe(false);
          inspectedRecordKeys.add(record.key);
        }

        inspectCursor = envelope.result.page.cursor;
        inspectPageCount += 1;
      } while (inspectCursor !== null && inspectPageCount < 128);

      expect(inspectCursor).toBeNull();
      expect(inspectPageCount).toBeGreaterThan(1);
      expect(inspectedRecordKeys.size).toBe(69);

      const relevantScopeCommand = spawnPackageManager(
        packageManagerEntrypoint,
        [
          'exec',
          'moldea',
          'scope',
          '--path',
          '/src/00/feature.ts',
          '--json',
          '--max-output-bytes',
          '4096',
        ],
        consumerDirectory,
        gitEnvironment,
      );

      expect(relevantScopeCommand.status).toBe(0);
      expect(relevantScopeCommand.stderr).toBe('');
      expect(Buffer.byteLength(relevantScopeCommand.stdout, 'utf8')).toBeLessThanOrEqual(4096);
      expect(JSON.parse(relevantScopeCommand.stdout)).toMatchObject({
        command: 'scope',
        result: {
          counts: { declarations: 32, matchedPaths: 1, matches: 1 },
          page: { records: [{ kind: 'match' }] },
          relevant: true,
          valid: true,
        },
        schemaVersion: 7,
      });

      let contentCursor: string | null = null;
      let reconstructedContent = '';
      let contentPageCount = 0;

      do {
        const contentPage = spawnPackageManager(
          packageManagerEntrypoint,
          [
            'exec',
            'moldea',
            'content',
            '--path',
            '/moldea/context/context-00.md',
            '--json',
            '--max-output-bytes',
            '4096',
            ...(contentCursor === null ? [] : ['--cursor', contentCursor]),
          ],
          consumerDirectory,
          gitEnvironment,
        );
        const envelope = JSON.parse(contentPage.stdout) as {
          readonly result: {
            readonly chunk: { readonly content: string };
            readonly cursor: string | null;
          };
        };

        expect(contentPage.status).toBe(0);
        expect(contentPage.stderr).toBe('');
        expect(Buffer.byteLength(contentPage.stdout, 'utf8')).toBeLessThanOrEqual(4096);
        reconstructedContent += envelope.result.chunk.content;
        contentCursor = envelope.result.cursor;
        contentPageCount += 1;
      } while (contentCursor !== null && contentPageCount < 128);

      expect(contentCursor).toBeNull();
      expect(contentPageCount).toBeGreaterThan(1);
      expect(reconstructedContent).toBe(largeCanonicalBody);

      const staleCursorFirstPage = spawnPackageManager(
        packageManagerEntrypoint,
        [
          'exec',
          'moldea',
          'content',
          '--path',
          '/moldea/context/context-00.md',
          '--json',
          '--max-output-bytes',
          '4096',
        ],
        consumerDirectory,
        gitEnvironment,
      );
      const staleCursorEnvelope = JSON.parse(staleCursorFirstPage.stdout) as {
        readonly result: { readonly cursor: string | null };
      };
      const staleCursor = staleCursorEnvelope.result.cursor;

      if (staleCursor === null) {
        throw new TypeError('The first bounded content page must include a cursor.');
      }
      writeFileSync(
        path.join(contextDirectory, 'context-00.md'),
        `${largeCanonicalBody}changed\n`,
        'utf8',
      );

      const staleCursorResult = spawnPackageManager(
        packageManagerEntrypoint,
        [
          'exec',
          'moldea',
          'content',
          '--path',
          '/moldea/context/context-00.md',
          '--json',
          '--max-output-bytes',
          '4096',
          '--cursor',
          staleCursor,
        ],
        consumerDirectory,
        gitEnvironment,
      );

      expect(staleCursorResult.status).toBe(3);
      expect(staleCursorResult.stderr).toBe('');
      expect(JSON.parse(staleCursorResult.stdout)).toMatchObject({
        command: 'content',
        error: { code: 'CURSOR_SNAPSHOT_CHANGED', retryable: true },
        result: null,
        schemaVersion: 7,
        status: 'error',
      });
      writeFileSync(path.join(contextDirectory, 'context-00.md'), largeCanonicalBody, 'utf8');
      expect(captureGitState(consumerDirectory, gitEnvironment)).toStrictEqual(largeGitStateBefore);

      const inventoryLimitCommand = spawnPackageManager(
        packageManagerEntrypoint,
        ['exec', 'moldea', 'inspect', '--json', '--max-entries', '1'],
        consumerDirectory,
        gitEnvironment,
      );

      expect(inventoryLimitCommand.status).toBe(3);
      expect(inventoryLimitCommand.stderr).toBe('');
      expect(inventoryLimitCommand.stdout).toBe(
        '{"cliVersion":"11.0.6","command":"inspect","error":{"code":"RESOURCE_LIMIT_EXCEEDED","details":{},"message":"A resource limit was exceeded.","path":null,"retryable":false,"source":"cli"},"result":null,"schemaVersion":7,"status":"error"}\n',
      );

      const environmentWithoutPath = Object.fromEntries(
        Object.entries(gitEnvironment).filter(([name]) => name.toUpperCase() !== 'PATH'),
      );
      const missingGitResult = spawnSync(
        process.execPath,
        [installedExecutablePath, 'validate', '--json'],
        {
          cwd: consumerDirectory,
          encoding: 'utf8',
          env: {
            ...environmentWithoutPath,
            PATH: path.join(consumerDirectory, 'missing-executables'),
          },
        },
      );

      expect(missingGitResult.status).toBe(3);
      expect(missingGitResult.stderr).toBe('');
      expect(missingGitResult.stdout).toBe(
        '{"cliVersion":"11.0.6","command":"validate","error":{"code":"GIT_NOT_FOUND","details":{},"message":"The Git executable is unavailable.","path":null,"retryable":false,"source":"git"},"result":null,"schemaVersion":7,"status":"error"}\n',
      );

      const compositionWithoutGit = spawnSync(
        process.execPath,
        [installedExecutablePath, 'composition', '--json'],
        {
          cwd: consumerDirectory,
          encoding: 'utf8',
          env: {
            ...environmentWithoutPath,
            PATH: path.join(consumerDirectory, 'missing-executables'),
          },
        },
      );

      expect(compositionWithoutGit.status).toBe(0);
      expect(compositionWithoutGit.stderr).toBe('');
      expect(JSON.parse(compositionWithoutGit.stdout)).toMatchObject({
        command: 'composition',
        status: 'valid',
      });

      if (process.platform !== 'win32') {
        const fakeGitVersionDirectory = path.join(testDirectory, 'fake-git-version');
        const fakeGitVersionPath = path.join(fakeGitVersionDirectory, 'git');
        const realGitPath = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();

        mkdirSync(fakeGitVersionDirectory);
        writeFileSync(
          fakeGitVersionPath,
          `#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

if (process.argv.includes('--version')) {
  process.stdout.write(process.env.MOLDEA_TEST_GIT_VERSION_OUTPUT);
  process.exit(0);
}

const result = spawnSync(${JSON.stringify(realGitPath)}, process.argv.slice(2), {
  env: process.env,
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
`,
          'utf8',
        );
        chmodSync(fakeGitVersionPath, 0o755);

        for (const [versionOutput, errorCode] of [
          ['git version invalid\n', 'GIT_VERSION_INVALID'],
          ['git version 2.29.9\n', 'GIT_VERSION_UNSUPPORTED'],
        ] as const) {
          const versionFailure = spawnSync(
            process.execPath,
            [installedExecutablePath, 'validate', '--json'],
            {
              cwd: consumerDirectory,
              encoding: 'utf8',
              env: {
                ...gitEnvironment,
                MOLDEA_TEST_GIT_VERSION_OUTPUT: versionOutput,
                PATH: `${fakeGitVersionDirectory}${path.delimiter}${gitEnvironment['PATH'] ?? ''}`,
              },
            },
          );

          expect(versionFailure.status).toBe(3);
          expect(versionFailure.stderr).toBe('');
          expect(JSON.parse(versionFailure.stdout)).toMatchObject({
            command: 'validate',
            error: { code: errorCode, details: {}, path: null, source: 'git' },
            result: null,
            status: 'error',
          });
          expect(versionFailure.stdout).not.toContain(consumerDirectory);
        }

        const fakeGitDirectory = path.join(testDirectory, 'fake-git');
        const fakeGitPath = path.join(fakeGitDirectory, 'git');

        mkdirSync(fakeGitDirectory);
        writeFileSync(
          fakeGitPath,
          `#!/usr/bin/env node
const { writeFileSync } = require('node:fs');
process.on('SIGTERM', () => {
  writeFileSync(process.env.MOLDEA_TEST_GIT_STOPPED, 'stopped');
  process.exit(0);
});
writeFileSync(process.env.MOLDEA_TEST_GIT_STARTED, 'started');
setInterval(() => undefined, 1000);
`,
          'utf8',
        );
        chmodSync(fakeGitPath, 0o755);

        for (const [command, signal, exitCode] of [
          ['validate', 'SIGINT', 130],
          ['inspect', 'SIGTERM', 143],
        ] as const) {
          const startedPath = path.join(testDirectory, `${command}-git-started`);
          const stoppedPath = path.join(testDirectory, `${command}-git-stopped`);
          const signalResult = await executeInstalledSignalCase(
            installedExecutablePath,
            command,
            signal,
            consumerDirectory,
            {
              ...gitEnvironment,
              MOLDEA_TEST_GIT_STARTED: startedPath,
              MOLDEA_TEST_GIT_STOPPED: stoppedPath,
              PATH: `${fakeGitDirectory}${path.delimiter}${gitEnvironment['PATH'] ?? ''}`,
            },
            startedPath,
            stoppedPath,
          );

          expect(signalResult).toStrictEqual({ code: exitCode, stderr: '', stdout: '' });
        }
      }

      const installedCoreManifestPath = path.join(
        consumerDirectory,
        'node_modules',
        '@moldea.ai',
        'core',
        'package.json',
      );
      const installedCoreManifest = JSON.parse(
        readFileSync(installedCoreManifestPath, 'utf8'),
      ) as IMoldeaCliPackageManifest;
      const mismatchedCoreManifestPath = `${installedCoreManifestPath}.moldea-test`;

      writeFileSync(
        mismatchedCoreManifestPath,
        `${JSON.stringify({ ...installedCoreManifest, version: '0.0.2' }, null, 2)}\n`,
        'utf8',
      );
      renameSync(mismatchedCoreManifestPath, installedCoreManifestPath);

      const mismatchedDependencyResult = spawnSync(
        process.execPath,
        [installedExecutablePath, 'composition', '--json'],
        {
          cwd: consumerDirectory,
          encoding: 'utf8',
          env: {
            ...environmentWithoutPath,
            PATH: path.join(consumerDirectory, 'missing-executables'),
          },
        },
      );

      expect(mismatchedDependencyResult.status).toBe(3);
      expect(mismatchedDependencyResult.stderr).toBe('');
      expect(JSON.parse(mismatchedDependencyResult.stdout)).toMatchObject({
        command: 'composition',
        error: { code: 'COMPOSITION_STATE_INVALID' },
        result: null,
        status: 'error',
      });
    } finally {
      rmSync(testDirectory, { force: true, recursive: true });
    }
  }, 180_000);
});
