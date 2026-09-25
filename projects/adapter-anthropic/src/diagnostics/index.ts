import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';

import { ANTHROPIC_ADAPTER_ID } from '../constants/index.js';
import type {
  IAnthropicAdapterDiagnosticCode,
  IAnthropicDiagnosticInput,
} from '../contracts/index.js';

// stable Anthropic adapter diagnostic code and message catalog
export const ANTHROPIC_ADAPTER_DIAGNOSTICS = Object.freeze({
  ANTHROPIC_INSTRUCTION_LOADER_NOT_WIRED: {
    message:
      'The declared instruction loader is not wired to the detected Anthropic Messages API call.',
    severity: 'error',
  },
  ANTHROPIC_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND: {
    message: 'The declared instruction-loader symbol was not found.',
    severity: 'error',
  },
  ANTHROPIC_PACKAGE_MANIFEST_INVALID: {
    message: 'The owning package manifest is invalid for Anthropic dependency detection.',
    severity: 'error',
  },
  ANTHROPIC_RUNTIME_AGENT_SYMBOL_NOT_FOUND: {
    message: 'The declared runtime-agent symbol was not found.',
    severity: 'error',
  },
  ANTHROPIC_SDK_VERSION_UNSUPPORTED: {
    message: 'The observed Anthropic SDK dependency range is disjoint from the supported range.',
    severity: 'error',
  },
  ANTHROPIC_SOURCE_SYNTAX_INVALID: {
    message: 'The referenced Anthropic source file contains invalid TypeScript syntax.',
    severity: 'error',
  },
  ANTHROPIC_SOURCE_TEXT_INVALID: {
    message: 'The referenced Anthropic source file is not valid normalized text.',
    severity: 'error',
  },
  ANTHROPIC_TOOL_INPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared tool input schema is not wired to the detected Anthropic client-tool input schema.',
    severity: 'error',
  },
  ANTHROPIC_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared tool input-schema symbol was not found.',
    severity: 'error',
  },
  ANTHROPIC_TOOL_NAME_MISMATCH: {
    message: 'The declared tool name does not match the detected Anthropic client-tool name.',
    severity: 'error',
  },
  ANTHROPIC_TOOL_NAME_INVALID: {
    message: 'The detected Anthropic client-tool name violates the supported provider limit.',
    severity: 'error',
  },
  ANTHROPIC_TOOL_REGISTRATION_NOT_WIRED: {
    message:
      'The declared tool registration is not wired to the detected Anthropic Messages API call.',
    severity: 'error',
  },
  ANTHROPIC_TOOL_REGISTRATION_SYMBOL_NOT_FOUND: {
    message: 'The declared tool-registration symbol was not found.',
    severity: 'error',
  },
  ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED: {
    message: 'The declared runtime relationship could not be verified.',
    severity: 'warning',
  },
} as const satisfies Readonly<
  Record<
    IAnthropicAdapterDiagnosticCode,
    { readonly message: string; readonly severity: 'error' | 'warning' }
  >
>);

/**
 * Creates one frozen, safely namespaced Anthropic adapter diagnostic.
 * @param input The complete code, location, entity, and safe scalar details.
 * @returns The immutable adapter diagnostic.
 */
export const createAnthropicDiagnostic = (input: IAnthropicDiagnosticInput): IAdapterDiagnostic => {
  if (input.code === 'ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED') {
    const definition = ANTHROPIC_ADAPTER_DIAGNOSTICS[input.code];
    const details = Object.freeze({ ...input.details });
    const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

    return Object.freeze({
      ...input,
      details,
      entity,
      message: definition.message,
      severity: definition.severity,
      source: ANTHROPIC_ADAPTER_ID,
    });
  }

  const definition = ANTHROPIC_ADAPTER_DIAGNOSTICS[input.code];
  const details = Object.freeze({ ...input.details });
  const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

  return Object.freeze({
    ...input,
    details,
    entity,
    message: definition.message,
    severity: definition.severity,
    source: ANTHROPIC_ADAPTER_ID,
  });
};
