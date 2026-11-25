import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORTABLE_PREFIX = 'package/dist/portable/';
const PORTABLE_FILE =
  /^(?:moldea\.mjs|node-runner\.mjs|analysis-worker\.mjs|chunk-[a-f0-9]+\.mjs|LICENSES\.md|SHA256SUMS)$/u;

/** Extracts just the portable distribution and verifies that its manifest covers every file. */
const extractPortableArtifact = async (tarball, directory) => {
  await mkdir(directory);
  const entries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .split(/\r?\n/u)
    .filter((name) => name.startsWith(PORTABLE_PREFIX) && name !== PORTABLE_PREFIX);
  const names = entries.map((entry) => entry.slice(PORTABLE_PREFIX.length)).sort();
  assert.ok(names.length > 0 && names.every((name) => PORTABLE_FILE.test(name)));
  assert.equal(new Set(names).size, names.length);
  for (const name of [
    'moldea.mjs',
    'node-runner.mjs',
    'analysis-worker.mjs',
    'LICENSES.md',
    'SHA256SUMS',
  ]) {
    assert.ok(names.includes(name), `The CLI artifact has no ${name}.`);
  }

  execFileSync('tar', ['-xzf', tarball, '-C', directory, '--strip-components=3', ...entries]);
  assert.deepEqual((await readdir(directory)).sort(), names);

  const sums = await Promise.all(
    names
      .filter((name) => name !== 'SHA256SUMS')
      .map(async (name) => {
        const file = path.join(directory, name);
        assert.ok((await lstat(file)).isFile(), `Expected an ordinary file for ${name}.`);
        return `${createHash('sha256')
          .update(await readFile(file))
          .digest('hex')}  ${name}`;
      }),
  );
  const manifest = path.join(directory, 'SHA256SUMS');
  assert.ok((await lstat(manifest)).isFile());
  assert.equal(await readFile(manifest, 'utf8'), sums.join('\n') + '\n');
};

/** Exposes Git without adding Node or any package manager to the standalone PATH. */
const getPortableGitPath = async (root) => {
  if (process.platform === 'win32') {
    // Git for Windows' native wrapper resolves its own runtime relative to cmd\git.exe.
    const locator = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'where.exe');
    const [git] = execFileSync(locator, ['git.exe'], { encoding: 'utf8' }).trim().split(/\r?\n/u);
    assert.ok(git && path.isAbsolute(git));
    const directory = path.dirname(git);
    for (const name of await readdir(directory)) {
      assert.doesNotMatch(name.toLowerCase(), /^(?:npm|npx|pnpm|pnpx|yarn|bun|corepack)(?:\.|$)/u);
    }
    return directory;
  }
  const directory = path.join(root, 'git-path');
  await mkdir(directory);
  const git = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  assert.ok(path.isAbsolute(git));
  await symlink(git, path.join(directory, 'git'));
  return directory;
};

/** Runs one executable and retains its observable process result for exact comparison. */
const run = (executable, repository, env, args) => {
  const { error, status, stderr, stdout } = spawnSync(
    process.execPath,
    [executable, ...args, '--json'],
    { cwd: repository, env, encoding: 'utf8', timeout: 30_000 },
  );
  if (error !== undefined) throw error;
  assert.equal(stderr, '', `${args[0]} wrote to stderr.`);
  const envelope = JSON.parse(stdout);
  assert.equal(envelope.schemaVersion, 8);
  return { status, envelope };
};

const verifyPortableArtifact = async (tarball, installedCli, root, environment) => {
  const portable = path.join(root, 'portable');
  const repository = path.join(root, 'standalone-repository');
  await extractPortableArtifact(tarball, portable);
  await mkdir(repository);

  const gitPath = await getPortableGitPath(root);
  const env = Object.fromEntries(
    Object.entries(environment).filter(([name]) => name.toLowerCase() !== 'path'),
  );
  const offline = {
    ...env,
    PATH: gitPath,
    HTTP_PROXY: 'http://127.0.0.1:1',
    HTTPS_PROXY: 'http://127.0.0.1:1',
    ALL_PROXY: 'http://127.0.0.1:1',
    http_proxy: 'http://127.0.0.1:1',
    https_proxy: 'http://127.0.0.1:1',
    all_proxy: 'http://127.0.0.1:1',
    NO_PROXY: '',
    no_proxy: '',
  };
  execFileSync('git', ['init', '--quiet'], { cwd: repository, env: offline });
  const files = {
    'moldea/moldea.yaml':
      'version: 1\nagents:\n  support:\n    bindings:\n      runtimeAgent: { path: /src/agent.ts, symbol: supportAgent }\n',
    'moldea/project.md': '# Standalone project\n',
    'moldea/agents/support/description.md': 'Handles customer support.\n',
    'moldea/agents/support/instruction.md': 'You are the `support` agent.\n',
    'src/agent.ts': 'export const supportAgent = {};\n',
  };
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(repository, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  for (const name of ['package.json', 'node_modules']) {
    await assert.rejects(access(path.join(repository, name)), { code: 'ENOENT' });
    await assert.rejects(access(path.join(portable, name)), { code: 'ENOENT' });
  }

  const standalone = path.join(portable, 'moldea.mjs');
  const verify = (args, exitCode, envelopeStatus) => {
    const actual = run(standalone, repository, offline, args);
    assert.equal(actual.status, exitCode, JSON.stringify(actual.envelope));
    assert.equal(actual.envelope.status, envelopeStatus, JSON.stringify(actual.envelope));
    assert.deepEqual(actual, run(installedCli, repository, offline, args));
    return actual.envelope.result;
  };
  const scope = ['scope', '--path', '/src/agent.ts'];
  const content = ['content', '--path', '/moldea/project.md'];
  verify(['composition'], 0, 'valid');
  verify(['validate'], 0, 'valid');
  const result = verify(['inspect'], 0, 'valid');
  assert.equal(result.coverageCounts.exportsPassed, 1);
  assert.ok(
    result.page.records.some(
      (record) => record.kind === 'coverage' && record.exportCheck === 'passed',
    ),
  );
  assert.equal(verify(scope, 0, 'valid').relevant, true);
  assert.equal(verify(content, 0, 'valid').chunk.content, files['moldea/project.md']);

  await writeFile(path.join(repository, 'moldea', 'moldea.yaml'), 'version: 1\nunknown: true\n');
  await rm(path.join(repository, 'moldea', 'project.md'));
  verify(['validate'], 1, 'invalid');
  verify(['inspect'], 1, 'invalid');
  verify(scope, 1, 'invalid');
  verify(content, 3, 'error');
};

/** Qualifies the exact tarball's portable build and installed CLI on the same read-only fixtures. */
export const verifyPackedPortableCli = async (tarball, installedCli, environment) => {
  const root = await mkdtemp(path.join(tmpdir(), 'moldea-portable-runtime-'));
  try {
    await verifyPortableArtifact(tarball, installedCli, root, environment);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
};
