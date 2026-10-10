import {
  RepositoryPathException,
  RepositorySourceException,
  isRepositoryPath,
  type IRepositoryOperation,
  type IRepositorySourceErrorCode,
} from '@moldea.ai/repository';

import {
  CoreConfigurationException,
  CoreOperationException,
  isCoreConfigurationErrorCode,
  isCoreOperation,
  isCoreOperationErrorCode,
} from '../exceptions/index.js';

import { createInspectionProcessFailure } from './protocol.js';
import type { INodeInspectionFailure } from './types.js';

/** Serializes only documented exception fields, excluding native messages, causes and stacks. */
export const serializeInspectionFailure = (error: unknown): INodeInspectionFailure => {
  if (error instanceof CoreConfigurationException)
    return {
      family: 'configuration',
      options: {
        code: error.code,
        operation: error.operation,
        ...(error.adapterId === null ? {} : { adapterId: error.adapterId }),
      },
    };
  if (error instanceof CoreOperationException)
    return {
      family: 'operation',
      options: {
        code: error.code,
        operation: error.operation,
        ...(error.adapterId === null ? {} : { adapterId: error.adapterId }),
        ...(error.agentId === null ? {} : { agentId: error.agentId }),
        ...(error.code !== 'RESOURCE_LIMIT_EXCEEDED'
          ? {}
          : {
              limit: error.limit,
              limitMaximum: error.limitMaximum,
              nextAction: error.nextAction,
              observedUsage: error.observedUsage,
            }),
      },
    };
  if (error instanceof RepositoryPathException) return { family: 'path', options: {} };
  if (error instanceof RepositorySourceException)
    return {
      family: 'repository',
      options: {
        code: error.code,
        operation: error.operation,
        path: error.path,
        retryable: error.retryable,
        ...(error.resource === null ? {} : { resource: error.resource }),
      },
    };
  return {
    family: 'operation',
    options: {
      code: 'INSPECTION_PROCESS_FAILED',
      operation: 'create-project-inspection',
    },
  };
};
const REPOSITORY_CODES: IRepositorySourceErrorCode[] = [
  'ENTRY_NOT_FOUND',
  'ENTRY_NOT_FILE',
  'ENTRY_NOT_DIRECTORY',
  'INVALID_PAGE_REQUEST',
  'ACCESS_DENIED',
  'SOURCE_UNAVAILABLE',
  'SNAPSHOT_CHANGED',
  'PROVIDER_INCOMPLETE',
  'INVALID_SOURCE_DATA',
  'RESOURCE_LIMIT_EXCEEDED',
  'ABORTED',
];
const REPOSITORY_OPERATIONS: IRepositoryOperation[] = [
  'create-reader',
  'create-comparison',
  'get-entry',
  'read-file-page',
  'list-entries-page',
  'list-changes-page',
];
const isNumber = (input: unknown): input is number =>
  typeof input === 'number' && Number.isSafeInteger(input) && input >= 0;

/**
 * Reconstructs a documented typed failure after checking its safe transport fields.
 * @returns A package exception without a remote native cause or stack.
 * @throws
 * - INSPECTION_PROCESS_FAILED: The isolated project inspection failed.
 */
export const deserializeInspectionFailure = (failure: INodeInspectionFailure): Error => {
  const options = failure.options;
  const allowed =
    failure.family === 'configuration'
      ? ['code', 'operation', 'adapterId']
      : failure.family === 'operation'
        ? [
            'code',
            'operation',
            'adapterId',
            'agentId',
            'limit',
            'limitMaximum',
            'nextAction',
            'observedUsage',
          ]
        : failure.family === 'repository'
          ? ['code', 'operation', 'path', 'retryable', 'resource']
          : [];
  if (
    Object.keys(options).some((key) => !allowed.includes(key)) ||
    ['adapterId', 'agentId'].some(
      (key) => Object.hasOwn(options, key) && typeof options[key] !== 'string',
    )
  )
    throw createInspectionProcessFailure();
  if (
    (failure.family === 'operation' || failure.family === 'configuration') &&
    !isCoreOperation(options['operation'])
  )
    throw createInspectionProcessFailure();
  const scope = {
    operation: isCoreOperation(options['operation'])
      ? options['operation']
      : ('create-project-inspection' as const),
    ...(typeof options['adapterId'] === 'string' ? { adapterId: options['adapterId'] } : {}),
    ...(typeof options['agentId'] === 'string' ? { agentId: options['agentId'] } : {}),
  };
  if (failure.family === 'path' && Object.keys(options).length === 0)
    return new RepositoryPathException();
  if (failure.family === 'configuration') {
    const code = options['code'];
    if (isCoreConfigurationErrorCode(code))
      return new CoreConfigurationException({ ...scope, code });
  }
  if (failure.family === 'operation') {
    const code = options['code'];
    if (
      isCoreOperationErrorCode(code) &&
      code !== 'RESOURCE_LIMIT_EXCEEDED' &&
      !['limit', 'limitMaximum', 'nextAction', 'observedUsage'].some((key) =>
        Object.hasOwn(options, key),
      )
    )
      return new CoreOperationException({ ...scope, code });
    if (
      options['code'] === 'RESOURCE_LIMIT_EXCEEDED' &&
      isNumber(options['limitMaximum']) &&
      options['limitMaximum'] > 0
    ) {
      if (
        options['limit'] === 'maxAnalysisHeapBytes' &&
        options['nextAction'] === 'review-inspection-capacity' &&
        options['observedUsage'] === null
      )
        return new CoreOperationException({
          ...scope,
          code: 'RESOURCE_LIMIT_EXCEEDED',
          limit: 'maxAnalysisHeapBytes',
          limitMaximum: options['limitMaximum'],
          observedUsage: null,
          nextAction: 'review-inspection-capacity',
        });
      if (
        (options['limit'] === 'maxInspectionMessageBytes' ||
          options['limit'] === 'maxReaderRequests') &&
        options['nextAction'] === null &&
        isNumber(options['observedUsage'])
      )
        return new CoreOperationException({
          ...scope,
          code: 'RESOURCE_LIMIT_EXCEEDED',
          limit: options['limit'],
          limitMaximum: options['limitMaximum'],
          nextAction: null,
          observedUsage: options['observedUsage'],
        });
      if (
        typeof options['limit'] === 'string' &&
        !['maxAnalysisHeapBytes', 'maxInspectionMessageBytes', 'maxReaderRequests'].includes(
          options['limit'],
        ) &&
        options['nextAction'] === 'reduce-input-or-increase-limit' &&
        isNumber(options['observedUsage'])
      )
        return new CoreOperationException({
          ...scope,
          code: 'RESOURCE_LIMIT_EXCEEDED',
          limit: options['limit'],
          limitMaximum: options['limitMaximum'],
          nextAction: 'reduce-input-or-increase-limit',
          observedUsage: options['observedUsage'],
        });
    }
  }
  if (failure.family === 'repository') {
    const code = REPOSITORY_CODES.find((candidate) => candidate === options['code']);
    const operation = REPOSITORY_OPERATIONS.find((candidate) => candidate === options['operation']);
    const resource = options['resource'];
    if (
      code !== undefined &&
      operation !== undefined &&
      typeof options['retryable'] === 'boolean' &&
      (options['path'] === null || isRepositoryPath(options['path'])) &&
      (resource === undefined ||
        (resource !== null &&
          typeof resource === 'object' &&
          Object.keys(resource).length === 3 &&
          'dimension' in resource &&
          typeof resource.dimension === 'string' &&
          'limit' in resource &&
          isNumber(resource.limit) &&
          'observed' in resource &&
          isNumber(resource.observed)))
    ) {
      return new RepositorySourceException({
        code,
        operation,
        path: options['path'],
        retryable: options['retryable'],
        ...(resource === undefined
          ? {}
          : {
              resource: resource as {
                dimension: string;
                limit: number;
                observed: number;
              },
            }),
      });
    }
  }
  throw createInspectionProcessFailure();
};
