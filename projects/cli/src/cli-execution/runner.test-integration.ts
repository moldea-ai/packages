// @vitest-environment node
import { expect, test } from 'vitest';

import { INSTALLED_PACKAGE_METADATA } from '../composition/composition.test-fixtures.js';

import { runMoldeaCli } from './runner.js';

test('reports composition from the resolved installed package versions', async () => {
  const result = await runMoldeaCli({
    commandLineArguments: ['composition', '--json'],
    invocationDirectory: process.cwd(),
    packageMetadata: INSTALLED_PACKAGE_METADATA,
  });
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe('');
  expect(JSON.parse(result.stdout)).toMatchObject({
    cliVersion: '11.0.0',
    command: 'composition',
    schemaVersion: 7,
    result: { repositoryFormatVersions: [1] },
    status: 'valid',
  });
});
