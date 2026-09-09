import type { ICapabilityGroupId } from './types.ts';

// finite, release-owned sections; explanatory copy is not a second capability authority
export const CAPABILITY_GROUPS: { id: ICapabilityGroupId; title: string; description: string }[] = [
  {
    id: 'structure',
    title: 'Repository structure and connections',
    description: 'Check the project map, its documents, and the files they reference.',
  },
  {
    id: 'agents',
    title: 'Agent instructions and declared assets',
    description: 'Connect instructions, variables, tools, skills, and mirrors.',
  },
  {
    id: 'decisions',
    title: 'Decision history and relationships',
    description: 'Keep decision identities, statuses, and replacement chains consistent.',
  },
  {
    id: 'runtime-wiring',
    title: 'Runtime wiring',
    description: 'Inspect supported source patterns without running the application.',
  },
  {
    id: 'repository-access',
    title: 'Reading, comparing, and finding affected knowledge',
    description: 'Read bounded results and trace changed paths to their declared owners.',
  },
  {
    id: 'command-line',
    title: 'Using the checks from the command line',
    description: 'Run the same operations against a selected Git working tree.',
  },
];

// editorial emphasis only; all remaining cases are rendered as concise example rows
export const FEATURED_CAPABILITY_CASES = {
  structure: ['manifest-unknown-property', 'policy-reference-directory'],
  agents: ['variable-undeclared', 'mirror-stale'],
  decisions: ['decision-replacement-chain', 'decision-cycle'],
  'runtime-wiring': [],
  'repository-access': [
    'manifest-change-relevance',
    'snapshot-comparison',
    'canonical-content-pages',
    'normalized-digests',
  ],
  'command-line': [
    'cli-validate',
    'cli-inspect-selection',
    'cli-scope-path',
    'cli-scope-stdin',
    'cli-canonical-content',
    'cli-content-continuation',
    'cli-content-refusal',
    'cli-composition',
    'cli-invalid-project',
  ],
} satisfies Record<ICapabilityGroupId, string[]>;
