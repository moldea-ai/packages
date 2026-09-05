import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { satisfies as doesVersionSatisfy } from 'semver';

/** Selects one unambiguous package tarball from the prepared artifact directory. */
const selectPackageTarball = (tarballNames, pattern, packageName) => {
  const matchingNames = tarballNames.filter((tarballName) => pattern.test(tarballName));

  if (matchingNames.length !== 1 || matchingNames[0] === undefined) {
    throw new Error(`Expected exactly one ${packageName} tarball.`);
  }

  return matchingNames[0];
};

/** Executes the installed CLI while retaining its handled process result. */
const executeCli = (executablePath, arguments_, cwd, environment) =>
  spawnSync(process.execPath, [executablePath, ...arguments_], {
    cwd,
    encoding: 'utf8',
    env: environment,
  });

/** Requires one invariant from the packed-runtime consumer check. */
const assertRuntimeInvariant = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

/** Reads and parses one installed package manifest. */
const readInstalledManifest = async (consumerDirectory, packageName) => {
  const manifestPath = path.join(
    consumerDirectory,
    'node_modules',
    ...packageName.split('/'),
    'package.json',
  );

  return JSON.parse(await readFile(manifestPath, 'utf8'));
};

/** Runs one Git fixture command without inherited configuration or hooks. */
const executeFixtureGit = (consumerDirectory, hooksDirectory, environment, arguments_) => {
  execFileSync(
    'git',
    [
      '-c',
      `core.hooksPath=${hooksDirectory}`,
      '-c',
      'init.defaultBranch=main',
      '-c',
      'user.name=moldea runtime test',
      '-c',
      'user.email=moldea-runtime@example.invalid',
      ...arguments_,
    ],
    { cwd: consumerDirectory, env: environment, stdio: 'ignore' },
  );
};

/** Installs and exercises the packed CLI composition under the active Node.js runtime. */
const runRuntimeCompatibilityCheck = async (artifactDirectory) => {
  const tarballNames = await readdir(artifactDirectory);
  const packageTarballNames = {
    '@moldea.ai/adapter-anthropic': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-adapter-anthropic-.+\.tgz$/u,
      '@moldea.ai/adapter-anthropic',
    ),
    '@moldea.ai/adapter-claude-agent-sdk': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-adapter-claude-agent-sdk-.+\.tgz$/u,
      '@moldea.ai/adapter-claude-agent-sdk',
    ),
    '@moldea.ai/adapter-google-genai': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-adapter-google-genai-.+\.tgz$/u,
      '@moldea.ai/adapter-google-genai',
    ),
    '@moldea.ai/adapter-langchain': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-adapter-langchain-.+\.tgz$/u,
      '@moldea.ai/adapter-langchain',
    ),
    '@moldea.ai/adapter-langgraph': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-adapter-langgraph-.+\.tgz$/u,
      '@moldea.ai/adapter-langgraph',
    ),
    '@moldea.ai/adapter-openai': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-adapter-openai-(?!agents-sdk-).+\.tgz$/u,
      '@moldea.ai/adapter-openai',
    ),
    '@moldea.ai/adapter-openai-agents-sdk': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-adapter-openai-agents-sdk-.+\.tgz$/u,
      '@moldea.ai/adapter-openai-agents-sdk',
    ),
    '@moldea.ai/adapter-cloudflare-agents': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-adapter-cloudflare-agents-.+\.tgz$/u,
      '@moldea.ai/adapter-cloudflare-agents',
    ),
    '@moldea.ai/adapter-eve': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-adapter-eve-.+\.tgz$/u,
      '@moldea.ai/adapter-eve',
    ),
    '@moldea.ai/adapter-vercel-ai-sdk': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-adapter-vercel-ai-sdk-.+\.tgz$/u,
      '@moldea.ai/adapter-vercel-ai-sdk',
    ),
    '@moldea.ai/cli': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-cli-.+\.tgz$/u,
      '@moldea.ai/cli',
    ),
    '@moldea.ai/core': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-core-.+\.tgz$/u,
      '@moldea.ai/core',
    ),
    '@moldea.ai/repository': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-repository-(?!fs-).+\.tgz$/u,
      '@moldea.ai/repository',
    ),
    '@moldea.ai/repository-fs': selectPackageTarball(
      tarballNames,
      /^moldea\.ai-repository-fs-.+\.tgz$/u,
      '@moldea.ai/repository-fs',
    ),
  };
  const consumerDirectory = await mkdtemp(path.join(tmpdir(), 'moldea-cli-runtime-consumer-'));
  const homeDirectory = path.join(consumerDirectory, '.home');
  const configDirectory = path.join(consumerDirectory, '.config');
  const hooksDirectory = path.join(consumerDirectory, '.hooks');
  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  try {
    await Promise.all(
      [homeDirectory, configDirectory, hooksDirectory].map((directory) =>
        mkdir(directory, { recursive: true }),
      ),
    );
    await writeFile(
      path.join(consumerDirectory, 'package.json'),
      `${JSON.stringify({ name: 'moldea-cli-runtime-consumer', private: true, type: 'module' })}\n`,
      'utf8',
    );

    execFileSync(
      npmExecutable,
      [
        'install',
        '--ignore-scripts',
        '--engine-strict',
        '--package-lock=false',
        '--audit=false',
        '--fund=false',
        ...Object.values(packageTarballNames).map((tarballName) =>
          path.join(artifactDirectory, tarballName),
        ),
      ],
      { cwd: consumerDirectory, stdio: 'inherit' },
    );

    const manifests = Object.fromEntries(
      await Promise.all(
        Object.keys(packageTarballNames).map(async (packageName) => [
          packageName,
          await readInstalledManifest(consumerDirectory, packageName),
        ]),
      ),
    );
    const cliManifest = manifests['@moldea.ai/cli'];
    const cliVersion = cliManifest?.version;
    const executablePath = path.join(
      consumerDirectory,
      'node_modules',
      '@moldea.ai',
      'cli',
      'dist',
      'moldea.js',
    );
    const environment = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([name]) => name.toUpperCase() !== 'NO_COLOR'),
      ),
      FORCE_COLOR: '3',
      HOME: homeDirectory,
      LANG: 'tr_TR.UTF-8',
      LC_ALL: 'tr_TR.UTF-8',
      TERM: 'xterm-256color',
      TZ: 'Pacific/Kiritimati',
      XDG_CONFIG_HOME: configDirectory,
    };

    assertRuntimeInvariant(
      cliManifest?.name === '@moldea.ai/cli' &&
        typeof cliVersion === 'string' &&
        cliVersion.length > 0,
      'The CLI identity is invalid.',
    );
    assertRuntimeInvariant(
      cliManifest?.engines?.node === '>=22.11.0',
      'The CLI runtime range is invalid.',
    );
    for (const packageName of [
      '@moldea.ai/adapter-anthropic',
      '@moldea.ai/adapter-claude-agent-sdk',
      '@moldea.ai/adapter-google-genai',
      '@moldea.ai/adapter-langchain',
      '@moldea.ai/adapter-langgraph',
      '@moldea.ai/adapter-openai',
      '@moldea.ai/adapter-openai-agents-sdk',
      '@moldea.ai/adapter-cloudflare-agents',
      '@moldea.ai/adapter-eve',
      '@moldea.ai/adapter-vercel-ai-sdk',
      '@moldea.ai/core',
      '@moldea.ai/repository',
      '@moldea.ai/repository-fs',
    ]) {
      const declaredRange = cliManifest.dependencies?.[packageName];
      const installedVersion = manifests[packageName]?.version;

      assertRuntimeInvariant(
        manifests[packageName]?.name === packageName,
        `The installed ${packageName} identity is invalid.`,
      );
      assertRuntimeInvariant(
        typeof declaredRange === 'string' &&
          typeof installedVersion === 'string' &&
          doesVersionSatisfy(installedVersion, declaredRange),
        `The installed ${packageName} version is inconsistent.`,
      );
    }

    const versionResult = executeCli(executablePath, ['--version'], consumerDirectory, environment);

    assertRuntimeInvariant(versionResult.status === 0, 'The installed CLI version command failed.');
    assertRuntimeInvariant(versionResult.stderr === '', 'The version command wrote stderr.');
    assertRuntimeInvariant(
      versionResult.stdout === `${cliVersion}\n`,
      'The version output is invalid.',
    );

    const compositionResult = executeCli(
      executablePath,
      ['composition', '--json'],
      consumerDirectory,
      environment,
    );
    const compositionEnvelope = JSON.parse(compositionResult.stdout);
    assertRuntimeInvariant(
      compositionResult.status === 0,
      'The installed CLI composition command failed.',
    );
    assertRuntimeInvariant(
      compositionResult.stderr === '',
      'The composition command wrote stderr.',
    );
    assertRuntimeInvariant(
      compositionEnvelope.status === 'valid' &&
        compositionEnvelope.result?.supportedNodeRange === '>=22.11.0' &&
        typeof compositionEnvelope.result?.minimumGitVersion === 'string' &&
        JSON.stringify(compositionEnvelope.result?.repositoryFormatVersions) === '[1]',
      'The composition result is invalid.',
    );
    assertRuntimeInvariant(
      compositionEnvelope.cliVersion === cliVersion &&
        compositionEnvelope.command === 'composition' &&
        compositionEnvelope.schemaVersion === 4,
      'The composition envelope is invalid.',
    );
    assertRuntimeInvariant(
      JSON.stringify(compositionEnvelope.result?.packages) ===
        JSON.stringify(
          Object.entries(manifests)
            .filter(([packageName]) => packageName !== '@moldea.ai/cli')
            .map(([name, manifest]) => ({ name, version: manifest.version }))
            .sort((left, right) => left.name.localeCompare(right.name, 'en')),
        ),
      'The composition package list is invalid.',
    );
    assertRuntimeInvariant(
      JSON.stringify(compositionEnvelope.result?.adapters) ===
        JSON.stringify(
          [
            'anthropic',
            'claude-agent-sdk',
            'cloudflare-agents',
            'custom',
            'eve',
            'google-genai',
            'langchain',
            'langgraph',
            'openai',
            'openai-agents-sdk',
            'vercel-ai-sdk',
          ].map((id) => ({ id, repositoryFormatVersions: [1] })),
        ),
      'The executable adapter list is invalid.',
    );

    executeFixtureGit(consumerDirectory, hooksDirectory, environment, ['init']);
    await Promise.all([
      mkdir(path.join(consumerDirectory, 'moldea', 'agents', 'support'), { recursive: true }),
      mkdir(path.join(consumerDirectory, 'src'), { recursive: true }),
    ]);
    await writeFile(
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
    );
    await writeFile(path.join(consumerDirectory, 'moldea', 'project.md'), '# Project\n', 'utf8');
    await writeFile(
      path.join(consumerDirectory, 'moldea', 'agents', 'support', 'description.md'),
      'Support agent.\n',
      'utf8',
    );
    await writeFile(
      path.join(consumerDirectory, 'moldea', 'agents', 'support', 'instruction.md'),
      'You are the `support` agent.\n',
      'utf8',
    );
    await writeFile(
      path.join(consumerDirectory, 'src', 'agent.ts'),
      [
        "import { query } from '@anthropic-ai/claude-agent-sdk';",
        "export const supportAgent = async () => query({ prompt: 'Help users.', options: {} });",
        '',
      ].join('\n'),
      'utf8',
    );
    const consumerManifest = JSON.parse(
      await readFile(path.join(consumerDirectory, 'package.json'), 'utf8'),
    );
    await writeFile(
      path.join(consumerDirectory, 'package.json'),
      `${JSON.stringify(
        {
          ...consumerManifest,
          dependencies: { '@anthropic-ai/claude-agent-sdk': '^0.3.234' },
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
    const validateResult = executeCli(
      executablePath,
      ['validate', '--json'],
      consumerDirectory,
      environment,
    );
    const inspectResult = executeCli(
      executablePath,
      ['inspect', '--json'],
      consumerDirectory,
      environment,
    );
    const scopeResult = executeCli(
      executablePath,
      ['scope', '--path', '/src/agent.ts', '--json'],
      consumerDirectory,
      environment,
    );
    const contentResult = executeCli(
      executablePath,
      ['content', '--path', '/moldea/project.md', '--json'],
      consumerDirectory,
      environment,
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

    assertRuntimeInvariant(validateResult.status === 0, 'The installed CLI validation failed.');
    assertRuntimeInvariant(validateResult.stderr === '', 'The validation command wrote stderr.');
    assertRuntimeInvariant(
      validateEnvelope.status === 'valid',
      'The validation result is invalid.',
    );
    assertRuntimeInvariant(
      !validateResult.stdout.includes('# Project'),
      'Validation exposed canonical repository content.',
    );
    assertRuntimeInvariant(inspectResult.status === 0, 'The installed CLI inspection failed.');
    assertRuntimeInvariant(inspectResult.stderr === '', 'The inspection command wrote stderr.');
    assertRuntimeInvariant(
      inspectEnvelope.schemaVersion === 4 &&
        inspectEnvelope.result?.project?.project?.path === '/moldea/project.md' &&
        !inspectResult.stdout.includes('# Project') &&
        !inspectResult.stdout.includes('"content"'),
      'Inspection did not preserve the content-free schema 4 contract.',
    );
    assertRuntimeInvariant(
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
      'Inspection omitted the Claude Agent SDK evidence summaries.',
    );
    assertRuntimeInvariant(
      scopeResult.status === 0 &&
        scopeResult.stderr === '' &&
        scopeEnvelope.schemaVersion === 4 &&
        scopeEnvelope.result?.relevant === true,
      'The installed CLI scope command failed.',
    );
    assertRuntimeInvariant(
      contentResult.status === 0 &&
        contentResult.stderr === '' &&
        contentEnvelope.schemaVersion === 4 &&
        contentEnvelope.result?.asset?.path === '/moldea/project.md' &&
        contentEnvelope.result?.chunk?.content === '# Project\n',
      'The installed CLI content command failed.',
    );
    assertRuntimeInvariant(
      !`${compositionResult.stdout}${validateResult.stdout}${inspectResult.stdout}${scopeResult.stdout}${contentResult.stdout}`.includes(
        '\u001b[',
      ),
      'JSON output contains ANSI control sequences.',
    );
    assertRuntimeInvariant(statusBefore.equals(statusAfter), 'The CLI changed repository state.');
  } finally {
    await rm(consumerDirectory, { force: true, recursive: true });
  }
};

const artifactDirectory = process.argv[2];

if (artifactDirectory === undefined || process.argv.length !== 3) {
  throw new Error('Provide exactly one prepared package-artifact directory.');
}

await runRuntimeCompatibilityCheck(path.resolve(artifactDirectory));
