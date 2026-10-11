// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { INTEGRATION_TEST_TEMPLATE } from '../repository.test-fixtures.js';

import { parseIntegrationBlock } from './index.js';

const block = INTEGRATION_TEST_TEMPLATE.replaceAll('{{skill-path}}', '.agents/skills/moldea');

describe('public integration block parser', () => {
  test.each(['\n', '\r\n'])('extracts the installation with %o line endings', (ending) => {
    expect(
      parseIntegrationBlock('# Instructions' + ending + block.replaceAll('\n', ending)),
    ).toStrictEqual({ kind: 'found', skillPath: '.agents/skills/moldea' });
  });
  test('accepts a UTF-8 BOM at the beginning of the document', () => {
    expect(parseIntegrationBlock('\uFEFF' + block)).toStrictEqual({
      kind: 'found',
      skillPath: '.agents/skills/moldea',
    });
  });
  test.each([
    ['', 'block-missing'],
    ['# Instructions\n', 'block-missing'],
    [block + block, 'block-invalid'],
    [block.replace('<!-- moldea:end -->', ''), 'block-invalid'],
    [block.replace('<!-- moldea:start -->', 'inline <!-- moldea:start -->'), 'block-invalid'],
    ['<!-- moldea:end -->\n<!-- moldea:start -->\n', 'block-invalid'],
    ['<!-- moldea:start -->\nNo command.\n<!-- moldea:end -->\n', 'skill-path-missing'],
    [block.replace('.agents/skills/moldea', '../outside'), 'skill-path-invalid'],
    [block.replace('.agents/skills/moldea', '/absolute'), 'skill-path-invalid'],
    [block.replace('.agents/skills/moldea', 'path/./skill'), 'skill-path-invalid'],
    [block.replace('.agents/skills/moldea', 'path//skill'), 'skill-path-invalid'],
    [block.replace('.agents/skills/moldea', 'path with spaces'), 'skill-path-invalid'],
    [block.replace('.agents/skills/moldea', 'c:\\skill'), 'skill-path-invalid'],
  ])('reports a safe reason for %s -> %s', (text, reason) => {
    expect(parseIntegrationBlock(text)).toStrictEqual({ kind: 'missing', reason });
  });
  test('rejects ambiguous gate lines without collecting every match', () => {
    const command =
      'node "<repo-root>/.agents/skills/moldea/scripts/relevance-gate.mjs" --repository "<repo-root>"\n';
    expect(
      parseIntegrationBlock(
        '<!-- moldea:start -->\n' + command.repeat(1024) + '<!-- moldea:end -->\n',
      ),
    ).toStrictEqual({ kind: 'missing', reason: 'skill-path-missing' });
  });
});
