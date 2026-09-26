import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';

import { GOOGLE_GENAI_ADAPTER_ID } from '../constants/index.js';
import type {
  IGoogleGenAiAdapterDiagnosticCode,
  IGoogleGenAiDiagnosticInput,
} from '../contracts/index.js';

// stable Google Gen AI adapter diagnostic code and message catalog
export const GOOGLE_GENAI_ADAPTER_DIAGNOSTICS = Object.freeze({
  GOOGLE_GENAI_FUNCTION_DECLARATION_LIMIT_EXCEEDED: {
    message:
      'The detected Google Gen AI function-declaration collection exceeds the supported SDK declaration limit.',
    severity: 'error',
  },
  GOOGLE_GENAI_INSTRUCTION_LOADER_NOT_WIRED: {
    message:
      'The declared instruction loader is not wired to the detected Google Gen AI generate-content configuration.',
    severity: 'error',
  },
  GOOGLE_GENAI_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND: {
    message: 'The declared instruction-loader symbol was not found.',
    severity: 'error',
  },
  GOOGLE_GENAI_PACKAGE_MANIFEST_INVALID: {
    message: 'The owning package manifest is invalid for Google Gen AI dependency detection.',
    severity: 'error',
  },
  GOOGLE_GENAI_RUNTIME_AGENT_SYMBOL_NOT_FOUND: {
    message: 'The declared runtime-agent symbol was not found.',
    severity: 'error',
  },
  GOOGLE_GENAI_SDK_VERSION_UNSUPPORTED: {
    message:
      'The observed Google Gen AI SDK dependency range is disjoint from the supported range.',
    severity: 'error',
  },
  GOOGLE_GENAI_SOURCE_SYNTAX_INVALID: {
    message: 'The referenced Google Gen AI source file contains invalid TypeScript syntax.',
    severity: 'error',
  },
  GOOGLE_GENAI_SOURCE_TEXT_INVALID: {
    message: 'The referenced Google Gen AI source file is not valid normalized text.',
    severity: 'error',
  },
  GOOGLE_GENAI_TOOL_INPUT_SCHEMA_NOT_WIRED: {
    message:
      "The declared tool input schema is not wired to the detected function declaration's parameters JSON schema.",
    severity: 'error',
  },
  GOOGLE_GENAI_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared tool input-schema symbol was not found.',
    severity: 'error',
  },
  GOOGLE_GENAI_TOOL_NAME_INVALID: {
    message:
      'The detected Google Gen AI function name violates the supported SDK declaration limit.',
    severity: 'error',
  },
  GOOGLE_GENAI_TOOL_NAME_MISMATCH: {
    message: 'The declared tool name does not match the detected Google Gen AI function name.',
    severity: 'error',
  },
  GOOGLE_GENAI_TOOL_REGISTRATION_NOT_WIRED: {
    message:
      'The declared tool registration is not wired to the detected Google Gen AI function-declaration collection.',
    severity: 'error',
  },
  GOOGLE_GENAI_TOOL_REGISTRATION_SYMBOL_NOT_FOUND: {
    message: 'The declared tool-registration symbol was not found.',
    severity: 'error',
  },
  GOOGLE_GENAI_RUNTIME_RELATIONSHIP_UNVERIFIED: {
    message: 'The declared runtime relationship could not be verified.',
    severity: 'warning',
  },
} as const satisfies Readonly<
  Record<
    IGoogleGenAiAdapterDiagnosticCode,
    { readonly message: string; readonly severity: 'error' | 'warning' }
  >
>);

/**
 * Creates one frozen, safely namespaced Google Gen AI adapter diagnostic.
 * @param input The complete code, location, entity, and safe scalar details.
 * @returns The immutable adapter diagnostic.
 */
export const createGoogleGenAiDiagnostic = (
  input: IGoogleGenAiDiagnosticInput,
): IAdapterDiagnostic => {
  if (input.code === 'GOOGLE_GENAI_RUNTIME_RELATIONSHIP_UNVERIFIED') {
    const definition = GOOGLE_GENAI_ADAPTER_DIAGNOSTICS[input.code];
    const details = Object.freeze({ ...input.details });
    const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

    return Object.freeze({
      ...input,
      details,
      entity,
      message: definition.message,
      severity: definition.severity,
      source: GOOGLE_GENAI_ADAPTER_ID,
    });
  }

  const definition = GOOGLE_GENAI_ADAPTER_DIAGNOSTICS[input.code];
  const details = Object.freeze({ ...input.details });
  const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

  return Object.freeze({
    ...input,
    details,
    entity,
    message: definition.message,
    severity: definition.severity,
    source: GOOGLE_GENAI_ADAPTER_ID,
  });
};
