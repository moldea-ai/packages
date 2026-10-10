import type { ICapabilityGroup } from './types.ts';

// each section leads with four cases, then exposes every other executed case in catalog order
export const CAPABILITY_GROUPS: ICapabilityGroup[] = [
  {
    id: 'structure',
    label: 'Files',
    title: 'Catch broken file connections.',
    description: 'Validate project files, text, declarations, and their connections.',
    coverage: [
      'formats, names and paths',
      'required files and valid text',
      'context and code references',
    ],
    featuredExampleIds: [
      'policy-reference-missing',
      'policy-reference-connected',
      'manifest-duplicate-key',
      'foundation-missing',
    ],
    reference: { route: '/packages/core/diagnostics/', label: 'Explore structural checks' },
  },
  {
    id: 'agents',
    label: 'Agents',
    title: 'Keep agent files in sync.',
    description: 'Check instructions, variables, tools, skills, and their declared ownership.',
    coverage: [
      'agent identity and descriptions',
      'variables and their sources',
      'tools, skills and runtimes',
      'instruction copies and ownership',
    ],
    featuredExampleIds: [
      'mirror-stale',
      'tool-implementation-missing',
      'variable-undeclared',
      'skill-implementation-missing',
    ],
    reference: { route: '/repository-format/', label: 'Explore agent declarations' },
  },
  {
    id: 'decisions',
    label: 'Decisions',
    title: 'Keep a consistent decision history.',
    description: 'Validate decision records, replacement chains, and implementation references.',
    coverage: [
      'record format, dates and unique IDs',
      'replacement links and status',
      'missing links and cycles',
    ],
    featuredExampleIds: [
      'decision-replacement-chain',
      'decision-cycle',
      'decision-reference-missing',
      'decision-relationship-accepted',
    ],
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
      'version-sensitive behavior and scoped warnings',
    ],
    featuredExampleIds: [
      'openai-responses',
      'openai-loader-disconnected',
      'langchain-middleware-warning',
      'openai-agent-handoffs',
    ],
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
      'read limits, pagination and snapshot consistency',
    ],
    featuredExampleIds: [
      'snapshot-comparison',
      'manifest-change-relevance',
      'inspection-mixed-diagnostics',
      'canonical-content-pages',
    ],
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
    featuredExampleIds: [
      'cli-invalid-project',
      'cli-version-warning',
      'cli-content-continuation',
      'cli-composition',
    ],
    reference: { route: '/packages/cli/commands/', label: 'Explore CLI commands' },
  },
];
