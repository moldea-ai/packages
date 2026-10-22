import { parseRepositoryPath } from '@moldea.ai/repository';

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

// the Git subcommand jg-git-commands' index and untracked listing reads run
export const GIT_INVENTORY_LISTING_SUBCOMMAND = 'ls-files';

// coding-agent instruction paths visible to Core's integration check even when Git ignores them
export const INSTRUCTION_PATHS = Object.freeze(
  ['/AGENTS.md', '/CLAUDE.md', '/.claude/CLAUDE.md', '/CLAUDE.local.md'].map((path) =>
    parseRepositoryPath(path),
  ),
);

/*
 * Bytes each `ls-files --stage -z` record takes besides its path: the mode, the longest object
 * name, SHA-256's 64 characters, the stage, two spaces, a tab, and the NUL. Counting the longest
 * name spends a SHA-1 repository's metadata budget slightly early, never late.
 */
export const GIT_TRACKED_RECORD_OVERHEAD_BYTES = 75;

// Git index modes accepted by the version 1 inventory grammar
export const GIT_TRACKED_ENTRY_MODES = ['100644', '100755', '120000', '160000'] as const;
