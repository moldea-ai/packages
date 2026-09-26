import { execFile } from 'node:child_process';
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

import semver from 'semver';

import { checkEveCompilerScenario } from './eve-scenarios.ts';
import { PINNED_UPSTREAM_TARGETS } from './targets.ts';
import type { IUpstreamResult, IUpstreamTarget } from './types.ts';

const execFileAsync = promisify(execFile);
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SCRIPT_DIRECTORY, '../..');
const FIXTURE_DIRECTORY = join(SCRIPT_DIRECTORY, 'fixtures');
const TSC_PATH = join(REPOSITORY_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

const runCommand = async (
  executable: string,
  args: readonly string[],
  directory: string,
): Promise<string> => {
  const { stdout } = await execFileAsync(executable, [...args], {
    cwd: directory,
    maxBuffer: 2_097_152,
    timeout: 120_000,
  });

  return stdout.trim();
};

const getNpmCli = async (): Promise<string> => {
  const nodeDirectory = dirname(process.execPath);
  const candidates = [
    resolve(nodeDirectory, '../lib/node_modules/npm/bin/npm-cli.js'),
    join(nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // the next standard Node/npm installation layout may own the CLI
    }
  }

  throw new Error('Node.js must include npm to install disposable upstream SDK consumers.');
};

const runNpm = async (
  npmCli: string,
  args: readonly string[],
  directory: string,
): Promise<string> => runCommand(process.execPath, [npmCli, ...args], directory);

const getInstalledIntegrity = (lockfile: unknown, target: IUpstreamTarget): string | null => {
  if (typeof lockfile !== 'object' || lockfile === null || !('packages' in lockfile)) {
    return null;
  }

  const packages = lockfile.packages;

  if (typeof packages !== 'object' || packages === null) {
    return null;
  }

  const entry = (packages as Record<string, unknown>)[`node_modules/${target.packageName}`];

  if (typeof entry !== 'object' || entry === null || !('integrity' in entry)) {
    return null;
  }

  return typeof entry.integrity === 'string' ? entry.integrity : null;
};

/** Verifies a real exact-version SDK in one isolated disposable consumer. */
export const checkUpstreamTarget = async (
  target: IUpstreamTarget,
  npmCli?: string,
): Promise<IUpstreamResult> => {
  const cli = npmCli ?? (await getNpmCli());
  const directory = join(tmpdir(), `moldea-upstream-${randomUUID()}`);
  await mkdir(directory);

  try {
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ name: 'moldea-upstream-probe', private: true, type: 'module' }),
    );
    await runNpm(
      cli,
      [
        'install',
        '--save-exact',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        `${target.packageName}@${target.version}`,
        ...target.companionPackages,
      ],
      directory,
    );

    const packagePath = join(
      directory,
      'node_modules',
      ...target.packageName.split('/'),
      'package.json',
    );
    const installed = JSON.parse(await readFile(packagePath, 'utf8')) as unknown;

    if (
      typeof installed !== 'object' ||
      installed === null ||
      !('version' in installed) ||
      installed.version !== target.version
    ) {
      throw new Error(
        `Installed SDK version differs from ${target.packageName}@${target.version}.`,
      );
    }

    const lockfile = JSON.parse(
      await readFile(join(directory, 'package-lock.json'), 'utf8'),
    ) as unknown;

    if (getInstalledIntegrity(lockfile, target) !== target.integrity) {
      throw new Error(`Tarball integrity differs for ${target.packageName}@${target.version}.`);
    }

    await copyFile(
      join(FIXTURE_DIRECTORY, `${target.family}-${target.fixture}.mts`),
      join(directory, 'probe.mts'),
    );
    await writeFile(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          lib: ['ES2023', 'DOM'],
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noEmit: true,
          skipLibCheck: true,
          strict: true,
          target: 'ES2023',
        },
        files: ['probe.mts'],
      }),
    );
    await runCommand(process.execPath, [TSC_PATH, '-p', 'tsconfig.json'], directory);

    const compilerChecked = target.family === 'eve';

    if (compilerChecked) {
      await checkEveCompilerScenario(directory, target);
    }

    const requestPreparationChecked = target.family === 'anthropic' || target.family === 'openai';

    if (requestPreparationChecked) {
      await copyFile(
        join(FIXTURE_DIRECTORY, 'request-preparation.mjs'),
        join(directory, 'request-preparation.mjs'),
      );
      await runCommand(process.execPath, ['request-preparation.mjs', target.family], directory);
    }

    return Object.freeze({
      ...target,
      ...(compilerChecked ? { compilerChecked } : {}),
      requestPreparationChecked,
    });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
};

/** Resolves exact stable npm latest targets without changing pinned review data. */
export const resolveLatestTargets = async (
  npmCli?: string,
): Promise<readonly IUpstreamTarget[]> => {
  const cli = npmCli ?? (await getNpmCli());
  const currentTargets = PINNED_UPSTREAM_TARGETS.filter(({ fixture }) => fixture === 'current');
  const targets: IUpstreamTarget[] = [];

  for (const current of currentTargets) {
    const version = (
      await runNpm(cli, ['view', `${current.packageName}@latest`, 'version'], REPOSITORY_ROOT)
    ).replaceAll('"', '');

    if (semver.valid(version) === null || semver.prerelease(version) !== null) {
      throw new Error(`The npm latest tag is not a stable version for ${current.packageName}.`);
    }

    const integrity = (
      await runNpm(
        cli,
        ['view', `${current.packageName}@${version}`, 'dist.integrity'],
        REPOSITORY_ROOT,
      )
    ).replaceAll('"', '');

    if (!integrity.startsWith('sha512-')) {
      throw new Error(
        `The npm latest tarball has no SHA-512 integrity for ${current.packageName}.`,
      );
    }

    targets.push(
      Object.freeze({
        ...current,
        integrity,
        sourceReference: `https://registry.npmjs.org/${current.packageName}/${version}`,
        version,
      }),
    );
  }

  return Object.freeze(targets);
};

/** Runs exact pinned targets or reports and checks freshly resolved stable targets serially. */
export const runUpstreamCompatibility = async (
  latest: boolean,
): Promise<readonly IUpstreamResult[]> => {
  const npmCli = await getNpmCli();
  const targets = latest ? await resolveLatestTargets(npmCli) : PINNED_UPSTREAM_TARGETS;
  const results: IUpstreamResult[] = [];

  for (const target of targets) {
    results.push(await checkUpstreamTarget(target, npmCli));
  }

  return Object.freeze(results);
};
