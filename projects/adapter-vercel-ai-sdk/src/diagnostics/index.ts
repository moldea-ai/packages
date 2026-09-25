import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';

import { VERCEL_AI_SDK_ADAPTER_ID } from '../constants/index.js';
import type {
  IVercelAiSdkAdapterDiagnosticCode,
  IVercelAiSdkDiagnosticInput,
} from '../contracts/index.js';

// stable Vercel AI SDK adapter diagnostic code and message catalog
export const VERCEL_AI_SDK_ADAPTER_DIAGNOSTICS = Object.freeze({
  VERCEL_AI_SDK_AGENT_INPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared agent input schema is not wired to the detected ToolLoopAgent call-options schema.',
    severity: 'error',
  },
  VERCEL_AI_SDK_AGENT_INPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared agent input-schema symbol was not found.',
    severity: 'error',
  },
  VERCEL_AI_SDK_AGENT_OUTPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared agent output schema is not wired to the detected Vercel AI SDK structured output.',
    severity: 'error',
  },
  VERCEL_AI_SDK_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared agent output-schema symbol was not found.',
    severity: 'error',
  },
  VERCEL_AI_SDK_INSTRUCTION_LOADER_NOT_WIRED: {
    message:
      'The declared instruction loader is not wired to the detected Vercel AI SDK instructions.',
    severity: 'error',
  },
  VERCEL_AI_SDK_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND: {
    message: 'The declared instruction-loader symbol was not found.',
    severity: 'error',
  },
  VERCEL_AI_SDK_PACKAGE_MANIFEST_INVALID: {
    message: 'The owning package manifest is invalid for Vercel AI SDK dependency detection.',
    severity: 'error',
  },
  VERCEL_AI_SDK_RUNTIME_AGENT_SYMBOL_NOT_FOUND: {
    message: 'The declared runtime-agent symbol was not found.',
    severity: 'error',
  },
  VERCEL_AI_SDK_SOURCE_SYNTAX_INVALID: {
    message: 'The referenced Vercel AI SDK source file contains invalid TypeScript syntax.',
    severity: 'error',
  },
  VERCEL_AI_SDK_SOURCE_TEXT_INVALID: {
    message: 'The referenced Vercel AI SDK source file is not valid normalized text.',
    severity: 'error',
  },
  VERCEL_AI_SDK_TOOL_IMPLEMENTATION_NOT_WIRED: {
    message:
      'The declared tool implementation is not wired to the detected Vercel AI SDK function tool.',
    severity: 'error',
  },
  VERCEL_AI_SDK_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND: {
    message: 'The declared tool-implementation symbol was not found.',
    severity: 'error',
  },
  VERCEL_AI_SDK_TOOL_INPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared tool input schema is not wired to the detected Vercel AI SDK function tool.',
    severity: 'error',
  },
  VERCEL_AI_SDK_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared tool input-schema symbol was not found.',
    severity: 'error',
  },
  VERCEL_AI_SDK_TOOL_NAME_MISMATCH: {
    message: 'The declared tool name does not match the detected Vercel AI SDK tools-map key.',
    severity: 'error',
  },
  VERCEL_AI_SDK_TOOL_OUTPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared tool output schema is not wired to the detected Vercel AI SDK function tool.',
    severity: 'error',
  },
  VERCEL_AI_SDK_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared tool output-schema symbol was not found.',
    severity: 'error',
  },
  VERCEL_AI_SDK_TOOL_REGISTRATION_NOT_WIRED: {
    message: 'The declared tool registration is not wired to the detected Vercel AI SDK tools map.',
    severity: 'error',
  },
  VERCEL_AI_SDK_TOOL_REGISTRATION_SYMBOL_NOT_FOUND: {
    message: 'The declared tool-registration symbol was not found.',
    severity: 'error',
  },
  VERCEL_AI_SDK_VERSION_UNSUPPORTED: {
    message: 'The observed Vercel AI SDK dependency range is disjoint from the supported range.',
    severity: 'error',
  },
  VERCEL_AI_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED: {
    message: 'The declared runtime relationship could not be verified.',
    severity: 'warning',
  },
} as const satisfies Readonly<
  Record<
    IVercelAiSdkAdapterDiagnosticCode,
    { readonly message: string; readonly severity: 'error' | 'warning' }
  >
>);

/**
 * Creates one frozen, safely namespaced Vercel AI SDK adapter diagnostic.
 * @param input The complete code, location, entity, and safe scalar details.
 * @returns The immutable adapter diagnostic.
 */
export const createVercelAiSdkDiagnostic = (
  input: IVercelAiSdkDiagnosticInput,
): IAdapterDiagnostic => {
  if (input.code === 'VERCEL_AI_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED') {
    const definition = VERCEL_AI_SDK_ADAPTER_DIAGNOSTICS[input.code];
    const details = Object.freeze({ ...input.details });
    const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

    return Object.freeze({
      ...input,
      details,
      entity,
      message: definition.message,
      severity: definition.severity,
      source: VERCEL_AI_SDK_ADAPTER_ID,
    });
  }

  const definition = VERCEL_AI_SDK_ADAPTER_DIAGNOSTICS[input.code];
  const details = Object.freeze({ ...input.details });
  const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

  return Object.freeze({
    ...input,
    details,
    entity,
    message: definition.message,
    severity: definition.severity,
    source: VERCEL_AI_SDK_ADAPTER_ID,
  });
};
