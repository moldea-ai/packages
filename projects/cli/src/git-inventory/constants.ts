import { parseRepositoryPath } from '@moldea.ai/repository';

// fixed read-only Git commands used to enumerate raw working-tree candidates
export const GIT_TRACKED_INVENTORY_ARGUMENTS = [
  'ls-files',
  '--cached',
  '--stage',
  '--full-name',
  '--no-abbrev',
  '--no-recurse-submodules',
  '-z',
  '--',
] as const;

export const GIT_UNTRACKED_INVENTORY_ARGUMENTS = [
  'ls-files',
  '--others',
  '--exclude-standard',
  '--full-name',
  '--no-recurse-submodules',
  '-z',
  '--',
] as const;

// ignored untracked candidates, probed only for the literal coding-agent instruction paths
export const GIT_IGNORED_INVENTORY_ARGUMENTS = [
  'ls-files',
  '--others',
  '--ignored',
  '--exclude-standard',
  '--full-name',
  '--no-recurse-submodules',
  '-z',
  '--',
] as const;

// coding-agent instruction paths visible to Core's integration check even when Git ignores them
export const INSTRUCTION_PATHS = Object.freeze(
  ['/AGENTS.md', '/CLAUDE.md', '/.claude/CLAUDE.md', '/CLAUDE.local.md'].map((path) =>
    parseRepositoryPath(path),
  ),
);

// Git index modes accepted by the version 1 inventory grammar
export const GIT_TRACKED_ENTRY_MODES = ['100644', '100755', '120000', '160000'] as const;
