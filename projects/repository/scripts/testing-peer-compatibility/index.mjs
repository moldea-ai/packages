import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const EXPECTED_PNPM_VERSION = '11.9.0';
const EXPECTED_REPOSITORY_VERSION = '1.1.1';
const EXPECTED_VITEST_VERSIONS = new Set(['1.0.0', '2.0.0', '3.2.4', '4.1.10']);
const EXPECTED_WEB_UTILS_KIT_VERSION = '1.3.1';
const PEER_WARNING_PATTERN = /(?:unmet peer|peer dependenc(?:y|ies)|ERR_PNPM_PEER_DEP_ISSUES)/iu;

/** Requires one invariant from the packed-consumer compatibility check. */
const assertCompatibilityInvariant = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

/** Selects one unambiguous Repository tarball from the prepared artifact directory. */
const selectRepositoryTarball = async (artifactDirectory) => {
  const tarballNames = await readdir(artifactDirectory);
  const matchingNames = tarballNames.filter((tarballName) =>
    /^moldea\.ai-repository-(?!fs-).+\.tgz$/u.test(tarballName),
  );

  assertCompatibilityInvariant(
    matchingNames.length === 1 && matchingNames[0] !== undefined,
    'Expected exactly one @moldea.ai/repository tarball.',
  );

  return path.join(artifactDirectory, matchingNames[0]);
};

/** Executes a child process and returns its captured text after a successful exit. */
const executeCommand = (executable, arguments_, options) => {
  const result = spawnSync(executable, arguments_, {
    ...options,
    encoding: 'utf8',
  });

  if (result.error !== undefined || result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${executable} ${arguments_.join(' ')}`,
        result.error?.message,
        result.stdout,
        result.stderr,
      ]
        .filter((part) => typeof part === 'string' && part.length > 0)
        .join('\n'),
    );
  }

  return `${result.stdout}${result.stderr}`;
};

/** Determines whether an isolated lifecycle sentinel was created. */
const pathExists = async (candidatePath) => {
  try {
    await access(candidatePath);
    return true;
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
};

/** Resolves the installed Vitest executable without accepting an escaping bin path. */
const resolveVitestExecutable = async (consumerDirectory) => {
  const vitestDirectory = path.join(consumerDirectory, 'node_modules', 'vitest');
  const manifest = JSON.parse(await readFile(path.join(vitestDirectory, 'package.json'), 'utf8'));
  const executableEntry =
    typeof manifest.bin === 'string'
      ? manifest.bin
      : manifest.bin !== null && typeof manifest.bin === 'object'
        ? manifest.bin.vitest
        : undefined;

  assertCompatibilityInvariant(
    typeof executableEntry === 'string' && executableEntry.length > 0,
    'The installed Vitest package does not expose its executable.',
  );
  const executablePath = path.resolve(vitestDirectory, executableEntry);
  const relativeExecutablePath = path.relative(vitestDirectory, executablePath);

  assertCompatibilityInvariant(
    relativeExecutablePath !== '' &&
      relativeExecutablePath !== '..' &&
      !relativeExecutablePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeExecutablePath),
    'The installed Vitest executable escapes its package directory.',
  );

  return executablePath;
};

/** Creates the packed-consumer suite that exercises the public Repository conformance helper. */
const createConformanceSuite = () => `// @vitest-environment node
import {
  REPOSITORY_ROOT,
  RepositoryPathException,
  RepositorySourceException,
  parseRepositoryPath,
} from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';
import { describeRepositoryReaderConformance } from '@moldea.ai/repository/testing';

const createEntries = () => [
  { content: 'upper', path: '/Case.txt', type: 'file' },
  { content: '# Consumer\\n', path: '/README.md', type: 'file' },
  { content: 'lower', path: '/case.txt', type: 'file' },
  { content: new Uint8Array(), path: '/empty.bin', type: 'file' },
  { path: '/link', type: 'symlink' },
  { content: new Uint8Array([0, 1, 13, 10, 128, 255]), path: '/nested/deep/data.bin', type: 'file' },
  { path: '/nested/empty', type: 'directory' },
  { content: 'unicode', path: '/unicode/café-😀.txt', type: 'file' },
];

const expectedEntries = [
  { path: parseRepositoryPath('/Case.txt'), type: 'file' },
  { path: parseRepositoryPath('/README.md'), type: 'file' },
  { path: parseRepositoryPath('/case.txt'), type: 'file' },
  { path: parseRepositoryPath('/empty.bin'), type: 'file' },
  { path: parseRepositoryPath('/link'), type: 'symlink' },
  { path: parseRepositoryPath('/nested'), type: 'directory' },
  { path: parseRepositoryPath('/nested/deep'), type: 'directory' },
  { path: parseRepositoryPath('/nested/deep/data.bin'), type: 'file' },
  { path: parseRepositoryPath('/nested/empty'), type: 'directory' },
  { path: parseRepositoryPath('/unicode'), type: 'directory' },
  { path: parseRepositoryPath('/unicode/café-😀.txt'), type: 'file' },
];

describeRepositoryReaderConformance('packed consumer', {
  casePaths: { kind: 'distinct', paths: ['/Case.txt', '/case.txt'] },
  createReader: () => createMemoryRepositoryReader(createEntries()),
  createSnapshotMutationFixture: () => {
    const entries = createEntries();
    const fileEntry = entries.find((entry) => entry.path === '/nested/deep/data.bin');
    const content = fileEntry?.content;

    if (!(content instanceof Uint8Array)) {
      throw new Error('The snapshot-mutation fixture file is missing exact byte content.');
    }

    const reader = createMemoryRepositoryReader(entries);

    return {
      behavior: 'preserve-snapshot',
      mutateSource: () => {
        content.fill(99);
        entries.length = 0;
      },
      reader,
    };
  },
  emptyFilePath: '/empty.bin',
  expectedEntries,
  fileBytes: new Uint8Array([0, 1, 13, 10, 128, 255]),
  filePath: '/nested/deep/data.bin',
  isRepositoryPathException: (cause) => cause instanceof RepositoryPathException,
  isRepositorySourceException: (cause) => cause instanceof RepositorySourceException,
  missingPath: '/missing.txt',
  nestedDirectoryPath: '/nested',
  nestedExpectedPaths: ['/nested/deep', '/nested/deep/data.bin', '/nested/empty'],
  parsePath: parseRepositoryPath,
  rootPath: REPOSITORY_ROOT,
  symlinkPath: '/link',
  unicodePath: '/unicode/café-😀.txt',
});
`;

/** Installs and exercises one named Vitest version against the packed Repository package. */
const runTestingPeerCompatibilityCheck = async (artifactDirectory, vitestVersion) => {
  assertCompatibilityInvariant(
    EXPECTED_VITEST_VERSIONS.has(vitestVersion),
    `Unsupported Repository testing-peer matrix value: ${vitestVersion}.`,
  );
  const repositoryTarball = await selectRepositoryTarball(artifactDirectory);
  const consumerDirectory = await mkdtemp(path.join(tmpdir(), 'moldea-repository-peer-consumer-'));
  const homeDirectory = path.join(consumerDirectory, '.home');
  const configDirectory = path.join(consumerDirectory, '.config');
  const storeDirectory = path.join(consumerDirectory, '.pnpm-store');
  const lifecycleMarkerPath = path.join(consumerDirectory, 'lifecycle-executed');
  const pnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const environment = {
    ...process.env,
    CI: 'true',
    HOME: homeDirectory,
    XDG_CONFIG_HOME: configDirectory,
  };

  try {
    await Promise.all(
      [homeDirectory, configDirectory, storeDirectory].map((directory) =>
        mkdir(directory, { recursive: true }),
      ),
    );
    await Promise.all([
      writeFile(
        path.join(consumerDirectory, 'package.json'),
        `${JSON.stringify(
          {
            name: 'moldea-repository-peer-consumer',
            packageManager: `pnpm@${EXPECTED_PNPM_VERSION}`,
            private: true,
            scripts: { postinstall: 'node lifecycle-sentinel.mjs' },
            type: 'module',
          },
          null,
          2,
        )}\n`,
        'utf8',
      ),
      writeFile(
        path.join(consumerDirectory, 'lifecycle-sentinel.mjs'),
        "import { writeFileSync } from 'node:fs';\nwriteFileSync('lifecycle-executed', 'executed');\n",
        'utf8',
      ),
      writeFile(
        path.join(consumerDirectory, 'repository-conformance.test.mjs'),
        createConformanceSuite(),
        'utf8',
      ),
    ]);

    const installedPnpmVersion = executeCommand(pnpmExecutable, ['--version'], {
      cwd: consumerDirectory,
      env: environment,
    }).trim();
    assertCompatibilityInvariant(
      installedPnpmVersion === EXPECTED_PNPM_VERSION,
      `Expected pnpm ${EXPECTED_PNPM_VERSION}, received ${installedPnpmVersion}.`,
    );
    const installOutput = executeCommand(
      pnpmExecutable,
      [
        `--config.store-dir=${storeDirectory}`,
        '--config.strict-peer-dependencies=true',
        'add',
        '--save-dev',
        '--save-exact',
        '--ignore-scripts',
        '--reporter=append-only',
        repositoryTarball,
        `vitest@${vitestVersion}`,
        `web-utils-kit@${EXPECTED_WEB_UTILS_KIT_VERSION}`,
      ],
      { cwd: consumerDirectory, env: environment },
    );

    assertCompatibilityInvariant(
      !PEER_WARNING_PATTERN.test(installOutput),
      'The Repository packed-consumer installation reported a peer warning.',
    );
    assertCompatibilityInvariant(
      !(await pathExists(lifecycleMarkerPath)),
      'The Repository packed-consumer installation executed a lifecycle script.',
    );

    const repositoryManifest = JSON.parse(
      await readFile(
        path.join(consumerDirectory, 'node_modules', '@moldea.ai', 'repository', 'package.json'),
        'utf8',
      ),
    );
    const vitestManifest = JSON.parse(
      await readFile(
        path.join(consumerDirectory, 'node_modules', 'vitest', 'package.json'),
        'utf8',
      ),
    );
    const webUtilsKitManifest = JSON.parse(
      await readFile(
        path.join(consumerDirectory, 'node_modules', 'web-utils-kit', 'package.json'),
        'utf8',
      ),
    );

    assertCompatibilityInvariant(
      repositoryManifest.name === '@moldea.ai/repository' &&
        repositoryManifest.version === EXPECTED_REPOSITORY_VERSION,
      'The installed Repository package identity is invalid.',
    );
    assertCompatibilityInvariant(
      JSON.stringify(repositoryManifest.peerDependencies) ===
        JSON.stringify({ vitest: '>=1.0.0', 'web-utils-kit': '>=1.3.1' }),
      'The installed Repository testing-peer ranges are invalid.',
    );
    assertCompatibilityInvariant(
      repositoryManifest.peerDependenciesMeta?.vitest?.optional === true &&
        repositoryManifest.peerDependenciesMeta?.['web-utils-kit']?.optional === true,
      'The installed Repository testing peers are not optional.',
    );
    assertCompatibilityInvariant(
      vitestManifest.version === vitestVersion,
      'The root Vitest version differs from the requested matrix value.',
    );
    assertCompatibilityInvariant(
      webUtilsKitManifest.version === EXPECTED_WEB_UTILS_KIT_VERSION,
      'The root web-utils-kit version differs from the requested matrix value.',
    );

    const vitestExecutable = await resolveVitestExecutable(consumerDirectory);
    executeCommand(
      process.execPath,
      [vitestExecutable, 'run', 'repository-conformance.test.mjs', '--environment', 'node'],
      { cwd: consumerDirectory, env: environment },
    );
    assertCompatibilityInvariant(
      !(await pathExists(lifecycleMarkerPath)),
      'The Repository conformance run executed a lifecycle script.',
    );
  } finally {
    await rm(consumerDirectory, { force: true, recursive: true });
  }
};

const artifactDirectory = process.argv[2];
const vitestVersion = process.argv[3];

if (artifactDirectory === undefined || vitestVersion === undefined || process.argv.length !== 4) {
  throw new Error('Provide exactly one package-artifact directory and one Vitest version.');
}

await runTestingPeerCompatibilityCheck(path.resolve(artifactDirectory), vitestVersion);
