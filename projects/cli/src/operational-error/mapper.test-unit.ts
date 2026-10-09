// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { CoreConfigurationException, CoreOperationException } from '@moldea.ai/core';
import {
  parseRepositoryPath,
  RepositoryPathException,
  RepositorySourceException,
} from '@moldea.ai/repository';

import { GitContentTransformUnsupportedException } from '../repository-content-transformation-guard/index.js';
import { MoldeaCliOutputPageException } from '../output-page/index.js';
import { MoldeaCliProjectContentException } from '../project-content/index.js';
import { MoldeaCliProjectScopeException } from '../project-scope/index.js';
import { MoldeaCliCompositionException } from '../composition/index.js';

import { mapMoldeaCliOperationalError } from './mapper.js';

describe('mapMoldeaCliOperationalError', () => {
  test.each([
    [
      new MoldeaCliCompositionException(),
      'COMPOSITION_STATE_INVALID',
      'The installed composition state is invalid.',
    ],
    [
      new MoldeaCliOutputPageException('OUTPUT_BUDGET_TOO_SMALL'),
      'OUTPUT_BUDGET_TOO_SMALL',
      'The output byte budget cannot contain the next complete result.',
    ],
    [
      new MoldeaCliProjectContentException('CONTENT_PATH_INVALID'),
      'CONTENT_PATH_INVALID',
      'The content path must identify one canonical moldea text asset.',
    ],
    [
      new MoldeaCliProjectScopeException('PATH_INPUT_INVALID'),
      'PATH_INPUT_INVALID',
      'The scope path input is invalid. Use leading-slash repository-logical paths and NUL-delimited UTF-8 on stdin.',
    ],
  ] as const)('maps CLI transport failure %s', (error, code, message) => {
    expect(mapMoldeaCliOperationalError(error)).toStrictEqual({
      code,
      details: {},
      message,
      path: null,
      retryable: false,
      source: 'cli',
    });
  });

  test('keeps verified heap capacity and unknown usage in safe JSON metadata', () => {
    const error = new CoreOperationException({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      operation: 'create-project-inspection',
      limit: 'maxAnalysisHeapBytes',
      limitMaximum: 560 * 1_048_576,
      observedUsage: null,
      nextAction: 'review-inspection-capacity',
      cause: new Error('private native diagnostics'),
    });
    expect(mapMoldeaCliOperationalError(error)).toStrictEqual({
      code: error.code,
      message: 'A Core resource limit was exceeded.',
      retryable: false,
      source: 'core',
      path: null,
      details: {
        operation: error.operation,
        limit: error.limit,
        limitMaximum: error.limitMaximum,
        observedUsage: null,
        nextAction: 'review-inspection-capacity',
      },
    });
  });

  test.each([
    ['INSPECTION_BUSY', true, 'Project inspection capacity is busy. Try again shortly.'],
    ['INSPECTION_TIMEOUT', true, 'The isolated project inspection timed out.'],
    ['INSPECTION_PROCESS_FAILED', false, 'The isolated project inspection failed.'],
  ] as const)('maps %s without inventing capacity metadata', (code, retryable, message) => {
    expect(
      mapMoldeaCliOperationalError(
        new CoreOperationException({
          code,
          operation: 'create-project-inspection',
          cause: new Error('private'),
        }),
      ),
    ).toStrictEqual({
      code,
      retryable,
      message,
      path: null,
      source: 'core',
      details: { operation: 'create-project-inspection' },
    });
  });

  test('maps the CLI-owned guarded-read marker to its Git error and logical path', () => {
    const path = parseRepositoryPath('/assets/model.bin');
    const mapped = mapMoldeaCliOperationalError(new GitContentTransformUnsupportedException(path));

    expect(mapped).toStrictEqual({
      code: 'GIT_CONTENT_TRANSFORM_UNSUPPORTED',
      details: {},
      message: 'The requested file uses an unsupported Git content transformation.',
      path,
      retryable: false,
      source: 'git',
    });
    expect(Object.isFrozen(mapped)).toBe(true);
  });

  test('preserves the safe common repository-source contract', () => {
    const path = parseRepositoryPath('/moldea/project.md');
    const sourceError = new RepositorySourceException({
      cause: new Error('private provider detail'),
      code: 'ACCESS_DENIED',
      operation: 'read-file-page',
      path,
      retryable: true,
    });

    sourceError.message = 'Private provider path: /tmp/private';
    const mapped = mapMoldeaCliOperationalError(sourceError);

    expect(mapped).toStrictEqual({
      code: 'ACCESS_DENIED',
      details: {},
      message: 'Access to the repository source was denied.',
      path,
      retryable: true,
      source: 'repository',
    });
    expect(JSON.stringify(mapped)).not.toContain('private provider detail');
  });

  test('maps Core configuration failures with safe non-null metadata', () => {
    const mapped = mapMoldeaCliOperationalError(
      new CoreConfigurationException({
        adapterId: 'openai',
        code: 'INVALID_ADAPTER_DEFINITION',
        operation: 'create-core',
      }),
    );

    expect(mapped).toStrictEqual({
      code: 'INVALID_ADAPTER_DEFINITION',
      details: { adapterId: 'openai', operation: 'create-core' },
      message: 'A runtime adapter definition is invalid.',
      path: null,
      retryable: false,
      source: 'core',
    });
    expect(Object.isFrozen(mapped.details)).toBe(true);
  });

  test('maps Core operation failures with documented retryability and safe metadata', () => {
    const operationError = new CoreOperationException({
      adapterId: 'openai',
      agentId: 'reviewer',
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxEvidence',
      limitMaximum: 8,
      nextAction: 'reduce-input-or-increase-limit',
      observedUsage: 9,
      operation: 'validate-adapter',
    });

    operationError.message = 'Private adapter path: /tmp/private';
    const mapped = mapMoldeaCliOperationalError(operationError);

    expect(mapped).toStrictEqual({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      details: {
        adapterId: 'openai',
        agentId: 'reviewer',
        limit: 'maxEvidence',
        limitMaximum: 8,
        nextAction: 'reduce-input-or-increase-limit',
        observedUsage: 9,
        operation: 'validate-adapter',
      },
      message: 'A Core resource limit was exceeded.',
      path: null,
      retryable: false,
      source: 'core',
    });
  });

  test('omits a repository exception path that does not satisfy the logical-path contract', () => {
    const sourceError = new RepositorySourceException({
      code: 'SOURCE_UNAVAILABLE',
      operation: 'read-file-page',
      path: null,
      retryable: false,
    });

    Object.defineProperty(sourceError, 'path', { value: 'C:\\private' });

    expect(mapMoldeaCliOperationalError(sourceError).path).toBeNull();
  });

  test.each([
    new RepositoryPathException({ cause: new Error('rejected path') }),
    new Error('private host path: /tmp/private'),
    Object.freeze({ message: 'private object failure' }),
  ])('maps an unexpected internal failure to the generic CLI contract', (error) => {
    expect(mapMoldeaCliOperationalError(error)).toStrictEqual({
      code: 'INTERNAL_ERROR',
      details: {},
      message: 'The command could not be completed.',
      path: null,
      retryable: false,
      source: 'cli',
    });
  });
});
