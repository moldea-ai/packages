import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';

import { OPENAI_AGENTS_SDK_ADAPTER_ID } from '../constants/index.js';
import type {
  IOpenAiAgentsSdkAdapterDiagnosticCode,
  IOpenAiAgentsSdkDiagnosticInput,
} from '../contracts/index.js';

// stable OpenAI Agents SDK adapter diagnostic code and message catalog
export const OPENAI_AGENTS_SDK_ADAPTER_DIAGNOSTICS = Object.freeze({
  OPENAI_AGENTS_SDK_AGENT_OUTPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared agent output schema is not wired to the detected OpenAI Agents SDK agent output type.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared agent output-schema symbol was not found.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_HANDOFF_ROUTING_DESCRIPTION_MISSING: {
    message:
      'The detected OpenAI Agents SDK handoff registration is missing its effective routing description.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_HANDOFF_ROUTING_DESCRIPTION_NOT_WIRED: {
    message:
      "The detected OpenAI Agents SDK handoff registration does not use the target agent's effective routing description.",
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_HANDOFF_TARGET_AMBIGUOUS: {
    message:
      'The detected OpenAI Agents SDK handoff target matches more than one registered moldea agent.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_INSTRUCTION_LOADER_NOT_WIRED: {
    message:
      'The declared instruction loader is not wired to the detected OpenAI Agents SDK agent.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND: {
    message: 'The declared instruction-loader symbol was not found.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_PACKAGE_MANIFEST_INVALID: {
    message: 'The owning package manifest is invalid for OpenAI Agents SDK dependency detection.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_RUNTIME_AGENT_SYMBOL_NOT_FOUND: {
    message: 'The declared runtime-agent symbol was not found.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_SOURCE_SYNTAX_INVALID: {
    message: 'The referenced OpenAI Agents SDK source file contains invalid TypeScript syntax.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_SOURCE_TEXT_INVALID: {
    message: 'The referenced OpenAI Agents SDK source file is not valid normalized text.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_TOOL_IMPLEMENTATION_NOT_WIRED: {
    message:
      'The declared tool implementation is not wired to the detected OpenAI Agents SDK function tool.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND: {
    message: 'The declared tool-implementation symbol was not found.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_TOOL_INPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared tool input schema is not wired to the detected OpenAI Agents SDK function tool.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared tool input-schema symbol was not found.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_TOOL_NAME_MISMATCH: {
    message:
      'The declared tool name does not match the detected OpenAI Agents SDK function-tool name.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_TOOL_OUTPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared tool output schema is not wired to the detected OpenAI Agents SDK function tool.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared tool output-schema symbol was not found.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_TOOL_REGISTRATION_NOT_WIRED: {
    message: 'The declared tool registration is not wired to the detected OpenAI Agents SDK agent.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_TOOL_REGISTRATION_SYMBOL_NOT_FOUND: {
    message: 'The declared tool-registration symbol was not found.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_VERSION_UNSUPPORTED: {
    message:
      'The observed OpenAI Agents SDK dependency range is disjoint from the supported range.',
    severity: 'error',
  },
  OPENAI_AGENTS_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED: {
    message: 'The declared runtime relationship could not be verified.',
    severity: 'warning',
  },
} as const satisfies Readonly<
  Record<
    IOpenAiAgentsSdkAdapterDiagnosticCode,
    { readonly message: string; readonly severity: 'error' | 'warning' }
  >
>);

/**
 * Creates one frozen, safely namespaced OpenAI Agents SDK adapter diagnostic.
 * @param input The complete code, location, entity, and safe scalar details.
 * @returns The immutable adapter diagnostic.
 */
export const createOpenAiAgentsSdkDiagnostic = (
  input: IOpenAiAgentsSdkDiagnosticInput,
): IAdapterDiagnostic => {
  if (input.code === 'OPENAI_AGENTS_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED') {
    const definition = OPENAI_AGENTS_SDK_ADAPTER_DIAGNOSTICS[input.code];
    const details = Object.freeze({ ...input.details });
    const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

    return Object.freeze({
      ...input,
      details,
      entity,
      message: definition.message,
      severity: definition.severity,
      source: OPENAI_AGENTS_SDK_ADAPTER_ID,
    });
  }

  const definition = OPENAI_AGENTS_SDK_ADAPTER_DIAGNOSTICS[input.code];
  const details = Object.freeze({ ...input.details });
  const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

  return Object.freeze({
    ...input,
    details,
    entity,
    message: definition.message,
    severity: definition.severity,
    source: OPENAI_AGENTS_SDK_ADAPTER_ID,
  });
};
