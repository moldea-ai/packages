import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import type { IPublicPackage } from '../../model/types.ts';
import type { ICapabilityCase, ICapabilityFact } from '../index.ts';
import { withFixtureWorkspace } from '../fixture-workspace/index.ts';
import { assertCapabilityFacts } from '../index.ts';
import { projectFile } from '../index.ts';

import { CLI_FIXTURE_FILES } from './constants.ts';
import {
  CliCollectionResult,
  CliInspectionResult,
  CliCompositionResult,
  CliContentResult,
  type ICliEnvelope,
} from './types.ts';
import { assertCliResultExcerpt, parseCliExecution } from './validations.ts';

const cliManifestSchema = z.object({
  name: z.literal('@moldea.ai/cli'),
  bin: z.object({ moldea: z.string() }),
});
const excludedDirectories = new Set(['_archive', '_archives', '_backup', '_backups']);

/** Runs a native executable with bounded output and no shell, retaining ordinary CLI exit statuses. */
const execute = (
  executable: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  input = '',
): Promise<{ exitStatus: number; stdout: string }> =>
  new Promise((resolve, reject) => {
    let inputFailure: Error | undefined;
    const child = execFile(
      executable,
      args,
      { cwd, env, encoding: 'utf8', maxBuffer: 1_048_576, timeout: 120_000 },
      (error, stdout) => {
        if (error !== null && (typeof error.code !== 'number' || error.killed)) {
          reject(new Error('A capability fixture executable failed.', { cause: error }));
          return;
        }
        if (inputFailure !== undefined && error === null) {
          reject(inputFailure);
          return;
        }
        resolve({ exitStatus: error?.code === undefined ? 0 : Number(error.code), stdout });
      },
    );
    child.stdin?.on('error', (error: NodeJS.ErrnoException) => {
      if (input !== '' || error.code !== 'EPIPE') inputFailure = error;
    });
    child.stdin?.end(input);
  });

/** Fingerprints only the disposable fixture, including its index, refs, objects, and configuration. */
const captureFixtureState = async (directory: string): Promise<string> => {
  const hash = createHash('sha256');
  const visit = async (relativeDirectory: string): Promise<void> => {
    const entries = await readdir(path.join(directory, relativeDirectory), { withFileTypes: true });
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      if (excludedDirectories.has(entry.name)) continue;
      const relative = path.join(relativeDirectory, entry.name);
      const nativePath = path.join(directory, relative);
      if (entry.isSymbolicLink()) throw new Error('A CLI fixture contains an unexpected symlink.');
      hash.update(
        JSON.stringify([relative.split(path.sep).join('/'), (await lstat(nativePath)).mode]),
      );
      if (entry.isDirectory()) await visit(relative);
      else hash.update(await readFile(nativePath));
    }
  };
  await visit('');
  return hash.digest('hex');
};

/** Resolves only the declared public executable, rejecting package escapes. */
const resolveCliBin = async (
  repositoryRoot: string,
  packages: IPublicPackage[],
): Promise<string> => {
  const cli = packages.find(({ name }) => name === '@moldea.ai/cli');
  if (cli === undefined) throw new Error('The CLI capability package is unavailable.');
  const directory = await realpath(path.resolve(repositoryRoot, cli.repositoryDirectory));
  const manifest = cliManifestSchema.parse(
    JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')),
  );
  const executable = await realpath(path.resolve(directory, manifest.bin.moldea));
  const relative = path.relative(directory, executable);
  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative) ||
    !executable.endsWith('.js')
  ) {
    throw new Error('The declared CLI capability executable is unsafe.');
  }
  return executable;
};

/**
 * Builds a safe command excerpt without the disposable host path or opaque cursor.
 * @throws
 * - A CLI result excerpt does not match the executed response.
 */
const commandCase = (
  id: string,
  title: string,
  description: string,
  command: string,
  envelope: ICliEnvelope,
  exitStatus: number,
  facts: Record<string, ICapabilityFact>,
  resultExcerpt: ICapabilityFact,
): ICapabilityCase => {
  assertCliResultExcerpt(envelope.result, resultExcerpt);
  return {
    id,
    groupId: 'command-line',
    title,
    description,
    operation: envelope.command,
    packageName: '@moldea.ai/cli',
    limitation:
      'Executed against a synthetic Git working tree. The command does not run its application code.',
    sourcePaths: [
      'projects/cli/docs/commands.md',
      'projects/cli/docs/output-and-operations.md',
      'projects/cli/docs/working-tree.md',
    ],
    files: [],
    result: {
      kind: 'cli',
      command,
      exitStatus,
      schemaVersion: envelope.schemaVersion,
      status: envelope.status,
      facts,
      envelopeExcerpt: {
        cliVersion: envelope.cliVersion,
        command: envelope.command,
        error: envelope.error,
        result: resultExcerpt,
        schemaVersion: envelope.schemaVersion,
        status: envelope.status,
      },
    },
  };
};

/**
 * Executes the declared CLI bin in an isolated Git fixture and verifies its read-only behavior.
 * @returns Validated schema 7 excerpts with real exit statuses and no host-specific identities.
 * @throws
 * - A CLI result excerpt does not match the executed response.
 */
export const createCliExamples = async (
  repositoryRoot: string,
  packages: IPublicPackage[],
): Promise<ICapabilityCase[]> => {
  const executable = await resolveCliBin(repositoryRoot, packages);
  const cliVersion = packages.find(({ name }) => name === '@moldea.ai/cli')?.version;
  if (cliVersion === undefined) throw new Error('The CLI capability package is unavailable.');
  return withFixtureWorkspace(CLI_FIXTURE_FILES, async (workspace) => {
    const env: NodeJS.ProcessEnv = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !name.toUpperCase().startsWith('GIT_')),
      ),
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: path.join(workspace.directory, 'git-settings', 'empty.conf'),
      GIT_OPTIONAL_LOCKS: '0',
    };
    const initialized = await execute(
      'git',
      ['init', '--quiet', '--template=', workspace.directory],
      workspace.directory,
      env,
    );
    assertCapabilityFacts(initialized.exitStatus, 0);
    const tracked = await execute(
      'git',
      ['-c', 'core.autocrlf=false', 'add', '-f', '--', 'moldea/context/tracked.md'],
      workspace.directory,
      env,
    );
    assertCapabilityFacts(tracked.exitStatus, 0);
    const run = async (args: string[], input = '') => {
      const execution = await execute(
        process.execPath,
        [
          executable,
          ...args,
          ...(args[0] === 'composition' ? [] : ['--repository', workspace.directory]),
          '--json',
          '--no-color',
        ],
        workspace.directory,
        env,
        input,
      );
      const command = args[0];
      if (command === undefined) throw new Error('The CLI capability command is missing.');
      const envelope = parseCliExecution(execution, command, cliVersion);
      return { envelope, exitStatus: execution.exitStatus };
    };
    const before = await captureFixtureState(workspace.directory);
    const examples: ICapabilityCase[] = [];
    const validation = await run(['validate']);
    const validationResult = CliInspectionResult.parse(validation.envelope.result);
    assertCapabilityFacts(
      [
        validationResult.valid,
        validationResult.diagnosticCount,
        validationResult.errorCount,
        validationResult.warningCount,
        validationResult.page.records,
      ],
      [true, 0, 0, 0, []],
    );
    examples.push(
      commandCase(
        'cli-validate',
        'Validate the selected working tree',
        'The executable reports a completed structural check and its actual process exit status.',
        'moldea validate --json',
        validation.envelope,
        validation.exitStatus,
        {
          valid: validationResult.valid,
          diagnosticCount: validationResult.diagnosticCount ?? 0,
          errorCount: validationResult.errorCount ?? 0,
          warningCount: validationResult.warningCount ?? 0,
        },
        {
          valid: validationResult.valid,
          diagnosticCount: validationResult.diagnosticCount ?? 0,
          errorCount: validationResult.errorCount ?? 0,
          warningCount: validationResult.warningCount ?? 0,
          page: { records: [] },
        },
      ),
    );
    const inspection = await run(['inspect']);
    const inspectionResult = CliInspectionResult.parse(inspection.envelope.result);
    const paths = inspectionResult.page.records.flatMap((record) =>
      record.kind === 'metadata' ? [record.path] : [],
    );
    assertCapabilityFacts(paths, [
      '/moldea/context/long-policy.md',
      '/moldea/context/tracked.md',
      '/moldea/context/untracked.md',
      '/moldea/moldea.yaml',
      '/moldea/project.md',
    ]);
    examples.push(
      commandCase(
        'cli-inspect-selection',
        'Tracked files and new, non-ignored knowledge',
        'The tracked policy remains selected despite its ignore rule. The untracked policy is included, while the ignored draft is not.',
        'moldea inspect --json',
        inspection.envelope,
        inspection.exitStatus,
        {
          paths,
          counts: inspectionResult.counts ?? {},
          hasContinuation: inspectionResult.page.cursor !== null,
        },
        {
          valid: inspectionResult.valid,
          counts: inspectionResult.counts ?? {},
          page: { records: paths.map((path) => ({ path })) },
        },
      ),
    );
    for (const useStdin of [false, true]) {
      const args = useStdin
        ? ['scope', '--paths-stdin']
        : ['scope', '--path', '/src/returns/policy.ts'];
      const execution = await run(
        args,
        useStdin ? '/src/returns/policy.ts\0/assets/logo.svg\0' : '',
      );
      const result = CliCollectionResult.parse(execution.envelope.result);
      assertCapabilityFacts(
        [
          result.valid,
          result.relevant,
          result.counts?.['matchedPaths'],
          result.counts?.['inputPaths'],
        ],
        [true, true, 1, useStdin ? 2 : 1],
      );
      examples.push(
        commandCase(
          useStdin ? 'cli-scope-stdin' : 'cli-scope-path',
          useStdin ? 'Match a set of changed paths' : 'Ask which knowledge a path affects',
          useStdin
            ? 'NUL-delimited input accepts several logical paths. The unrelated logo does not create a match.'
            : 'The scope operation matches changed paths using only manifest declarations.',
          `moldea ${args.join(' ')} --json`,
          execution.envelope,
          execution.exitStatus,
          {
            relevant: result.relevant ?? false,
            counts: result.counts ?? {},
            matches: result.page.records.flatMap((record) =>
              record.kind !== 'match' || record.match === undefined
                ? []
                : [{ ...record.match, owner: { ...record.match.owner } }],
            ),
          },
          {
            valid: result.valid,
            relevant: result.relevant ?? false,
            counts: result.counts ?? {},
            page: {
              records: result.page.records.flatMap((record) =>
                record.kind !== 'match' || record.match === undefined
                  ? []
                  : [{ kind: record.kind, match: record.match }],
              ),
            },
          },
        ),
      );
    }
    const content = await run(['content', '--path', '/moldea/project.md']);
    const contentResult = CliContentResult.parse(content.envelope.result);
    assertCapabilityFacts(
      contentResult.chunk.content,
      CLI_FIXTURE_FILES.find(({ path }) => path === '/moldea/project.md')?.content,
    );
    examples.push(
      commandCase(
        'cli-canonical-content',
        'Read just the document you need',
        'The command returns one selected document as JSON.',
        'moldea content --path /moldea/project.md --json',
        content.envelope,
        content.exitStatus,
        {
          asset: { ...contentResult.asset },
          chunk: { ...contentResult.chunk },
          hasContinuation: contentResult.cursor !== null,
        },
        { asset: contentResult.asset, chunk: contentResult.chunk },
      ),
    );
    const chunks: ICapabilityFact[] = [];
    let cursor: string | null = null;
    let totalContent = '';
    let firstEnvelope: ICliEnvelope | undefined;
    do {
      const execution = await run([
        'content',
        '--path',
        '/moldea/context/long-policy.md',
        '--max-output-bytes',
        '4096',
        ...(cursor === null ? [] : ['--cursor', cursor]),
      ]);
      firstEnvelope ??= execution.envelope;
      const result = CliContentResult.parse(execution.envelope.result);
      assertCapabilityFacts(
        result.chunk.byteStart,
        new TextEncoder().encode(totalContent).byteLength,
      );
      if (result.chunk.byteEnd <= result.chunk.byteStart)
        throw new Error('A CLI capability content page did not make progress.');
      totalContent += result.chunk.content;
      chunks.push({
        byteStart: result.chunk.byteStart,
        byteEnd: result.chunk.byteEnd,
        totalBytes: result.asset.totalBytes,
        hasContinuation: result.cursor !== null,
      });
      cursor = result.cursor;
    } while (cursor !== null);
    assertCapabilityFacts(
      totalContent,
      CLI_FIXTURE_FILES.find(({ path }) => path === '/moldea/context/long-policy.md')?.content,
    );
    assertCapabilityFacts(chunks.length > 1, true);
    if (firstEnvelope === undefined) throw new Error('A CLI capability content page is missing.');
    const firstContentResult = CliContentResult.parse(firstEnvelope.result);
    examples.push(
      commandCase(
        'cli-content-continuation',
        'Continue within an explicit output budget',
        'The command returns bounded Unicode-safe chunks until the selected document is complete.',
        'moldea content --path /moldea/context/long-policy.md --max-output-bytes 4096 --json',
        firstEnvelope,
        0,
        { chunks },
        {
          asset: firstContentResult.asset,
          chunk: {
            byteStart: firstContentResult.chunk.byteStart,
            byteEnd: firstContentResult.chunk.byteEnd,
          },
        },
      ),
    );
    const refused = await run(['content', '--path', '/src/returns/policy.ts']);
    assertCapabilityFacts(refused.envelope.error?.code, 'CONTENT_PATH_INVALID');
    examples.push(
      commandCase(
        'cli-content-refusal',
        'The content command refuses source code',
        'This command reads project knowledge documents, not application source files.',
        'moldea content --path /src/returns/policy.ts --json',
        refused.envelope,
        refused.exitStatus,
        { error: refused.envelope.error === null ? null : { ...refused.envelope.error } },
        null,
      ),
    );
    const composition = await run(['composition']);
    const compositionResult = CliCompositionResult.parse(composition.envelope.result);
    for (const published of compositionResult.packages)
      assertCapabilityFacts(
        published.version,
        packages.find(({ name }) => name === published.name)?.version,
      );
    assertCapabilityFacts(
      compositionResult.packages.map(({ name }) => name),
      packages
        .filter(({ name }) => name !== '@moldea.ai/cli')
        .map(({ name }) => name)
        .sort(),
    );
    examples.push(
      commandCase(
        'cli-composition',
        'Inspect the installed composition',
        'The executable reports its actual packages, repository formats, and runtime requirements.',
        'moldea composition --json',
        composition.envelope,
        composition.exitStatus,
        { ...compositionResult },
        {
          packages: compositionResult.packages,
          minimumGitVersion: compositionResult.minimumGitVersion,
          repositoryFormatVersions: compositionResult.repositoryFormatVersions,
          supportedNodeRange: compositionResult.supportedNodeRange,
        },
      ),
    );
    assertCapabilityFacts(await captureFixtureState(workspace.directory), before);
    const invalidManifest =
      'version: 1\ncontext:\n  /moldea/project.md:\n    bindings:\n      - path: /src/returns/policy.ts\n        symbol: checkEligibility\n';
    await workspace.write({ path: '/moldea/moldea.yaml', content: invalidManifest });
    const policySource = CLI_FIXTURE_FILES.find(({ path }) => path === '/src/returns/policy.ts');
    if (policySource === undefined || typeof policySource.content !== 'string')
      throw new Error('The policy source fixture is missing.');
    const renamedPolicySource = policySource.content.replace('checkEligibility', 'canReturn');
    if (renamedPolicySource === policySource.content)
      throw new Error('The policy source fixture has no export to rename.');
    await workspace.write({ path: policySource.path, content: renamedPolicySource });
    const beforeInvalid = await captureFixtureState(workspace.directory);
    const invalid = await run(['validate']);
    const invalidResult = CliInspectionResult.parse(invalid.envelope.result);
    assertCapabilityFacts(
      [
        invalid.exitStatus,
        invalidResult.valid,
        invalidResult.diagnosticCount,
        invalidResult.errorCount,
        invalidResult.warningCount,
      ],
      [1, false, 1, 1, 0],
    );
    assertCapabilityFacts(
      invalidResult.page.records.flatMap((record) =>
        record.kind === 'diagnostic'
          ? [{ code: record.code, path: record.path, pointer: record.pointer }]
          : [],
      ),
      [
        {
          code: 'MOLDEA_REFERENCE_EXPORT_MISSING',
          path: '/moldea/moldea.yaml',
          pointer: '/context/~1moldea~1project.md/bindings/0',
        },
      ],
    );
    assertCapabilityFacts(invalidResult.coverageCounts, {
      bindings: 1,
      exportsPassed: 0,
      exportsFailed: 1,
      exportsNotChecked: 0,
    });
    const failedCoverage = invalidResult.page.records.find((record) => record.kind === 'coverage');
    if (
      invalidResult.coverageCounts === undefined ||
      failedCoverage === undefined ||
      failedCoverage.kind !== 'coverage'
    )
      throw new Error('The failed export check did not return its coverage record and counts.');
    assertCapabilityFacts(
      {
        path: failedCoverage.path,
        symbol: failedCoverage.symbol,
        exportCheck: failedCoverage.exportCheck,
      },
      { path: '/src/returns/policy.ts', symbol: 'checkEligibility', exportCheck: 'failed' },
    );
    const invalidRecords = invalidResult.page.records.map((record): ICapabilityFact => {
      if (record.kind === 'diagnostic')
        return {
          kind: record.kind,
          code: record.code,
          path: record.path,
          pointer: record.pointer,
          severity: record.severity,
        };
      if (record.kind === 'coverage')
        return {
          kind: record.kind,
          path: record.path,
          symbol: record.symbol,
          exportCheck: record.exportCheck,
        };
      throw new Error('Validation returned a record outside the diagnostic and coverage contract.');
    });
    const invalidCase = commandCase(
      'cli-invalid-project',
      'A renamed export breaks a declared connection',
      'The manifest still names checkEligibility, but the source exports canReturn.',
      'moldea validate --json',
      invalid.envelope,
      invalid.exitStatus,
      {
        valid: invalidResult.valid,
        diagnosticCount: invalidResult.diagnosticCount ?? 0,
        errorCount: invalidResult.errorCount ?? 0,
        warningCount: invalidResult.warningCount ?? 0,
        coverageCounts: invalidResult.coverageCounts,
        coverage: {
          path: failedCoverage.path,
          symbol: failedCoverage.symbol,
          exportCheck: failedCoverage.exportCheck,
        },
        diagnostics: invalidResult.page.records.flatMap((record) =>
          record.kind === 'diagnostic'
            ? [{ code: record.code, path: record.path, pointer: record.pointer }]
            : [],
        ),
      },
      {
        valid: invalidResult.valid,
        diagnosticCount: invalidResult.diagnosticCount ?? 0,
        errorCount: invalidResult.errorCount ?? 0,
        warningCount: invalidResult.warningCount ?? 0,
        coverageCounts: invalidResult.coverageCounts,
        page: { records: invalidRecords },
      },
    );
    invalidCase.files = [
      projectFile({ path: '/moldea/moldea.yaml', type: 'file', content: invalidManifest }),
      projectFile({
        path: '/src/returns/policy.ts',
        type: 'file',
        content: renamedPolicySource,
      }),
    ].filter((file) => file !== null);
    examples.push(invalidCase);
    assertCapabilityFacts(await captureFixtureState(workspace.directory), beforeInvalid);

    for (const accepted of [false, true]) {
      const acceptance = accepted
        ? `acceptedWarnings:
  - code: MOLDEA_IMPACT_PATTERN_UNMATCHED
    subject: /moldea/project.md
    qualifier: /src/future/**
    reason: The future module is documented before implementation.
`
        : '';
      await workspace.write({
        path: '/moldea/moldea.yaml',
        content: `version: 1
context:
  /moldea/project.md:
    affectedBy:
      - /src/future/**
${acceptance}`,
      });
      const beforeWarning = await captureFixtureState(workspace.directory);
      const warning = await run(['validate']);
      const result = CliInspectionResult.parse(warning.envelope.result);
      assertCapabilityFacts(
        [
          warning.exitStatus,
          result.valid,
          result.diagnosticCount,
          result.errorCount,
          result.warningCount,
          result.acceptedWarningCount,
        ],
        [0, true, 1, 0, accepted ? 0 : 1, accepted ? 1 : 0],
      );
      const [record] = result.page.records;
      if (record?.kind !== 'diagnostic' || record.severity !== 'warning')
        throw new Error('The CLI warning fixture did not produce its warning.');
      assertCapabilityFacts(
        [
          record.code,
          record.group,
          record.subject,
          record.qualifier,
          record.acceptable,
          record.accepted,
          record.reason,
        ],
        [
          'MOLDEA_IMPACT_PATTERN_UNMATCHED',
          'references',
          '/moldea/project.md',
          '/src/future/**',
          true,
          accepted,
          accepted ? 'The future module is documented before implementation.' : null,
        ],
      );
      const diagnostic = {
        code: record.code,
        group: record.group,
        severity: record.severity,
        subject: record.subject,
        qualifier: record.qualifier,
        acceptable: record.acceptable,
        accepted: record.accepted,
        reason: record.reason,
      };
      const counts = {
        valid: result.valid,
        diagnosticCount: result.diagnosticCount ?? 0,
        errorCount: result.errorCount ?? 0,
        warningCount: result.warningCount ?? 0,
        acceptedWarningCount: result.acceptedWarningCount ?? 0,
      };
      examples.push(
        commandCase(
          accepted ? 'cli-accepted-warning' : 'cli-pattern-warning',
          accepted ? 'An accepted warning stays visible' : 'A warning exits successfully',
          accepted
            ? 'The CLI separates accepted warnings from outstanding warnings and preserves the recorded reason.'
            : 'An unmatched pattern is a warning. It does not turn a completed check into an invalid project.',
          'moldea validate --json',
          warning.envelope,
          warning.exitStatus,
          { ...counts, diagnostics: [diagnostic] },
          { ...counts, page: { records: [{ kind: 'diagnostic', ...diagnostic }] } },
        ),
      );
      assertCapabilityFacts(await captureFixtureState(workspace.directory), beforeWarning);
    }
    return examples;
  });
};
