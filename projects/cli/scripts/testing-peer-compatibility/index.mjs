import { execFileSync, spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPECTED_CLI_VERSION = '6.0.0';
const EXPECTED_PNPM_VERSION = '11.21.0';
const EXPECTED_VITEST_VERSION = '3.2.4';
const PEER_WARNING_PATTERN = /(?:unmet peer|peer dependenc(?:y|ies)|ERR_PNPM_PEER_DEP_ISSUES)/iu;
const PACKAGE_VERSIONS = {
  '@moldea.ai/adapter-anthropic': '2.0.6',
  '@moldea.ai/adapter-claude-agent-sdk': '1.0.5',
  '@moldea.ai/adapter-cloudflare-agents': '1.0.5',
  '@moldea.ai/adapter-eve': '1.0.5',
  '@moldea.ai/adapter-google-genai': '1.0.8',
  '@moldea.ai/adapter-langchain': '1.0.5',
  '@moldea.ai/adapter-langgraph': '1.0.5',
  '@moldea.ai/adapter-openai': '2.0.9',
  '@moldea.ai/adapter-openai-agents-sdk': '1.0.7',
  '@moldea.ai/adapter-vercel-ai-sdk': '1.0.5',
  '@moldea.ai/cli': EXPECTED_CLI_VERSION,
  '@moldea.ai/core': '2.1.0',
  '@moldea.ai/repository': '1.1.1',
  '@moldea.ai/repository-fs': '1.0.6',
};
const TARBALL_PATTERNS = {
  '@moldea.ai/adapter-anthropic': /^moldea\.ai-adapter-anthropic-.+\.tgz$/u,
  '@moldea.ai/adapter-claude-agent-sdk': /^moldea\.ai-adapter-claude-agent-sdk-.+\.tgz$/u,
  '@moldea.ai/adapter-cloudflare-agents': /^moldea\.ai-adapter-cloudflare-agents-.+\.tgz$/u,
  '@moldea.ai/adapter-eve': /^moldea\.ai-adapter-eve-.+\.tgz$/u,
  '@moldea.ai/adapter-google-genai': /^moldea\.ai-adapter-google-genai-.+\.tgz$/u,
  '@moldea.ai/adapter-langchain': /^moldea\.ai-adapter-langchain-.+\.tgz$/u,
  '@moldea.ai/adapter-langgraph': /^moldea\.ai-adapter-langgraph-.+\.tgz$/u,
  '@moldea.ai/adapter-openai': /^moldea\.ai-adapter-openai-(?!agents-sdk-).+\.tgz$/u,
  '@moldea.ai/adapter-openai-agents-sdk': /^moldea\.ai-adapter-openai-agents-sdk-.+\.tgz$/u,
  '@moldea.ai/adapter-vercel-ai-sdk': /^moldea\.ai-adapter-vercel-ai-sdk-.+\.tgz$/u,
  '@moldea.ai/cli': /^moldea\.ai-cli-.+\.tgz$/u,
  '@moldea.ai/core': /^moldea\.ai-core-.+\.tgz$/u,
  '@moldea.ai/repository': /^moldea\.ai-repository-(?!fs-).+\.tgz$/u,
  '@moldea.ai/repository-fs': /^moldea\.ai-repository-fs-.+\.tgz$/u,
};

/** Requires one invariant from the packed CLI compatibility check. */
const assertCompatibilityInvariant = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

/** Executes a child process and retains its complete handled result. */
const executeCommand = (executable, arguments_, options) =>
  spawnSync(executable, arguments_, {
    ...options,
    encoding: 'utf8',
  });

/** Requires a successful child process and returns its combined captured text. */
const requireSuccessfulCommand = (executable, arguments_, options) => {
  const result = executeCommand(executable, arguments_, options);

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

/** Selects the exact candidate tarball for every package in the CLI closure. */
const selectPackageTarballs = async (artifactDirectory) => {
  const tarballNames = await readdir(artifactDirectory);

  return Object.fromEntries(
    Object.entries(TARBALL_PATTERNS).map(([packageName, pattern]) => {
      const matchingNames = tarballNames.filter((tarballName) => pattern.test(tarballName));

      assertCompatibilityInvariant(
        matchingNames.length === 1 && matchingNames[0] !== undefined,
        `Expected exactly one ${packageName} tarball.`,
      );

      return [packageName, path.join(artifactDirectory, matchingNames[0])];
    }),
  );
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

/** Resolves an exact pnpm 11.21 invocation, using Corepack only for local fallback. */
const resolvePnpmInvocation = (consumerDirectory, environment) => {
  const directExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const directResult = executeCommand(directExecutable, ['--version'], {
    cwd: consumerDirectory,
    env: environment,
  });

  if (directResult.status === 0 && directResult.stdout.trim() === EXPECTED_PNPM_VERSION) {
    return { argumentsPrefix: [], executable: directExecutable };
  }

  const corepackExecutable = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
  const argumentsPrefix = [`pnpm@${EXPECTED_PNPM_VERSION}`];
  const corepackResult = executeCommand(corepackExecutable, [...argumentsPrefix, '--version'], {
    cwd: consumerDirectory,
    env: environment,
  });

  assertCompatibilityInvariant(
    corepackResult.status === 0 && corepackResult.stdout.trim() === EXPECTED_PNPM_VERSION,
    `The exact pnpm ${EXPECTED_PNPM_VERSION} executable is unavailable.`,
  );

  return { argumentsPrefix, executable: corepackExecutable };
};

/** Executes the exact resolved pnpm invocation. */
const executePnpm = (pnpmInvocation, arguments_, options) =>
  requireSuccessfulCommand(
    pnpmInvocation.executable,
    [...pnpmInvocation.argumentsPrefix, ...arguments_],
    options,
  );

/** Reads one installed package manifest from the isolated consumer root. */
const readInstalledManifest = async (consumerDirectory, packageName) => {
  const manifestPath = path.join(
    consumerDirectory,
    'node_modules',
    ...packageName.split('/'),
    'package.json',
  );

  return JSON.parse(await readFile(manifestPath, 'utf8'));
};

/** Runs one Git fixture command without inherited hooks or identity. */
const executeFixtureGit = (consumerDirectory, hooksDirectory, environment, arguments_) => {
  execFileSync(
    'git',
    [
      '-c',
      `core.hooksPath=${hooksDirectory}`,
      '-c',
      'init.defaultBranch=main',
      '-c',
      'user.name=moldea peer compatibility test',
      '-c',
      'user.email=moldea-peer-compatibility@example.invalid',
      ...arguments_,
    ],
    { cwd: consumerDirectory, env: environment, stdio: 'ignore' },
  );
};

/** Exercises CLI identity, composition, validation, and provider-backed inspection. */
const verifyCliExecution = async (consumerDirectory, environment, manifests) => {
  const cliManifest = manifests['@moldea.ai/cli'];
  const executablePath = path.join(
    consumerDirectory,
    'node_modules',
    '@moldea.ai',
    'cli',
    'dist',
    'moldea.js',
  );
  const hooksDirectory = path.join(consumerDirectory, '.hooks');

  await mkdir(hooksDirectory, { recursive: true });
  const versionResult = executeCommand(process.execPath, [executablePath, '--version'], {
    cwd: consumerDirectory,
    env: environment,
  });
  assertCompatibilityInvariant(
    versionResult.status === 0 &&
      versionResult.stderr === '' &&
      versionResult.stdout === `${EXPECTED_CLI_VERSION}\n`,
    'The installed root-local CLI version command failed.',
  );

  const compositionResult = executeCommand(
    process.execPath,
    [executablePath, 'composition', '--json'],
    { cwd: consumerDirectory, env: environment },
  );
  const compositionEnvelope = JSON.parse(compositionResult.stdout);
  assertCompatibilityInvariant(
    compositionResult.status === 0 && compositionResult.stderr === '',
    'The installed CLI composition command failed.',
  );
  assertCompatibilityInvariant(
    compositionEnvelope.cliVersion === EXPECTED_CLI_VERSION &&
      compositionEnvelope.command === 'composition' &&
      compositionEnvelope.schemaVersion === 3 &&
      compositionEnvelope.status === 'valid' &&
      compositionEnvelope.result?.supportedNodeRange === '>=22.11.0',
    'The installed CLI composition envelope is invalid.',
  );
  assertCompatibilityInvariant(
    JSON.stringify(compositionEnvelope.result?.packages) ===
      JSON.stringify(
        Object.entries(PACKAGE_VERSIONS)
          .filter(([packageName]) => packageName !== '@moldea.ai/cli')
          .map(([name, version]) => ({ name, version }))
          .sort((left, right) => left.name.localeCompare(right.name, 'en')),
      ),
    'The installed CLI composition package identity is invalid.',
  );
  assertCompatibilityInvariant(
    cliManifest.bin?.moldea === './dist/moldea.js',
    'The installed CLI executable identity is invalid.',
  );

  executeFixtureGit(consumerDirectory, hooksDirectory, environment, ['init']);
  await Promise.all([
    mkdir(path.join(consumerDirectory, 'moldea', 'agents', 'support'), { recursive: true }),
    mkdir(path.join(consumerDirectory, 'src'), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(
      path.join(consumerDirectory, 'moldea', 'moldea.yaml'),
      [
        'version: 1',
        'agents:',
        '  support:',
        '    runtime:',
        '      id: claude-agent-sdk',
        '    bindings:',
        '      runtimeAgent:',
        '        path: /src/agent.ts',
        '        symbol: supportAgent',
        '',
      ].join('\n'),
      'utf8',
    ),
    writeFile(path.join(consumerDirectory, 'moldea', 'project.md'), '# Project\n', 'utf8'),
    writeFile(
      path.join(consumerDirectory, 'moldea', 'agents', 'support', 'description.md'),
      'Support agent.\n',
      'utf8',
    ),
    writeFile(
      path.join(consumerDirectory, 'moldea', 'agents', 'support', 'instruction.md'),
      'You are the `support` agent.\n',
      'utf8',
    ),
    writeFile(
      path.join(consumerDirectory, 'src', 'agent.ts'),
      [
        "import { query } from '@anthropic-ai/claude-agent-sdk';",
        "export const supportAgent = async () => query({ prompt: 'Help users.', options: {} });",
        '',
      ].join('\n'),
      'utf8',
    ),
  ]);
  const consumerManifestPath = path.join(consumerDirectory, 'package.json');
  const consumerManifest = JSON.parse(await readFile(consumerManifestPath, 'utf8'));
  await writeFile(
    consumerManifestPath,
    `${JSON.stringify(
      {
        ...consumerManifest,
        dependencies: {
          ...consumerManifest.dependencies,
          '@anthropic-ai/claude-agent-sdk': '^0.3.234',
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  executeFixtureGit(consumerDirectory, hooksDirectory, environment, [
    'add',
    '--',
    'moldea/moldea.yaml',
    'moldea/project.md',
  ]);
  const statusBefore = execFileSync('git', ['status', '--porcelain=v2', '-z'], {
    cwd: consumerDirectory,
    encoding: 'buffer',
    env: environment,
  });
  const validateResult = executeCommand(process.execPath, [executablePath, 'validate', '--json'], {
    cwd: consumerDirectory,
    env: environment,
  });
  const inspectResult = executeCommand(process.execPath, [executablePath, 'inspect', '--json'], {
    cwd: consumerDirectory,
    env: environment,
  });
  const scopeResult = executeCommand(
    process.execPath,
    [executablePath, 'scope', '--path', '/src/agent.ts', '--json'],
    { cwd: consumerDirectory, env: environment },
  );
  const contentResult = executeCommand(
    process.execPath,
    [executablePath, 'content', '--path', '/moldea/project.md', '--json'],
    { cwd: consumerDirectory, env: environment },
  );
  const statusAfter = execFileSync('git', ['status', '--porcelain=v2', '-z'], {
    cwd: consumerDirectory,
    encoding: 'buffer',
    env: environment,
  });
  const validateEnvelope = JSON.parse(validateResult.stdout);
  const inspectEnvelope = JSON.parse(inspectResult.stdout);
  const scopeEnvelope = JSON.parse(scopeResult.stdout);
  const contentEnvelope = JSON.parse(contentResult.stdout);

  assertCompatibilityInvariant(
    validateResult.status === 0 &&
      validateResult.stderr === '' &&
      validateEnvelope.status === 'valid',
    'The installed CLI validation failed.',
  );
  assertCompatibilityInvariant(
    inspectResult.status === 0 && inspectResult.stderr === '' && inspectEnvelope.status === 'valid',
    'The installed CLI inspection failed.',
  );
  assertCompatibilityInvariant(
    inspectEnvelope.schemaVersion === 3 &&
      inspectEnvelope.result?.project?.project?.path === '/moldea/project.md' &&
      !inspectResult.stdout.includes('# Project') &&
      !inspectResult.stdout.includes('"content"'),
    'The installed CLI inspection did not preserve the content-free schema 3 contract.',
  );
  assertCompatibilityInvariant(
    JSON.stringify(
      inspectEnvelope.result?.page?.records
        ?.filter(({ kind }) => kind === 'evidence')
        .map(({ evidenceKind, source }) => ({ evidenceKind, source })),
    ) ===
      JSON.stringify([
        { evidenceKind: 'language', source: 'claude-agent-sdk' },
        { evidenceKind: 'runtime-package', source: 'claude-agent-sdk' },
        { evidenceKind: 'runtime-pattern', source: 'claude-agent-sdk' },
      ]),
    'The installed CLI inspection did not preserve provider evidence summaries.',
  );
  assertCompatibilityInvariant(
    scopeResult.status === 0 &&
      scopeResult.stderr === '' &&
      scopeEnvelope.schemaVersion === 3 &&
      scopeEnvelope.result?.relevant === true,
    'The installed CLI scope command failed.',
  );
  assertCompatibilityInvariant(
    contentResult.status === 0 &&
      contentResult.stderr === '' &&
      contentEnvelope.schemaVersion === 3 &&
      contentEnvelope.result?.asset?.path === '/moldea/project.md' &&
      contentEnvelope.result?.chunk?.content === '# Project\n',
    'The installed CLI content command failed.',
  );
  assertCompatibilityInvariant(
    statusBefore.equals(statusAfter),
    'The CLI changed repository state.',
  );
  assertCompatibilityInvariant(
    !`${compositionResult.stdout}${validateResult.stdout}${inspectResult.stdout}${scopeResult.stdout}${contentResult.stdout}`.includes(
      '\u001b[',
    ),
    'The installed CLI JSON output contains ANSI control sequences.',
  );
};

/** Installs and exercises the candidate CLI closure with a preexisting root Vitest. */
const runTestingPeerCompatibilityCheck = async (artifactDirectory, vitestVersion) => {
  assertCompatibilityInvariant(
    vitestVersion === EXPECTED_VITEST_VERSION,
    `Expected Vitest ${EXPECTED_VITEST_VERSION}, received ${vitestVersion}.`,
  );
  const packageTarballs = await selectPackageTarballs(artifactDirectory);
  const consumerDirectory = await mkdtemp(path.join(tmpdir(), 'moldea-cli-peer-consumer-'));
  const homeDirectory = path.join(consumerDirectory, '.home');
  const configDirectory = path.join(consumerDirectory, '.config');
  const storeDirectory = path.join(consumerDirectory, '.pnpm-store');
  const lifecycleMarkerPath = path.join(consumerDirectory, 'lifecycle-executed');
  const environment = {
    ...process.env,
    CI: 'true',
    FORCE_COLOR: '0',
    HOME: homeDirectory,
    LANG: 'C',
    LC_ALL: 'C',
    NO_COLOR: '1',
    TZ: 'UTC',
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
            name: 'moldea-cli-peer-consumer',
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
    ]);
    const pnpmInvocation = resolvePnpmInvocation(consumerDirectory, environment);
    const pnpmOptions = { cwd: consumerDirectory, env: environment };
    const pnpmConfigArguments = [
      `--config.store-dir=${storeDirectory}`,
      '--config.strict-peer-dependencies=true',
    ];
    const vitestInstallOutput = executePnpm(
      pnpmInvocation,
      [
        ...pnpmConfigArguments,
        'add',
        '--save-dev',
        '--save-exact',
        '--ignore-scripts',
        '--reporter=append-only',
        `vitest@${vitestVersion}`,
      ],
      pnpmOptions,
    );

    assertCompatibilityInvariant(
      !PEER_WARNING_PATTERN.test(vitestInstallOutput),
      'The initial Vitest installation reported a peer warning.',
    );
    assertCompatibilityInvariant(
      !(await pathExists(lifecycleMarkerPath)),
      'The initial Vitest installation executed a lifecycle script.',
    );
    const vitestManifestPath = path.join(
      consumerDirectory,
      'node_modules',
      'vitest',
      'package.json',
    );
    const vitestManifestBefore = await readFile(vitestManifestPath, 'utf8');
    const consumerManifestPath = path.join(consumerDirectory, 'package.json');
    const manifestBeforeClosure = JSON.parse(await readFile(consumerManifestPath, 'utf8'));
    const packageTarballSpecs = Object.fromEntries(
      Object.entries(packageTarballs).map(([packageName, tarballPath]) => [
        packageName,
        pathToFileURL(tarballPath).href,
      ]),
    );
    await writeFile(
      consumerManifestPath,
      `${JSON.stringify(
        {
          ...manifestBeforeClosure,
          dependencies: packageTarballSpecs,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await writeFile(
      path.join(consumerDirectory, 'pnpm-workspace.yaml'),
      `${JSON.stringify({ overrides: packageTarballSpecs }, null, 2)}\n`,
      'utf8',
    );
    const closureInstallOutput = executePnpm(
      pnpmInvocation,
      [
        ...pnpmConfigArguments,
        'install',
        '--ignore-scripts',
        '--no-frozen-lockfile',
        '--reporter=append-only',
      ],
      pnpmOptions,
    );

    assertCompatibilityInvariant(
      !PEER_WARNING_PATTERN.test(closureInstallOutput),
      'The candidate CLI closure installation reported a peer warning.',
    );
    assertCompatibilityInvariant(
      !(await pathExists(lifecycleMarkerPath)),
      'The candidate CLI closure installation executed a lifecycle script.',
    );
    const consumerManifest = JSON.parse(await readFile(consumerManifestPath, 'utf8'));
    const vitestManifestText = await readFile(vitestManifestPath, 'utf8');
    const vitestManifest = JSON.parse(vitestManifestText);
    const virtualStoreEntries = await readdir(
      path.join(consumerDirectory, 'node_modules', '.pnpm'),
    );
    const installedVitestEntries = virtualStoreEntries.filter((entry) =>
      entry.startsWith('vitest@'),
    );

    assertCompatibilityInvariant(
      consumerManifest.devDependencies?.vitest === EXPECTED_VITEST_VERSION,
      'The candidate CLI closure changed the root Vitest declaration.',
    );
    assertCompatibilityInvariant(
      vitestManifest.version === EXPECTED_VITEST_VERSION &&
        vitestManifestText === vitestManifestBefore,
      'The candidate CLI closure changed the root Vitest resolution.',
    );
    assertCompatibilityInvariant(
      installedVitestEntries.length > 0 &&
        installedVitestEntries.every((entry) =>
          entry.startsWith(`vitest@${EXPECTED_VITEST_VERSION}`),
        ),
      'The candidate CLI closure installed a conflicting nested Vitest version.',
    );

    const manifests = Object.fromEntries(
      await Promise.all(
        Object.entries(PACKAGE_VERSIONS).map(async ([packageName, expectedVersion]) => {
          const manifest = await readInstalledManifest(consumerDirectory, packageName);
          assertCompatibilityInvariant(
            manifest.name === packageName && manifest.version === expectedVersion,
            `The installed ${packageName} identity is invalid.`,
          );
          return [packageName, manifest];
        }),
      ),
    );
    const expectedCliDependencies = Object.fromEntries(
      Object.entries(PACKAGE_VERSIONS).filter(([packageName]) => packageName !== '@moldea.ai/cli'),
    );
    expectedCliDependencies.semver = '7.8.5';
    assertCompatibilityInvariant(
      JSON.stringify(manifests['@moldea.ai/cli'].dependencies) ===
        JSON.stringify(expectedCliDependencies),
      'The installed CLI dependency closure is invalid.',
    );

    const providerVersionOutput = executePnpm(
      pnpmInvocation,
      ['exec', 'moldea', '--version'],
      pnpmOptions,
    );
    assertCompatibilityInvariant(
      providerVersionOutput === `${EXPECTED_CLI_VERSION}\n`,
      'pnpm did not resolve the root-local CLI provider.',
    );
    await verifyCliExecution(consumerDirectory, environment, manifests);
    assertCompatibilityInvariant(
      !(await pathExists(lifecycleMarkerPath)),
      'CLI execution created the lifecycle sentinel.',
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
