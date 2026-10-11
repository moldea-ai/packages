import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

// minimal synthetic installation keeps unrelated examples free of integration warnings
const BLOCK_ASSET =
  '<!-- moldea:start -->\nnode "<repo-root>/{{skill-path}}/scripts/relevance-gate.mjs" --repository "<repo-root>"\n<!-- moldea:end -->\n';
export const MANAGED_INTEGRATION_ENTRIES: IMemoryRepositoryEntry[] = [
  {
    path: '/AGENTS.md',
    type: 'file',
    content: BLOCK_ASSET.replaceAll('{{skill-path}}', '.agents/skills/moldea'),
  },
  { path: '/.agents/skills/moldea/SKILL.md', type: 'file', content: 'Synthetic skill.\n' },
  {
    path: '/.agents/skills/moldea/scripts/relevance-gate.mjs',
    type: 'file',
    content: '// Synthetic gate.\n',
  },
  {
    path: '/.agents/skills/moldea/assets/managed-agents-block.md',
    type: 'file',
    content: BLOCK_ASSET,
  },
];
