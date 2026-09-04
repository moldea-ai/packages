// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { MoldeaCliProjectContentException } from './exception.js';
import { parseMoldeaCliCanonicalContentPath } from './validations.js';

describe('canonical content paths', () => {
  test.each([
    '/moldea/moldea.yaml',
    '/moldea/project.md',
    '/moldea/context/packages/core.md',
    '/moldea/decisions/1788487193-adopt.md',
    '/moldea/runtimes/providers/openai.md',
    '/moldea/agents/reviewer/description.md',
    '/moldea/agents/reviewer/instruction.md',
    '/moldea/agents/reviewer/handoff-description.md',
  ])('accepts canonical file %s', (path) => {
    expect(parseMoldeaCliCanonicalContentPath(path)).toBe(path);
  });

  test.each([
    '/moldea',
    '/moldea/context',
    '/moldea/context/file.txt',
    '/moldea/agents/reviewer/private.md',
    '/moldea/project.md/child',
    '/moldea/../package.json',
    '../moldea/project.md',
    'C:\\moldea\\project.md',
    '\\\\server\\share\\moldea\\project.md',
    '/moldea/context/*.md',
    '/README.md',
  ])('rejects non-canonical or unsafe path %s', (path) => {
    expect(() => parseMoldeaCliCanonicalContentPath(path)).toThrow(
      MoldeaCliProjectContentException,
    );
  });
});
