// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { RepositorySourceException } from '@moldea.ai/repository';

import { CoreOperationException } from '../exceptions/index.js';

import { deserializeInspectionFailure, serializeInspectionFailure } from './errors.js';
import type { INodeInspectionFailure } from './types.js';

describe('safe isolated inspection failures', () => {
  test.each([
    ['INSPECTION_BUSY', true, 'Project inspection capacity is busy. Try again shortly.'],
    ['INSPECTION_TIMEOUT', true, 'The isolated project inspection timed out.'],
    ['INSPECTION_PROCESS_FAILED', false, 'The isolated project inspection failed.'],
  ] as const)('preserves %s and retryability %s', (code, retryable, message) => {
    const error = new CoreOperationException({
      code,
      operation: 'create-project-inspection',
      cause: new Error('private native detail'),
    });
    const failure = serializeInspectionFailure(error);
    expect(JSON.stringify(failure)).not.toContain('private native detail');
    expect(deserializeInspectionFailure(failure)).toMatchObject({ code, retryable, message });
  });

  test('keeps actual heap capacity distinct from unknown usage', () => {
    const error = new CoreOperationException({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      operation: 'create-project-inspection',
      limit: 'maxAnalysisHeapBytes',
      limitMaximum: 560 * 1_048_576,
      observedUsage: null,
      nextAction: 'review-inspection-capacity',
    });
    expect(deserializeInspectionFailure(serializeInspectionFailure(error))).toMatchObject({
      code: error.code,
      limit: error.limit,
      limitMaximum: error.limitMaximum,
      observedUsage: null,
      nextAction: error.nextAction,
      retryable: false,
    });
  });

  test('does not suggest raising a fixed transport limit', () => {
    const error = new CoreOperationException({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      operation: 'create-project-inspection',
      limit: 'maxInspectionMessageBytes',
      limitMaximum: 1_048_576,
      observedUsage: 1_048_580,
      nextAction: null,
    });
    expect(deserializeInspectionFailure(serializeInspectionFailure(error))).toMatchObject({
      limit: 'maxInspectionMessageBytes',
      limitMaximum: 1_048_576,
      observedUsage: 1_048_580,
      nextAction: null,
    });
  });

  test('preserves the original Core operation across the worker boundary', () => {
    const error = new CoreOperationException({
      code: 'ADAPTER_EXECUTION_FAILED',
      operation: 'validate-adapter',
      adapterId: 'openai',
      agentId: 'support',
    });
    expect(deserializeInspectionFailure(serializeInspectionFailure(error))).toMatchObject({
      code: error.code,
      operation: 'validate-adapter',
      adapterId: 'openai',
      agentId: 'support',
    });
  });

  test.each(['maxAnalysisHeapBytes', 'maxInspectionMessageBytes', 'maxReaderRequests'])(
    'refuses configurable guidance for the fixed %s limit',
    (limit) => {
      expect(() =>
        deserializeInspectionFailure({
          family: 'operation',
          options: {
            code: 'RESOURCE_LIMIT_EXCEEDED',
            operation: 'create-project-inspection',
            limit,
            limitMaximum: 4,
            observedUsage: 8,
            nextAction: 'reduce-input-or-increase-limit',
          },
        }),
      ).toThrow('The isolated project inspection failed.');
    },
  );

  test('keeps repository resource dimensions without a remote private cause', () => {
    const error = new RepositorySourceException({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      operation: 'read-file-page',
      path: null,
      retryable: false,
      resource: { dimension: 'maxBytes', limit: 4, observed: 8 },
      cause: new Error('private provider detail'),
    });
    const failure = serializeInspectionFailure(error);
    expect(deserializeInspectionFailure(failure)).toMatchObject({
      code: error.code,
      operation: error.operation,
      path: null,
      resource: error.resource,
      retryable: false,
    });
    expect(JSON.stringify(failure)).not.toContain('private provider detail');
  });

  test.each([
    {
      family: 'operation',
      options: {
        operation: 'create-project-inspection',
        code: 'INSPECTION_TIMEOUT',
        message: 'invented',
      },
    },
    {
      family: 'operation',
      options: {
        operation: 'create-project-inspection',
        code: 'INSPECTION_TIMEOUT',
        limit: 'maxAnalysisHeapBytes',
      },
    },
    {
      family: 'operation',
      options: {
        operation: 'create-project-inspection',
        code: 'RESOURCE_LIMIT_EXCEEDED',
        limit: 'maxFileBytes',
        limitMaximum: 8,
        nextAction: 'reduce-input-or-increase-limit',
        observedUsage: null,
      },
    },
    {
      family: 'operation',
      options: {
        operation: 'create-project-inspection',
        code: 'RESOURCE_LIMIT_EXCEEDED',
        limit: 'maxAnalysisHeapBytes',
        limitMaximum: 0,
        nextAction: 'review-inspection-capacity',
        observedUsage: null,
      },
    },
    {
      family: 'configuration',
      options: { operation: 'create-core', code: 'INVALID_ADAPTER_DEFINITION', cause: 'private' },
    },
    {
      family: 'repository',
      options: { code: 'SOURCE_UNAVAILABLE', operation: 'unknown', path: null, retryable: true },
    },
  ] satisfies INodeInspectionFailure[])(
    'refuses contradictory or undeclared failure fields (%o)',
    (failure) => {
      expect(() => deserializeInspectionFailure(failure)).toThrow(
        'The isolated project inspection failed.',
      );
    },
  );

  test('maps unclassified native errors to process failure without inferring capacity', () => {
    const failure = serializeInspectionFailure(new Error('out of memory text is not evidence'));
    expect(failure).toStrictEqual({
      family: 'operation',
      options: {
        code: 'INSPECTION_PROCESS_FAILED',
        operation: 'create-project-inspection',
      },
    });
  });
});
