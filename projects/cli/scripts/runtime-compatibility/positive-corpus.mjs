import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  NODE_CALIBRATION_WORKLOADS,
  createCalibrationEntries,
} from '../../../../scripts/resource-calibration/fixtures.ts';

const executeFile = promisify(execFile);

// expected diagnostic totals belong to the reviewed synthetic fixture contracts
const EXPECTED_COUNTS = {
  ordinary: [0, 1],
  'shared-source-many-agent': [64, 1],
  'broad-tool': [0, 65],
  'deep-eve': [0, 0],
  'broad-eve': [0, 0],
  'dense-eve-8': [0, 0],
  'dense-eve-16': [0, 0],
  'dense-eve-32': [0, 0],
  'dense-diagnostic': [64, 66],
  'large-source': [0, 1],
  'multi-page': [64, 1],
  'distinct-source': [64, 1],
  'over-capacity': [64, 1],
  'cyclic-alias': [0, 2],
  'deep-syntax': [0, 1],
  'large-syntax': [0, 1],
  'mixed-adapters': [0, 325],
  'imported-mutation': [64, 1],
  'large-comment': [0, 1],
  'large-template': [0, 1],
  'large-regex': [0, 1],
  'large-jsx': [0, 1],
  'large-function-comment': [0, 1],
  'maximum-diagnostic': [10_000, 0],
};

/**
 * Writes one reviewed fixture within its disposable repository root.
 * @returns Completion after the fixture's files and CLI declaration are written.
 */
const writeFixture = async (root, workload, cliVersion) => {
  const sourceBytes = workload === 'mixed-adapters' ? 2_097_152 : 4_194_304;
  let hasManifest = false;
  for (const entry of createCalibrationEntries(workload, sourceBytes)) {
    assert.equal(entry.type, 'file');
    const target = path.resolve(root, entry.path.slice(1));
    const relative = path.relative(root, target);
    assert.ok(
      relative !== '' && !path.isAbsolute(relative) && relative.split(path.sep)[0] !== '..',
      'A calibration path escaped its owned repository.',
    );
    await mkdir(path.dirname(target), { recursive: true });
    let content = entry.content;
    if (entry.path === '/package.json') {
      const manifest = JSON.parse(content);
      manifest.devDependencies = { ...manifest.devDependencies, '@moldea.ai/cli': cliVersion };
      content = JSON.stringify(manifest);
      hasManifest = true;
    }
    await writeFile(target, content);
  }
  if (!hasManifest)
    await writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ private: true, devDependencies: { '@moldea.ai/cli': cliVersion } }),
    );
};

/**
 * Runs every required positive through cold packed CLI processes, one fixture at a time.
 * @returns Completion after all expected results and disposable repository cleanup.
 */
const verifyPositiveCorpus = async (consumerDirectory, executablePath) => {
  assert.deepEqual(Object.keys(EXPECTED_COUNTS).sort(), [...NODE_CALIBRATION_WORKLOADS].sort());
  const cliManifest = JSON.parse(
    await readFile(path.join(path.dirname(executablePath), '..', 'package.json'), 'utf8'),
  );
  const ownedRoot = await mkdtemp(path.join(consumerDirectory, 'corpus-'));
  try {
    for (const workload of NODE_CALIBRATION_WORKLOADS) {
      const root = path.join(ownedRoot, workload);
      await mkdir(root);
      try {
        await writeFixture(root, workload, cliManifest.version);
        await executeFile('git', ['-c', 'init.defaultBranch=main', 'init'], { cwd: root });
        const [errors, warnings] = EXPECTED_COUNTS[workload];
        for (let sample = 0; sample < 3; sample += 1) {
          const startedAt = performance.now();
          let execution;
          try {
            execution = await executeFile(
              process.execPath,
              [executablePath, 'validate', '--json', '--max-output-bytes', '65536'],
              { cwd: root, maxBuffer: 1_048_576, timeout: 130_000, killSignal: 'SIGKILL' },
            );
            assert.equal(errors, 0, 'An invalid fixture unexpectedly succeeded.');
          } catch (error) {
            assert.equal(error.code, 1, 'The positive corpus had an operational failure.');
            assert.ok(errors > 0, 'A valid fixture unexpectedly failed.');
            execution = error;
          }
          assert.equal(execution.stderr, '');
          const envelope = JSON.parse(execution.stdout);
          assert.equal(envelope.schemaVersion, 6);
          assert.equal(envelope.status, errors === 0 ? 'valid' : 'invalid');
          assert.equal(envelope.result.valid, errors === 0);
          assert.equal(envelope.result.errorCount, errors);
          assert.equal(envelope.result.warningCount, warnings);
          assert.equal(envelope.result.diagnosticCount, errors + warnings);
          assert.equal(envelope.result.formatVersion, 1);
          assert.equal(
            envelope.result.runtimeInspection,
            workload === 'maximum-diagnostic'
              ? 'not-run'
              : warnings === 0
                ? 'complete'
                : 'incomplete',
          );
          process.stdout.write(
            JSON.stringify({
              workload,
              sample,
              elapsedMs: performance.now() - startedAt,
              errors,
              warnings,
            }) + '\n',
          );
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  } finally {
    await rm(ownedRoot, { recursive: true, force: true });
  }
};

assert.equal(process.argv.length, 4, 'Expected the owned consumer and installed executable paths.');
await verifyPositiveCorpus(path.resolve(process.argv[2]), path.resolve(process.argv[3]));
