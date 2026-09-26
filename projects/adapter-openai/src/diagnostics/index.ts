import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';

import { OPENAI_ADAPTER_ID } from '../constants/index.js';
import type { IOpenAiAdapterDiagnosticCode, IOpenAiDiagnosticInput } from '../contracts/index.js';

// stable OpenAI adapter diagnostic code and message catalog
export const OPENAI_ADAPTER_DIAGNOSTICS = Object.freeze({
  OPENAI_INSTRUCTION_LOADER_NOT_WIRED: {
    message: 'The declared instruction loader is not wired to the detected Responses API call.',
    severity: 'error',
  },
  OPENAI_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND: {
    message: 'The declared instruction-loader symbol was not found.',
    severity: 'error',
  },
  OPENAI_OUTPUT_SCHEMA_NOT_WIRED: {
    message: 'The declared agent output schema is not wired to the detected Responses text format.',
    severity: 'error',
  },
  OPENAI_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared agent output-schema symbol was not found.',
    severity: 'error',
  },
  OPENAI_PACKAGE_MANIFEST_INVALID: {
    message: 'The owning package manifest is invalid for OpenAI dependency detection.',
    severity: 'error',
  },
  OPENAI_RUNTIME_AGENT_SYMBOL_NOT_FOUND: {
    message: 'The declared runtime-agent symbol was not found.',
    severity: 'error',
  },
  OPENAI_SDK_VERSION_UNSUPPORTED: {
    message: 'The observed OpenAI SDK dependency range is disjoint from the supported range.',
    severity: 'error',
  },
  OPENAI_SOURCE_SYNTAX_INVALID: {
    message: 'The referenced OpenAI source file contains invalid TypeScript syntax.',
    severity: 'error',
  },
  OPENAI_SOURCE_TEXT_INVALID: {
    message: 'The referenced OpenAI source file is not valid normalized text.',
    severity: 'error',
  },
  OPENAI_TOOL_INPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared tool input schema is not wired to the detected OpenAI function-tool parameters.',
    severity: 'error',
  },
  OPENAI_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared tool input-schema symbol was not found.',
    severity: 'error',
  },
  OPENAI_TOOL_NAME_MISMATCH: {
    message: 'The declared tool name does not match the detected OpenAI function-tool name.',
    severity: 'error',
  },
  OPENAI_TOOL_REGISTRATION_NOT_WIRED: {
    message: 'The declared tool registration is not wired to the detected Responses API call.',
    severity: 'error',
  },
  OPENAI_TOOL_REGISTRATION_SYMBOL_NOT_FOUND: {
    message: 'The declared tool-registration symbol was not found.',
    severity: 'error',
  },
  OPENAI_RUNTIME_RELATIONSHIP_UNVERIFIED: {
    message: 'The declared runtime relationship could not be verified.',
    severity: 'warning',
  },
} as const satisfies Readonly<
  Record<
    IOpenAiAdapterDiagnosticCode,
    { readonly message: string; readonly severity: 'error' | 'warning' }
  >
>);

/**
 * Creates one frozen, safely namespaced OpenAI adapter diagnostic.
 * @param input The complete code, location, entity, and safe scalar details.
 * @returns The immutable adapter diagnostic.
 */
export const createOpenAiDiagnostic = (input: IOpenAiDiagnosticInput): IAdapterDiagnostic => {
  if (input.code === 'OPENAI_RUNTIME_RELATIONSHIP_UNVERIFIED') {
    const definition = OPENAI_ADAPTER_DIAGNOSTICS[input.code];
    const details = Object.freeze({ ...input.details });
    const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

    return Object.freeze({
      ...input,
      details,
      entity,
      message: definition.message,
      severity: definition.severity,
      source: OPENAI_ADAPTER_ID,
    });
  }

  const definition = OPENAI_ADAPTER_DIAGNOSTICS[input.code];
  const details = Object.freeze({ ...input.details });
  const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

  return Object.freeze({
    ...input,
    details,
    entity,
    message: definition.message,
    severity: definition.severity,
    source: OPENAI_ADAPTER_ID,
  });
};
