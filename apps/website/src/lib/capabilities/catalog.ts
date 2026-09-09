import type { ICapabilityGroup } from './types.ts';

// the public page is a curated introduction; the complete executable catalog stays internal
export const CAPABILITY_GROUPS: ICapabilityGroup[] = [
  {
    id: 'structure',
    label: 'Files',
    title: 'Catch broken file connections.',
    description: 'See when a file your project points to is missing.',
    coverage: [
      'formats, names and paths',
      'required files and valid text',
      'context and code references',
    ],
    exampleIds: ['policy-reference-missing', 'foundation-missing', 'policy-reference-directory'],
    reference: { route: '/packages/core/diagnostics/', label: 'Explore structural checks' },
  },
  {
    id: 'agents',
    label: 'Agents',
    title: 'Keep agent files in sync.',
    description: 'Catch undeclared variables and instruction copies that no longer match.',
    coverage: [
      'agent identity and descriptions',
      'variables and their sources',
      'tools, skills and runtimes',
      'instruction copies and ownership',
    ],
    exampleIds: [
      'variable-undeclared',
      'mirror-stale',
      'agent-identity',
      'tool-implementation-missing',
    ],
    reference: { route: '/repository-format/', label: 'Explore agent declarations' },
  },
  {
    id: 'decisions',
    label: 'Decisions',
    title: 'Keep a consistent decision history.',
    description: 'Check that each decision correctly replaces the one before it.',
    coverage: [
      'record format, dates and unique IDs',
      'replacement links and status',
      'missing links and cycles',
    ],
    exampleIds: ['decision-replacement-chain', 'decision-cycle', 'decision-reference-missing'],
    reference: { route: '/repository-format/', label: 'Explore decision records' },
  },
  {
    id: 'runtime-wiring',
    label: 'Runtime',
    title: 'See how the code is connected.',
    description: 'See how supported code connects instructions and tools, without running it.',
    coverage: [
      'instruction and tool connections',
      'schemas, handoffs and workflows',
      'runtime-specific limits',
    ],
    exampleIds: ['openai-responses', 'openai-loader-disconnected'],
    reference: { route: '/adapters/', label: 'Find your runtime and its scope' },
  },
  {
    id: 'repository-access',
    label: 'Repository',
    title: 'Read the files. Track the changes.',
    description: 'Read project files and see exactly what changed between snapshots.',
    coverage: [
      'file metadata and content',
      'changed paths and their declared owners',
      'normalized text and content hashes',
      'read limits, cancellation and snapshot consistency',
    ],
    exampleIds: ['snapshot-comparison', 'manifest-change-relevance', 'normalized-digests'],
    reference: {
      route: '/packages/repository/reader-contract/',
      label: 'Explore repository access',
    },
  },
  {
    id: 'command-line',
    label: 'Automation',
    title: 'Make checks part of your workflow.',
    description: 'Run the same checks locally or in CI, with results your tools can use.',
    coverage: [
      'validation, inspection, content and scope',
      'JSON output and exit codes',
      'installed packages and adapters',
    ],
    exampleIds: ['cli-invalid-project', 'cli-canonical-content', 'cli-content-refusal'],
    reference: { route: '/packages/cli/commands/', label: 'Explore CLI commands' },
  },
];
