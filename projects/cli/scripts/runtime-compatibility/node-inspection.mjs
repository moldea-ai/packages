import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { lstat, opendir, readFile, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);

/**
 * Observes only metadata in bounded known crash locations, without opening reports.
 * @returns Bounded observations of available locations and matching artifact metadata.
 */
const observeCrashArtifacts = async (consumerDirectory) => {
  const locations = [['owned-repository', consumerDirectory]];
  if (process.platform === 'darwin')
    locations.push(
      ['user-diagnostics', path.join(homedir(), 'Library', 'Logs', 'DiagnosticReports')],
      ['system-diagnostics', '/Library/Logs/DiagnosticReports'],
      ['cores', '/cores'],
    );
  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA)
      locations.push(
        ['local-crash-dumps', path.join(process.env.LOCALAPPDATA, 'CrashDumps')],
        [
          'user-report-queue',
          path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'WER', 'ReportQueue'),
        ],
      );
    if (process.env.ProgramData)
      locations.push([
        'system-report-queue',
        path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'WER', 'ReportQueue'),
      ]);
  }
  const observations = new Map();
  for (const [label, directory] of locations) {
    const artifacts = new Map();
    try {
      let entries = 0;
      for await (const entry of await opendir(directory)) {
        assert.ok(++entries <= 512, 'A crash-observation directory exceeded its metadata bound.');
        if (
          !/^(?:core(?:\.|$)|node.*\.(?:dmp|ips|crash)$|appcrash_node|report\..*\.json$|heap\..*\.heapsnapshot$)/iu.test(
            entry.name,
          )
        )
          continue;
        const metadata = await lstat(path.join(directory, entry.name));
        artifacts.set(entry.name, `${metadata.size}:${metadata.mtimeMs}`);
      }
      observations.set(label, { available: true, artifacts });
    } catch (error) {
      if (!['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) throw error;
      observations.set(label, { available: false, artifacts });
    }
  }
  return observations;
};

/** Waits only for the known qualification subprocess, never arbitrary host processes. */
const waitForOwnedExit = async (pid) => {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === 'ESRCH') return;
      throw error;
    }
    await setTimeout(20);
  }
  throw new Error('The owned inspection supervisor survived parent termination.');
};

/**
 * Exercises the real packed Node export, handled worker exhaustion, and parent loss.
 * @returns Completion after assertions and owned process/file cleanup.
 */
export const verifyPackedNodeInspection = async (consumerDirectory, environment) => {
  const crashBaseline = await observeCrashArtifacts(consumerDirectory);
  const markerPath = path.join(consumerDirectory, 'node-worker-ready.json');
  const blockedRegistryPath = path.join(consumerDirectory, 'node-blocked-registry.mjs');
  const emptyRegistryPath = path.join(consumerDirectory, 'node-empty-registry.mjs');
  const heapRegistryPath = path.join(consumerDirectory, 'node-heap-registry.mjs');
  const probePath = path.join(consumerDirectory, 'node-inspection-probe.mjs');
  const parentPath = path.join(consumerDirectory, 'node-inspection-parent.mjs');
  const privateMarker = 'moldea-private-worker-capacity-fixture';
  const imports = `
    import { createNodeProjectInspection } from '@moldea.ai/core/node';
    import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';
  `;
  await writeFile(emptyRegistryPath, 'export const adapters = [];\n');
  await writeFile(
    blockedRegistryPath,
    `
    import { writeFileSync } from 'node:fs';
    writeFileSync(${JSON.stringify(markerPath)}, JSON.stringify({ pid: process.pid }));
    while (true) {}
    export const adapters = [];
  `,
  );
  await writeFile(
    heapRegistryPath,
    `
    const retained = [];
    while (true) retained.push(new Array(16_384).fill(${JSON.stringify(privateMarker)}));
    export const adapters = [];
  `,
  );
  await writeFile(
    probePath,
    `
    import assert from 'node:assert/strict';
    import { unlink } from 'node:fs/promises';
    ${imports}
    const repository = createMemoryRepositoryReader([]);
    const adapterRegistryUrl = new URL('./node-empty-registry.mjs', import.meta.url);
    const inspection = await createNodeProjectInspection({ repository, adapterRegistryUrl });
    try {
      assert.ok(inspection.maxAnalysisHeapBytes > 0);
      await assert.rejects(createNodeProjectInspection({ repository, adapterRegistryUrl }),
        { code: 'INSPECTION_BUSY', retryable: true });
      const page = await inspection.readPage({ view: 'metadata', maxItems: 1 });
      assert.equal(page.inspectionDigest, inspection.inspectionDigest);
    } finally { await inspection.dispose(); }
    await inspection.dispose();
    await assert.rejects(createNodeProjectInspection({ repository,
      adapterRegistryUrl: new URL('./node-blocked-registry.mjs', import.meta.url),
      deadline: Date.now() + 5_000,
    }), { code: 'INSPECTION_TIMEOUT', retryable: true });
    await unlink(${JSON.stringify(markerPath)});
    let actualHeap;
    await assert.rejects(createNodeProjectInspection({ repository,
      adapterRegistryUrl: new URL('./node-heap-registry.mjs', import.meta.url),
    }), error => {
      assert.equal(error.code, 'RESOURCE_LIMIT_EXCEEDED');
      assert.equal(error.limit, 'maxAnalysisHeapBytes');
      assert.equal(error.observedUsage, null);
      assert.equal(error.nextAction, 'review-inspection-capacity');
      assert.ok(error.limitMaximum > 0);
      actualHeap = error.limitMaximum;
      return true;
    });
    const next = await createNodeProjectInspection({ repository, adapterRegistryUrl });
    await next.dispose();
    process.stdout.write(JSON.stringify({ actualHeap }));
  `,
  );
  await writeFile(
    parentPath,
    `
    ${imports}
    await createNodeProjectInspection({ repository: createMemoryRepositoryReader([]),
      adapterRegistryUrl: new URL('./node-blocked-registry.mjs', import.meta.url),
    });
  `,
  );
  let parent;
  let parentClosed;
  let supervisorPid;
  const cleanupOwnedResources = async () => {
    let cleanupFailure;
    try {
      if (parent !== undefined && parent.exitCode === null && parent.signalCode === null)
        parent.kill('SIGKILL');
      await parentClosed;
      if (supervisorPid !== undefined) {
        try {
          await waitForOwnedExit(supervisorPid);
        } catch (error) {
          try {
            process.kill(supervisorPid, 'SIGKILL');
          } catch (cause) {
            if (cause.code !== 'ESRCH') throw cause;
          }
          await waitForOwnedExit(supervisorPid);
          cleanupFailure = error;
        }
      }
    } catch (error) {
      cleanupFailure = error;
    }
    const removals = await Promise.allSettled(
      [
        markerPath,
        blockedRegistryPath,
        emptyRegistryPath,
        heapRegistryPath,
        probePath,
        parentPath,
      ].map(async (ownedPath) => {
        try {
          await unlink(ownedPath);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }),
    );
    const failedRemoval = removals.find((result) => result.status === 'rejected');
    if (cleanupFailure !== undefined) throw cleanupFailure;
    if (failedRemoval !== undefined) throw failedRemoval.reason;
  };
  try {
    const result = await executeFile(process.execPath, [probePath], {
      cwd: consumerDirectory,
      env: environment,
      encoding: 'utf8',
      maxBuffer: 16_384,
      timeout: 30_000,
    });
    assert.equal(result.stderr, '', 'Handled worker exhaustion wrote stderr.');
    assert.ok(!result.stdout.includes(privateMarker), 'Worker exhaustion exposed source text.');
    assert.ok(JSON.parse(result.stdout).actualHeap > 0);

    parent = spawn(process.execPath, [parentPath], {
      cwd: consumerDirectory,
      env: environment,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    parentClosed = new Promise((resolve, reject) => {
      parent.once('error', reject);
      parent.once('close', resolve);
    });
    const readinessDeadline = Date.now() + 5_000;
    while (Date.now() < readinessDeadline) {
      try {
        supervisorPid = JSON.parse(await readFile(markerPath, 'utf8')).pid;
        break;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await setTimeout(20);
    }
    assert.ok(
      Number.isSafeInteger(supervisorPid) && supervisorPid > 0,
      'The computing worker did not report its owned supervisor.',
    );
    parent.kill('SIGKILL');
    await parentClosed;
    await waitForOwnedExit(supervisorPid);
    const crashAfter = await observeCrashArtifacts(consumerDirectory);
    const crashObservation = [...crashAfter].map(([location, observation]) => ({
      location,
      available: observation.available,
      changedArtifacts: [...observation.artifacts].filter(
        ([name, metadata]) => crashBaseline.get(location)?.artifacts.get(name) !== metadata,
      ).length,
    }));
    process.stdout.write(JSON.stringify({ platform: process.platform, crashObservation }) + '\n');
    assert.ok(
      crashObservation.every((observation) => observation.changedArtifacts === 0),
      'Expected worker exhaustion or parent termination created a crash artifact.',
    );
  } finally {
    await cleanupOwnedResources();
  }
};
