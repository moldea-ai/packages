// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { NPM_RELEASE_PROJECT_ORDER, NPM_RELEASE_PROJECTS } from './constants.ts';
import { createNpmReleaseWorkflowPlan } from './planning.ts';
import { loadNpmReleaseProjectChanges } from './project-changes.ts';
import type { INpmReleaseProject } from './types.ts';

let repositoryDirectory: string;

const runGit = (gitArguments: readonly string[], input?: string): string =>
  execFileSync('git', gitArguments, {
    cwd: repositoryDirectory,
    encoding: 'utf8',
    input,
  }).trim();

const writeRepositoryFile = async (filePath: string, content: string): Promise<void> => {
  const absolutePath = join(repositoryDirectory, filePath);

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, 'utf8');
};

const writeProjectManifest = async (
  project: INpmReleaseProject,
  version: string,
): Promise<void> => {
  const configuration = NPM_RELEASE_PROJECTS[project];

  await writeRepositoryFile(
    `${configuration.projectDirectory}/package.json`,
    `${JSON.stringify({ name: configuration.packageName, version, files: ['dist', 'README.md', 'LICENSE'] }, null, 2)}\n`,
  );
};

const writeWorkspaceManifest = async (
  directory: string,
  name: string,
  options: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    isPrivate?: boolean;
  } = {},
): Promise<void> => {
  await writeRepositoryFile(
    `${directory}/package.json`,
    `${JSON.stringify(
      {
        name,
        version: '1.0.0',
        ...(options.isPrivate ? { private: true } : { files: ['dist', 'README.md', 'LICENSE'] }),
        ...(options.dependencies === undefined ? {} : { dependencies: options.dependencies }),
        ...(options.devDependencies === undefined
          ? {}
          : { devDependencies: options.devDependencies }),
      },
      null,
      2,
    )}\n`,
  );
};

const commitIndex = (message: string): string => {
  runGit(['commit', '--quiet', '--no-gpg-sign', '--message', message]);

  return runGit(['rev-parse', 'HEAD']);
};

const commitWorktree = (message: string): string => {
  runGit(['add', '--all']);

  return commitIndex(message);
};

/**
 * Stages a synthetic Git tree entry without materializing an excluded path.
 * @param filePath The repository-relative tree path.
 * @param content The blob content associated with the path.
 */
const stageGitTreeFile = (filePath: string, content: string): void => {
  const blob = runGit(['hash-object', '-w', '--stdin'], content);

  runGit(['update-index', '--add', '--cacheinfo', `100644,${blob},${filePath}`]);
};

const loadChanges = (baseCommit: string, currentCommit: string) =>
  loadNpmReleaseProjectChanges(
    pathToFileURL(`${repositoryDirectory}${sep}`),
    baseCommit,
    currentCommit,
  );

const createPublishedVersions = (unpublishedProjects: readonly INpmReleaseProject[] = []) => {
  const unpublishedProjectSet = new Set(unpublishedProjects);

  return {
    'adapter-anthropic': unpublishedProjectSet.has('adapter-anthropic') ? [] : ['1.0.0'],
    'adapter-claude-agent-sdk': unpublishedProjectSet.has('adapter-claude-agent-sdk')
      ? []
      : ['1.0.0'],
    'adapter-google-genai': unpublishedProjectSet.has('adapter-google-genai') ? [] : ['1.0.0'],
    'adapter-openai': unpublishedProjectSet.has('adapter-openai') ? [] : ['1.0.0'],
    'adapter-openai-agents-sdk': unpublishedProjectSet.has('adapter-openai-agents-sdk')
      ? []
      : ['1.0.0'],
    'adapter-cloudflare-agents': unpublishedProjectSet.has('adapter-cloudflare-agents')
      ? []
      : ['1.0.0'],
    'adapter-eve': unpublishedProjectSet.has('adapter-eve') ? [] : ['1.0.0'],
    'adapter-langchain': unpublishedProjectSet.has('adapter-langchain') ? [] : ['1.0.0'],
    'adapter-langgraph': unpublishedProjectSet.has('adapter-langgraph') ? [] : ['1.0.0'],
    'adapter-vercel-ai-sdk': unpublishedProjectSet.has('adapter-vercel-ai-sdk') ? [] : ['1.0.0'],
    cli: unpublishedProjectSet.has('cli') ? [] : ['1.0.0'],
    core: unpublishedProjectSet.has('core') ? [] : ['1.0.0'],
    repository: unpublishedProjectSet.has('repository') ? [] : ['1.0.0'],
    'repository-fs': unpublishedProjectSet.has('repository-fs') ? [] : ['1.0.0'],
    'website-ui': unpublishedProjectSet.has('website-ui') ? [] : ['1.0.0'],
  };
};

beforeEach(async () => {
  repositoryDirectory = await mkdtemp(join(tmpdir(), 'moldea-npm-release-'));
  runGit(['init', '--quiet', '--initial-branch', 'main']);
  runGit(['config', 'user.email', 'npm-release-test@moldea.ai']);
  runGit(['config', 'user.name', 'npm release test']);
  runGit(['config', 'commit.gpgSign', 'false']);

  await Promise.all(
    NPM_RELEASE_PROJECT_ORDER.map((project) => writeProjectManifest(project, '1.0.0')),
  );
  commitWorktree('test: initialize package manifests');
});

afterEach(async () => {
  await rm(repositoryDirectory, { force: true, recursive: true });
});

describe('npm release project changes', () => {
  test('selects public consumers of a changed private development dependency without selecting CLI', async () => {
    await writeWorkspaceManifest(
      'packages/adapter-static-analysis',
      '@moldea.ai/adapter-static-analysis',
      {
        isPrivate: true,
      },
    );
    await writeWorkspaceManifest('projects/adapter-anthropic', '@moldea.ai/adapter-anthropic', {
      devDependencies: { '@moldea.ai/adapter-static-analysis': 'workspace:*' },
    });
    await writeWorkspaceManifest('projects/adapter-openai', '@moldea.ai/adapter-openai', {
      devDependencies: { '@moldea.ai/adapter-static-analysis': 'workspace:*' },
    });
    const baseCommit = commitWorktree('test: establish bundled private input');

    await writeRepositoryFile(
      'packages/adapter-static-analysis/src/index.ts',
      'export const token = 2;\n',
    );
    const currentCommit = commitWorktree('feat(static-analysis): change bundled source');
    const changes = await loadChanges(baseCommit, currentCommit);

    expect(changes['adapter-anthropic'].isChanged).toBe(true);
    expect(changes['adapter-openai'].isChanged).toBe(true);
    expect(changes.cli.isChanged).toBe(false);
    expect(() =>
      createNpmReleaseWorkflowPlan({
        eventName: 'push',
        mode: '',
        project: '',
        projectChanges: changes,
        publishedVersions: createPublishedVersions(),
      }),
    ).toThrow('must declare a greater stable package version');
  });

  test('propagates through private dependencies and both sides of a package move', async () => {
    await writeWorkspaceManifest('packages/source', '@moldea.ai/source', { isPrivate: true });
    await writeWorkspaceManifest('packages/bundle', '@moldea.ai/bundle', {
      devDependencies: { '@moldea.ai/source': 'workspace:*' },
      isPrivate: true,
    });
    await writeWorkspaceManifest('projects/adapter-eve', '@moldea.ai/adapter-eve', {
      dependencies: { '@moldea.ai/bundle': 'workspace:*' },
    });
    const baseCommit = commitWorktree('test: establish private dependency chain');

    await rm(join(repositoryDirectory, 'packages/source'), { recursive: true });
    await writeWorkspaceManifest('packages/renamed-source', '@moldea.ai/source', {
      isPrivate: true,
    });
    const currentCommit = commitWorktree('refactor(source): move private package');

    expect((await loadChanges(baseCommit, currentCommit))['adapter-eve'].isChanged).toBe(true);
  });

  test('selects a consumer when its private input is replaced', async () => {
    await writeWorkspaceManifest('packages/first', '@moldea.ai/first', { isPrivate: true });
    await writeWorkspaceManifest('packages/bundle', '@moldea.ai/bundle', {
      devDependencies: { '@moldea.ai/first': 'workspace:*' },
      isPrivate: true,
    });
    await writeWorkspaceManifest('projects/adapter-eve', '@moldea.ai/adapter-eve', {
      devDependencies: { '@moldea.ai/bundle': 'workspace:*' },
    });
    const baseCommit = commitWorktree('test: establish replaceable private input');

    await rm(join(repositoryDirectory, 'packages/first'), { recursive: true });
    await writeWorkspaceManifest('packages/second', '@moldea.ai/second', { isPrivate: true });
    await writeWorkspaceManifest('packages/bundle', '@moldea.ai/bundle', {
      devDependencies: { '@moldea.ai/second': 'workspace:*' },
      isPrivate: true,
    });
    const currentCommit = commitWorktree('refactor(bundle): replace private input');

    expect((await loadChanges(baseCommit, currentCommit))['adapter-eve'].isChanged).toBe(true);
  });

  test('rejects missing and cyclic private workspace graphs', async () => {
    const baseCommit = runGit(['rev-parse', 'HEAD']);

    await writeWorkspaceManifest('projects/adapter-eve', '@moldea.ai/adapter-eve', {
      devDependencies: { '@moldea.ai/missing': 'workspace:*' },
    });
    const missingCommit = commitWorktree('test: introduce missing workspace dependency');
    await expect(loadChanges(baseCommit, missingCommit)).rejects.toThrow(
      '@moldea.ai/missing workspace dependency is missing',
    );

    await writeWorkspaceManifest('packages/first', '@moldea.ai/first', {
      devDependencies: { '@moldea.ai/second': 'workspace:*' },
      isPrivate: true,
    });
    await writeWorkspaceManifest('packages/second', '@moldea.ai/second', {
      devDependencies: { '@moldea.ai/first': 'workspace:*' },
      isPrivate: true,
    });
    await writeProjectManifest('adapter-eve', '1.0.0');
    const cyclicCommit = commitWorktree('test: introduce private workspace cycle');
    await expect(loadChanges(baseCommit, cyclicCommit)).rejects.toThrow(
      'private workspace dependency graph is cyclic',
    );
  });

  test('rejects duplicate committed workspace package identities', async () => {
    const baseCommit = runGit(['rev-parse', 'HEAD']);

    await writeWorkspaceManifest('packages/first', '@moldea.ai/shared', { isPrivate: true });
    await writeWorkspaceManifest('packages/second', '@moldea.ai/shared', { isPrivate: true });
    const currentCommit = commitWorktree('test: duplicate private package identity');

    await expect(loadChanges(baseCommit, currentCommit)).rejects.toThrow(
      '@moldea.ai/shared workspace package is duplicated',
    );
  });

  test('selects shared library configuration but ignores its test-only changes', async () => {
    const baseCommit = runGit(['rev-parse', 'HEAD']);

    await writeRepositoryFile('configs/vite/library.config.test-unit.ts', 'export {};\n');
    const testCommit = commitWorktree('test(vite): add shared config coverage');
    expect(
      Object.values(await loadChanges(baseCommit, testCommit)).some((change) => change.isChanged),
    ).toBe(false);

    await writeRepositoryFile('configs/typescript/base.json', '{"compilerOptions":{}}\n');
    const configCommit = commitWorktree('fix(typescript): change shared build configuration');
    expect(
      Object.values(await loadChanges(testCommit, configCommit)).every(
        (change) => change.isChanged,
      ),
    ).toBe(true);

    await writeRepositoryFile(
      'configs/vite/library.config.ts',
      'export const target = "es2023";\n',
    );
    const viteCommit = commitWorktree('fix(vite): change shared library build');
    expect(
      Object.values(await loadChanges(configCommit, viteCommit)).every(
        (change) => change.isChanged,
      ),
    ).toBe(true);
  });

  test('ignores test and nonshipped documentation changes within a private package', async () => {
    await writeWorkspaceManifest(
      'packages/adapter-static-analysis',
      '@moldea.ai/adapter-static-analysis',
      {
        isPrivate: true,
      },
    );
    await writeWorkspaceManifest('projects/adapter-anthropic', '@moldea.ai/adapter-anthropic', {
      devDependencies: { '@moldea.ai/adapter-static-analysis': 'workspace:*' },
    });
    const baseCommit = commitWorktree('test: establish private development input');

    await writeRepositoryFile(
      'packages/adapter-static-analysis/src/index.test-unit.ts',
      'export {};\n',
    );
    await writeRepositoryFile('packages/adapter-static-analysis/docs/guide.md', '# Guide\n');
    const currentCommit = commitWorktree('test(static-analysis): change unshipped inputs');

    expect((await loadChanges(baseCommit, currentCommit))['adapter-anthropic'].isChanged).toBe(
      false,
    );
  });

  test('matches private source selection to changed real packed adapter behavior', async () => {
    const { build } = await import('vite');
    await writeWorkspaceManifest(
      'packages/adapter-static-analysis',
      '@moldea.ai/adapter-static-analysis',
      {
        isPrivate: true,
      },
    );
    await writeWorkspaceManifest('projects/adapter-anthropic', '@moldea.ai/adapter-anthropic', {
      devDependencies: { '@moldea.ai/adapter-static-analysis': 'workspace:*' },
    });
    await writeRepositoryFile(
      'projects/adapter-anthropic/src/index.ts',
      "import { token } from '../../../packages/adapter-static-analysis/src/index.js';\nexport const getToken = () => token;\n",
    );
    await writeRepositoryFile(
      'packages/adapter-static-analysis/src/index.ts',
      "export const token = 'before';\n",
    );
    const baseCommit = commitWorktree('test: establish packed private input');
    const projectDirectory = join(repositoryDirectory, 'projects/adapter-anthropic');
    const packDirectory = join(repositoryDirectory, 'artifacts');

    const buildAndPack = async (label: string): Promise<Buffer> => {
      const destination = join(packDirectory, label);
      await mkdir(destination, { recursive: true });
      await build({
        configFile: false,
        root: projectDirectory,
        build: {
          emptyOutDir: true,
          lib: { entry: join(projectDirectory, 'src/index.ts'), formats: ['es'] },
          outDir: join(projectDirectory, 'dist'),
        },
      });
      const npmArguments = [
        'pack',
        '--ignore-scripts',
        '--json',
        '--pack-destination',
        destination,
      ];
      // npm.cmd cannot be launched through execFileSync on Windows
      const npmCliPath = join(
        dirname(process.execPath),
        'node_modules',
        'npm',
        'bin',
        'npm-cli.js',
      );
      const output = execFileSync(
        process.platform === 'win32' ? process.execPath : 'npm',
        process.platform === 'win32' ? [npmCliPath, ...npmArguments] : npmArguments,
        { cwd: projectDirectory, encoding: 'utf8' },
      );
      const artifacts = JSON.parse(output) as { filename: string }[];
      const artifact = artifacts[0];

      if (artifact === undefined) {
        throw new Error('The test package tarball was not created.');
      }

      return readFile(join(destination, artifact.filename));
    };

    const beforeArtifact = await buildAndPack('before');
    await rm(join(projectDirectory, 'dist'), { recursive: true });
    await rm(packDirectory, { recursive: true });
    await writeRepositoryFile(
      'packages/adapter-static-analysis/src/index.ts',
      "export const token = 'after';\n",
    );
    const currentCommit = commitWorktree('feat(static-analysis): change shipped adapter input');
    const afterArtifact = await buildAndPack('after');
    const changes = await loadChanges(baseCommit, currentCommit);

    expect(afterArtifact).not.toStrictEqual(beforeArtifact);
    expect(gunzipSync(beforeArtifact).includes(Buffer.from('before'))).toBe(true);
    expect(gunzipSync(beforeArtifact).includes(Buffer.from('after'))).toBe(false);
    expect(gunzipSync(afterArtifact).includes(Buffer.from('after'))).toBe(true);
    expect(gunzipSync(afterArtifact).includes(Buffer.from('before'))).toBe(false);
    expect(changes['adapter-anthropic'].isChanged).toBe(true);
    expect(changes.cli.isChanged).toBe(false);
  });

  test('loads committed versions and detects only the changed public project', async () => {
    const baseCommit = runGit(['rev-parse', 'HEAD']);

    await writeProjectManifest('core', '1.0.1');
    await writeRepositoryFile('projects/core/src/change.ts', 'export const change = true;\n');

    const currentCommit = commitWorktree('feat(core): change the package');
    const changes = await loadChanges(baseCommit, currentCommit);

    expect(changes).toStrictEqual({
      'adapter-anthropic': {
        currentVersion: '1.0.0',
        isChanged: false,
        previousVersion: '1.0.0',
      },
      'adapter-claude-agent-sdk': {
        currentVersion: '1.0.0',
        isChanged: false,
        previousVersion: '1.0.0',
      },
      'adapter-google-genai': {
        currentVersion: '1.0.0',
        isChanged: false,
        previousVersion: '1.0.0',
      },
      'adapter-openai': {
        currentVersion: '1.0.0',
        isChanged: false,
        previousVersion: '1.0.0',
      },
      'adapter-openai-agents-sdk': {
        currentVersion: '1.0.0',
        isChanged: false,
        previousVersion: '1.0.0',
      },
      'adapter-cloudflare-agents': {
        currentVersion: '1.0.0',
        isChanged: false,
        previousVersion: '1.0.0',
      },
      'adapter-eve': {
        currentVersion: '1.0.0',
        isChanged: false,
        previousVersion: '1.0.0',
      },
      'adapter-langchain': {
        currentVersion: '1.0.0',
        isChanged: false,
        previousVersion: '1.0.0',
      },
      'adapter-langgraph': {
        currentVersion: '1.0.0',
        isChanged: false,
        previousVersion: '1.0.0',
      },
      'adapter-vercel-ai-sdk': {
        currentVersion: '1.0.0',
        isChanged: false,
        previousVersion: '1.0.0',
      },
      cli: { currentVersion: '1.0.0', isChanged: false, previousVersion: '1.0.0' },
      core: { currentVersion: '1.0.1', isChanged: true, previousVersion: '1.0.0' },
      repository: { currentVersion: '1.0.0', isChanged: false, previousVersion: '1.0.0' },
      'repository-fs': {
        currentVersion: '1.0.0',
        isChanged: false,
        previousVersion: '1.0.0',
      },
      'website-ui': {
        currentVersion: '1.0.0',
        isChanged: false,
        previousVersion: '1.0.0',
      },
    });
  });

  test('selects a newly introduced public project without a base package version', async () => {
    const projectDirectory = NPM_RELEASE_PROJECTS['adapter-claude-agent-sdk'].projectDirectory;

    await rm(join(repositoryDirectory, projectDirectory), { recursive: true });
    const baseCommit = commitWorktree('test: establish the tree before the new project');

    await writeProjectManifest('adapter-claude-agent-sdk', '1.0.0');
    await writeRepositoryFile(`${projectDirectory}/src/index.ts`, 'export const adapter = true;\n');

    const currentCommit = commitWorktree('feat(adapter-claude-agent-sdk): introduce the project');
    const projectChanges = await loadChanges(baseCommit, currentCommit);
    const plan = createNpmReleaseWorkflowPlan({
      eventName: 'push',
      mode: '',
      project: '',
      projectChanges,
      publishedVersions: createPublishedVersions(['adapter-claude-agent-sdk']),
    });

    expect(projectChanges['adapter-claude-agent-sdk']).toStrictEqual({
      currentVersion: '1.0.0',
      isChanged: true,
      previousVersion: null,
    });
    expect(plan).toStrictEqual({
      mode: 'trusted',
      previousVersions: {
        'adapter-anthropic': null,
        'adapter-claude-agent-sdk': null,
        'adapter-google-genai': null,
        'adapter-openai': null,
        'adapter-openai-agents-sdk': null,
        'adapter-cloudflare-agents': null,
        'adapter-eve': null,
        'adapter-langchain': null,
        'adapter-langgraph': null,
        'adapter-vercel-ai-sdk': null,
        cli: null,
        core: null,
        repository: null,
        'repository-fs': null,
        'website-ui': null,
      },
      projects: ['adapter-claude-agent-sdk'],
      trigger: 'automatic',
    });
  });

  test('ignores archived and backup-only Git tree changes', async () => {
    const baseCommit = runGit(['rev-parse', 'HEAD']);

    stageGitTreeFile('projects/core/_archive/legacy.ts', 'legacy');
    stageGitTreeFile('projects/core/nested/_backups/legacy.ts', 'backup');
    stageGitTreeFile('packages/_archive/package.json', '{"name":"@moldea.ai/core"}');
    stageGitTreeFile('configs/typescript/_backup/legacy.json', '{}');

    const currentCommit = commitIndex('test: add excluded Git tree entries');
    const changes = await loadChanges(baseCommit, currentCommit);

    expect(Object.values(changes).every((change) => !change.isChanged)).toBe(true);
  });

  test.each(NPM_RELEASE_PROJECT_ORDER)(
    'ignores package-owned full documentation for %s',
    async (project) => {
      const baseCommit = runGit(['rev-parse', 'HEAD']);
      const projectDirectory = NPM_RELEASE_PROJECTS[project].projectDirectory;

      await writeRepositoryFile(`${projectDirectory}/docs/concepts.md`, '# Package concepts\n');

      const currentCommit = commitWorktree(`docs(${project}): add full documentation`);
      const changes = await loadChanges(baseCommit, currentCommit);

      expect(changes[project].isChanged).toBe(false);
    },
  );

  test.each([
    ['explicit docs directory', ['dist', 'docs'], true],
    ['relative docs directory', ['./docs'], true],
    ['nested docs pattern', ['docs/**/*.md'], true],
    ['individual document', ['docs/index.md'], true],
    ['root wildcard', ['**/*.md'], true],
    ['default npm inventory', undefined, true],
    ['runtime-only inventory', ['dist/**', 'README.md'], false],
  ] as const)('classifies documentation using %s', async (_description, files, isChanged) => {
    await writeRepositoryFile(
      'projects/core/package.json',
      JSON.stringify({
        name: '@moldea.ai/core',
        version: '1.0.0',
        files,
      }),
    );
    const baseCommit = commitWorktree('test: configure package file selection');
    await writeRepositoryFile('projects/core/docs/index.md', '# Local guide\n');
    const currentCommit = commitWorktree('docs(core): add a guide');
    const changes = await loadChanges(baseCommit, currentCommit);
    expect(changes.core.isChanged).toBe(isChanged);
    if (isChanged) {
      expect(() =>
        createNpmReleaseWorkflowPlan({
          eventName: 'push',
          mode: '',
          project: '',
          projectChanges: changes,
          publishedVersions: createPublishedVersions(),
        }),
      ).toThrow('must declare a greater stable package version');
    }
  });

  test.each(['modify', 'delete'] as const)('selects a shipped-document %s', async (operation) => {
    await writeRepositoryFile(
      'projects/adapter-eve/package.json',
      JSON.stringify({
        name: '@moldea.ai/adapter-eve',
        version: '1.0.0',
        files: ['dist', 'docs'],
      }),
    );
    await writeRepositoryFile('projects/adapter-eve/docs/index.md', '# Original guide\n');
    const baseCommit = commitWorktree('test: establish shipped documentation');
    if (operation === 'delete') {
      await rm(join(repositoryDirectory, 'projects/adapter-eve/docs/index.md'));
    } else {
      await writeRepositoryFile('projects/adapter-eve/docs/index.md', '# Corrected guide\n');
    }
    const currentCommit = commitWorktree(`docs(adapter-eve): ${operation} guide`);
    expect((await loadChanges(baseCommit, currentCommit))['adapter-eve'].isChanged).toBe(true);
  });

  test('rejects malformed npm file selection instead of silently excluding docs', async () => {
    const baseCommit = runGit(['rev-parse', 'HEAD']);
    await writeRepositoryFile(
      'projects/core/package.json',
      JSON.stringify({
        name: '@moldea.ai/core',
        version: '1.0.1',
        files: [42],
      }),
    );
    const currentCommit = commitWorktree('test: invalidate file selection');
    await expect(loadChanges(baseCommit, currentCommit)).rejects.toThrow(
      'package file selection is invalid',
    );
  });

  test.each(NPM_RELEASE_PROJECT_ORDER)(
    'ignores standardized package test and fixture files for %s',
    async (project) => {
      const baseCommit = runGit(['rev-parse', 'HEAD']);
      const projectDirectory = NPM_RELEASE_PROJECTS[project].projectDirectory;

      await Promise.all([
        writeRepositoryFile(`${projectDirectory}/src/change.test-unit.ts`, 'export {};\n'),
        writeRepositoryFile(`${projectDirectory}/src/change.test-integration.ts`, 'export {};\n'),
        writeRepositoryFile(`${projectDirectory}/src/change.test-e2e.ts`, 'export {};\n'),
        writeRepositoryFile(`${projectDirectory}/src/change.test-bench.ts`, 'export {};\n'),
        writeRepositoryFile(`${projectDirectory}/src/change.test-fixtures.ts`, 'export {};\n'),
      ]);

      const currentCommit = commitWorktree(`test: change ${project} package tests`);
      const changes = await loadChanges(baseCommit, currentCommit);

      expect(changes[project].isChanged).toBe(false);
    },
  );

  test.each([
    ['README.md', '# Repository\n'],
    ['package.json', null],
    ['src/change.ts', 'export const change = true;\n'],
  ] as const)('keeps repository %s changes release-relevant', async (filePath, content) => {
    const baseCommit = runGit(['rev-parse', 'HEAD']);

    if (filePath === 'package.json') {
      await writeProjectManifest('repository', '1.0.1');
    } else {
      await writeRepositoryFile(`projects/repository/${filePath}`, content ?? '');
    }

    const currentCommit = commitWorktree(`test: change repository ${filePath}`);
    const changes = await loadChanges(baseCommit, currentCommit);

    expect(changes.repository.isChanged).toBe(true);
  });

  test('keeps a project release-relevant when documentation and source change together', async () => {
    const baseCommit = runGit(['rev-parse', 'HEAD']);

    await writeRepositoryFile('projects/repository/docs/concepts.md', '# Concepts\n');
    await writeRepositoryFile('projects/repository/src/change.ts', 'export const change = true;\n');

    const currentCommit = commitWorktree('feat(repository): change source with documentation');
    const changes = await loadChanges(baseCommit, currentCommit);

    expect(changes.repository.isChanged).toBe(true);
  });

  test('feeds a real project change into version-bump validation', async () => {
    const baseCommit = runGit(['rev-parse', 'HEAD']);

    await writeRepositoryFile('projects/repository/README.md', '# Repository\n');

    const currentCommit = commitWorktree('docs(repository): change package documentation');
    const projectChanges = await loadChanges(baseCommit, currentCommit);

    expect(() =>
      createNpmReleaseWorkflowPlan({
        eventName: 'push',
        mode: '',
        project: '',
        projectChanges,
        publishedVersions: createPublishedVersions(),
      }),
    ).toThrow('must declare a greater stable package version');
  });

  test('rejects a missing committed package manifest', async () => {
    const baseCommit = runGit(['rev-parse', 'HEAD']);

    await rm(join(repositoryDirectory, 'projects/cli/package.json'));

    const currentCommit = commitWorktree('test: remove a package manifest');

    await expect(loadChanges(baseCommit, currentCommit)).rejects.toThrow(
      'projects/cli/package.json file could not be read',
    );
  });

  test('rejects malformed committed package metadata', async () => {
    const baseCommit = runGit(['rev-parse', 'HEAD']);

    await writeRepositoryFile('projects/repository-fs/package.json', '[]\n');

    const currentCommit = commitWorktree('test: invalidate package metadata');

    await expect(loadChanges(baseCommit, currentCommit)).rejects.toThrow(
      '@moldea.ai/repository-fs package manifest is invalid',
    );
  });
});
