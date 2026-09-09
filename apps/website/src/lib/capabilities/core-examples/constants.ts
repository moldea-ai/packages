import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

// small returns-policy repository shared by the authored Core examples
export const MANIFEST_PATH = '/moldea/moldea.yaml';
export const PROJECT_PATH = '/moldea/project.md';
export const PROJECT_TEXT =
  '# Returns service\n\nExplain return eligibility using the published policy.\n';
export const INSTRUCTION_PATH = '/moldea/agents/support/instruction.md';
export const INSTRUCTION_TEXT =
  'You are the `support` agent.\n\nExplain the return policy for {{REGION}}.\n';
export const AGENT_MANIFEST = `version: 1
agents:
  support:
    runtime: { id: custom }
    variables:
      REGION:
        description: The customer service region.
`;

/** Builds a fresh synthetic snapshot without sharing mutable fixture arrays. */
export const createCoreEntries = (
  manifest = 'version: 1\n',
  additionalEntries: IMemoryRepositoryEntry[] = [],
): IMemoryRepositoryEntry[] => [
  { path: MANIFEST_PATH, type: 'file', content: manifest },
  { path: PROJECT_PATH, type: 'file', content: PROJECT_TEXT },
  ...additionalEntries,
];

/** Provides canonical files for a registered customer-support agent. */
export const createAgentEntries = (manifest = AGENT_MANIFEST): IMemoryRepositoryEntry[] =>
  createCoreEntries(manifest, [
    {
      path: '/moldea/agents/support/description.md',
      type: 'file',
      content: 'Explains return eligibility.\n',
    },
    { path: INSTRUCTION_PATH, type: 'file', content: INSTRUCTION_TEXT },
  ]);
