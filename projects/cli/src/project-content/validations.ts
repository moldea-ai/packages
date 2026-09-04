import { parseRepositoryPath, type IRepositoryPath } from '@moldea.ai/repository';

import { MoldeaCliProjectContentException } from './exception.js';

const CONTEXT_PATH_PATTERN = /^\/moldea\/context\/(?:[^/]+\/)*[^/]+\.md$/u;
const DECISION_PATH_PATTERN = /^\/moldea\/decisions\/[^/]+\.md$/u;
const RUNTIME_PATH_PATTERN = /^\/moldea\/runtimes\/(?:[^/]+\/)*[^/]+\.md$/u;
const AGENT_PATH_PATTERN =
  /^\/moldea\/agents\/[^/]+\/(?:description|instruction|handoff-description)\.md$/u;

/** Determines whether a logical path names one canonical moldea text asset. */
export const isMoldeaCliCanonicalContentPath = (path: IRepositoryPath): boolean => {
  if (/[?*[\]{}]/u.test(path)) {
    return false;
  }

  return (
    path === '/moldea/moldea.yaml' ||
    path === '/moldea/project.md' ||
    CONTEXT_PATH_PATTERN.test(path) ||
    DECISION_PATH_PATTERN.test(path) ||
    RUNTIME_PATH_PATTERN.test(path) ||
    AGENT_PATH_PATTERN.test(path)
  );
};

/**
 * Parses one untrusted path and restricts it to the canonical text layout.
 * @param input The command-line logical path.
 * @returns The validated canonical repository path.
 * @throws
 * - CONTENT_PATH_INVALID: The content path must identify one canonical moldea text asset.
 */
export const parseMoldeaCliCanonicalContentPath = (input: string): IRepositoryPath => {
  let path: IRepositoryPath;

  try {
    path = parseRepositoryPath(input);
  } catch {
    throw new MoldeaCliProjectContentException('CONTENT_PATH_INVALID');
  }

  if (!isMoldeaCliCanonicalContentPath(path)) {
    throw new MoldeaCliProjectContentException('CONTENT_PATH_INVALID');
  }

  return path;
};
