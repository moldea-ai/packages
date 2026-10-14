import { stringify } from 'yaml';
import {
  createCore,
  type IBindingCoverage,
  type IDiagnostic,
  type IExportNotCheckedReason,
} from '@moldea.ai/core';
import {
  createMemoryRepositoryReader,
  type IMemoryRepositoryEntry,
} from '@moldea.ai/repository/memory';

import type { ICapabilityCase } from '../types.ts';
import { assertCapabilityFacts } from '../validations.ts';
import { projectDiagnostics, projectFile } from '../transformers.ts';
import { createRecordedOutput } from '../output/index.ts';
import { MANAGED_INTEGRATION_ENTRIES } from '../integration-fixture/index.ts';

// each expectation is authored independently of the executed Core result
const DEFINITIONS: {
  id: string;
  title: string;
  description: string;
  path?: string;
  source?: string;
  exportCheck?: IBindingCoverage['exportCheck'];
  reason?: IExportNotCheckedReason;
  codes: IDiagnostic['code'][];
  pattern?: boolean;
  acceptance?: 'matched' | 'unmatched';
  integration?: 'missing' | 'skill-missing' | 'stale';
}[] = [
  {
    id: 'binding-export-passed',
    title: 'A declared export exists',
    description: 'The declared file exists and its TypeScript export list contains canReturn.',
    source: 'export const canReturn = () => true;\n',
    exportCheck: 'passed',
    codes: [],
  },
  {
    id: 'binding-export-missing',
    title: 'The file exists, but its export is missing',
    description:
      'A complete export list names another symbol, so the declared export fails its check.',
    source: 'export const anotherRule = () => true;\n',
    exportCheck: 'failed',
    codes: ['MOLDEA_REFERENCE_EXPORT_MISSING'],
  },
  {
    id: 'binding-javascript',
    title: 'JavaScript ESM uses the same export check',
    description: 'An explicit JavaScript ESM export can be checked without identifying its SDK.',
    path: '/src/returns.js',
    source: 'export const canReturn = () => true;\n',
    exportCheck: 'passed',
    codes: [],
  },
  {
    id: 'binding-commonjs',
    title: 'A CommonJS export cannot be checked',
    description:
      'File existence passes. CommonJS is outside the export checker, so its export remains not checked.',
    path: '/src/returns.cjs',
    source: 'module.exports.canReturn = () => true;\n',
    exportCheck: 'not-checked',
    reason: 'unsupported-file-type',
    codes: [],
  },
  {
    id: 'binding-unresolved',
    title: 'A re-export leaves the export list incomplete',
    description:
      'Core does not report a missing export when resolving another module would be required.',
    source: 'export * from "./policy.js";\n',
    exportCheck: 'not-checked',
    reason: 'unresolved-exports',
    codes: [],
  },
  {
    id: 'binding-unparseable',
    title: 'Malformed source leaves its export unchecked',
    description: 'File existence passes, but invalid source cannot establish an export list.',
    source: 'export const = ;\n',
    exportCheck: 'not-checked',
    reason: 'unparseable-source',
    codes: [],
  },
  {
    id: 'warning-unmatched-pattern',
    title: 'An impact pattern matches no file',
    description:
      'An unmatched impact pattern produces a warning while the declared file and export checks still pass.',
    pattern: true,
    codes: ['MOLDEA_IMPACT_PATTERN_UNMATCHED'],
  },
  {
    id: 'warning-accepted',
    title: 'An accepted warning keeps its identity and reason',
    description:
      'The manifest records why a future module has no files yet. The warning remains visible in accepted-warning counts.',
    pattern: true,
    acceptance: 'matched',
    codes: ['MOLDEA_IMPACT_PATTERN_UNMATCHED'],
  },
  {
    id: 'warning-acceptance-unmatched',
    title: 'An acceptance no longer matches a warning',
    description:
      'A completed check reports the stale acceptance. This warning cannot itself be accepted.',
    acceptance: 'unmatched',
    codes: ['MOLDEA_ACCEPTANCE_UNMATCHED'],
  },
  {
    id: 'integration-block-missing',
    title: 'The coding-agent integration block is missing',
    description:
      'The integration group reports that the root AGENTS.md has no managed moldea block.',
    integration: 'missing',
    codes: ['MOLDEA_INTEGRATION_BLOCK_MISSING'],
  },
  {
    id: 'integration-skill-missing',
    title: 'The integration points to an absent skill',
    description:
      'A managed block exists, but its referenced installation lacks a required skill file.',
    integration: 'skill-missing',
    codes: ['MOLDEA_INTEGRATION_SKILL_MISSING'],
  },
  {
    id: 'integration-block-stale',
    title: 'The managed block differs from its installed asset',
    description: 'Core compares the block with the installed template without executing the skill.',
    integration: 'stale',
    codes: ['MOLDEA_INTEGRATION_BLOCK_STALE'],
  },
];

/**
 * Executes finite synthetic bindings and pins their coverage, warning identity, and counts.
 * @returns The verified binding and warning examples.
 * @throws
 * - A capability example produced unexpected facts.
 * - The integration fixture is missing.
 * - The pattern warning is missing.
 */
export const createBindingExamples = async (): Promise<ICapabilityCase[]> => {
  const examples: ICapabilityCase[] = [];
  for (const definition of DEFINITIONS) {
    const sourcePath = definition.path ?? '/src/returns.ts';
    const pattern = '/src/future/**';
    const reason = 'The future module is intentionally documented before its implementation.';
    const manifest = stringify({
      version: 1,
      context: {
        '/moldea/project.md': {
          bindings: [{ path: sourcePath, symbol: 'canReturn' }],
          ...(definition.pattern ? { affectedBy: [pattern] } : {}),
        },
      },
      ...(definition.acceptance === undefined
        ? {}
        : {
            acceptedWarnings: [
              {
                code: 'MOLDEA_IMPACT_PATTERN_UNMATCHED',
                subject: '/moldea/project.md',
                qualifier: pattern,
                reason,
              },
            ],
          }),
    });
    let integration = structuredClone(MANAGED_INTEGRATION_ENTRIES).filter(
      ({ path }) =>
        !(definition.integration === 'missing' && path === '/AGENTS.md') &&
        !(definition.integration === 'skill-missing' && path.endsWith('/SKILL.md')),
    );
    if (definition.integration === 'stale') {
      const block = integration.find(({ path }) => path === '/AGENTS.md');
      if (block?.type !== 'file' || typeof block.content !== 'string')
        throw new Error('The integration fixture is missing.');
      const content = block.content.replace(
        '<!-- moldea:end -->',
        'Extra instruction.\n<!-- moldea:end -->',
      );
      integration = integration.map((entry) => (entry === block ? { ...entry, content } : entry));
    }
    const entries: IMemoryRepositoryEntry[] = [
      ...integration,
      { path: '/moldea/moldea.yaml', type: 'file', content: manifest },
      {
        path: '/moldea/project.md',
        type: 'file',
        content: '# Return policy\n\nReturns within 30 days.\n',
      },
      {
        path: sourcePath,
        type: 'file',
        content: definition.source ?? 'export const canReturn = () => true;\n',
      },
    ];
    const result = await createCore().validateProject({
      repository: createMemoryRepositoryReader(entries),
    });
    assertCapabilityFacts(
      result.diagnostics.map(({ code }) => code),
      definition.codes,
    );
    const exportCheck = definition.exportCheck ?? 'passed';
    assertCapabilityFacts(result.coverage, [
      {
        entity: { contextPath: '/moldea/project.md' },
        relationship: 'context-binding',
        path: sourcePath,
        symbol: 'canReturn',
        fileCheck: 'passed',
        exportCheck,
        ...(definition.reason === undefined ? {} : { exportNotCheckedReason: definition.reason }),
      },
    ]);
    assertCapabilityFacts(result.coverageCounts, {
      bindings: 1,
      exportsPassed: exportCheck === 'passed' ? 1 : 0,
      exportsFailed: exportCheck === 'failed' ? 1 : 0,
      exportsNotChecked: exportCheck === 'not-checked' ? 1 : 0,
    });
    assertCapabilityFacts(
      [result.valid, result.errorCount, result.warningCount, result.acceptedWarningCount],
      [
        exportCheck !== 'failed',
        exportCheck === 'failed' ? 1 : 0,
        definition.codes.length > 0 &&
        exportCheck !== 'failed' &&
        definition.acceptance !== 'matched'
          ? 1
          : 0,
        definition.acceptance === 'matched' ? 1 : 0,
      ],
    );
    if (definition.pattern) {
      const warning = result.diagnostics[0];
      if (warning?.severity !== 'warning') throw new Error('The pattern warning is missing.');
      assertCapabilityFacts(
        [
          warning.group,
          warning.subject,
          warning.qualifier,
          warning.acceptable,
          warning.accepted === true,
          warning.accepted === true ? warning.reason : null,
        ],
        [
          'references',
          '/moldea/project.md',
          pattern,
          true,
          definition.acceptance === 'matched',
          definition.acceptance === 'matched' ? reason : null,
        ],
      );
    }
    examples.push({
      id: definition.id,
      groupId: 'binding-coverage',
      title: definition.title,
      description: definition.description,
      limitation:
        'These checks establish file existence and export syntax. They do not establish runtime wiring, SDK compatibility, or application behavior.',
      packageName: '@moldea.ai/core',
      operation: 'validateProject',
      sourcePaths: [
        'projects/core/docs/diagnostics.md',
        'projects/core/docs/repository-inspection.md',
        'specifications/repository-format.md',
      ],
      files: entries
        .filter(({ path }) => path === '/moldea/moldea.yaml' || path === sourcePath)
        .map((entry) => projectFile(entry))
        .filter((file) => file !== null),
      output: createRecordedOutput([result]),
      result: {
        kind: 'validation',
        valid: result.valid,
        errorCount: result.errorCount,
        warningCount: result.warningCount,
        acceptedWarningCount: result.acceptedWarningCount,
        diagnostics: projectDiagnostics(result.diagnostics),
        coverage: structuredClone([...result.coverage]),
        coverageCounts: { ...result.coverageCounts },
      },
    });
  }
  return examples;
};
