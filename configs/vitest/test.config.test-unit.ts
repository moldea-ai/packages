// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestConfig } from './test.config.js';

beforeEach(() => vi.stubEnv('MOLDEA_TEST_SUITE', undefined));

describe('createTestConfig', () => {
  it('scopes whole-file classification to its workspace owner', () => {
    vi.stubEnv('MOLDEA_TEST_SUITE', 'essential');
    const cwd = vi.spyOn(process, 'cwd');
    cwd.mockReturnValue(fileURLToPath(new URL('../../projects/website-ui', import.meta.url)));
    const website = createTestConfig({ suite: 'unit' });
    expect(
      website.test?.exclude?.some(
        (pattern) => typeof pattern === 'string' && pattern.includes('code-diff'),
      ),
    ).toBe(true);
    cwd.mockReturnValue(fileURLToPath(new URL('../../projects/core', import.meta.url)));
    const core = createTestConfig({ suite: 'unit' });
    expect(
      core.test?.exclude?.some(
        (pattern) => typeof pattern === 'string' && pattern.includes('code-diff'),
      ),
    ).toBe(false);
  });
  it('creates a strict Node.js unit-test configuration by default', () => {
    const config = createTestConfig({ suite: 'unit' });

    expect(config.test).toEqual({
      clearMocks: true,
      environment: 'node',
      exclude: ['**/node_modules/**', '**/.git/**', '**/{_archive,_archives,_backup,_backups}/**'],
      globals: false,
      include: ['src/**/*.test-unit.ts'],
      passWithNoTests: false,
      restoreMocks: true,
      tags: [{ name: 'full', skip: false }],
      sequence: {
        shuffle: false,
      },
      unstubEnvs: true,
      unstubGlobals: true,
    });
  });

  it('uses the requested suite and copies caller-owned include patterns', () => {
    const include = ['test/**/*.integration.ts'];
    const config = createTestConfig({ include, suite: 'integration' });

    expect(config.test?.include).toEqual(include);
    expect(config.test?.include).not.toBe(include);
    expect(config.test?.hookTimeout).toBe(120_000);
    expect(config.test?.testTimeout).toBe(120_000);
  });

  it('creates the default end-to-end test include pattern', () => {
    const config = createTestConfig({ suite: 'e2e' });

    expect(config.test?.include).toEqual(['src/**/*.test-e2e.ts']);
  });
});
