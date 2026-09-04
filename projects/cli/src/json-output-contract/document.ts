import { serializeJsonDeterministically } from '../json-serialization/index.js';

import { MOLDEA_CLI_JSON_SCHEMA_VERSION } from './constants.js';
import type { IMoldeaCliJsonDocumentInput, IMoldeaCliJsonEnvelope } from './types.js';

/** Creates one strict schema 4 JSON envelope. */
export const createMoldeaCliJsonEnvelope = <TResult>(
  input: IMoldeaCliJsonDocumentInput<TResult>,
): IMoldeaCliJsonEnvelope<TResult> =>
  Object.freeze({
    cliVersion: input.cliVersion,
    command: input.command,
    error: input.error,
    result: input.result,
    schemaVersion: MOLDEA_CLI_JSON_SCHEMA_VERSION,
    status: input.status,
  });

/** Serializes one schema 4 envelope with its required trailing line feed. */
export const serializeMoldeaCliJsonEnvelope = <TResult>(
  input: IMoldeaCliJsonDocumentInput<TResult>,
): string => `${serializeJsonDeterministically(createMoldeaCliJsonEnvelope(input))}\n`;

/** Measures the exact final UTF-8 bytes of one schema 4 JSON document. */
export const measureMoldeaCliJsonEnvelope = <TResult>(
  input: IMoldeaCliJsonDocumentInput<TResult>,
): number => Buffer.byteLength(serializeMoldeaCliJsonEnvelope(input), 'utf8');
