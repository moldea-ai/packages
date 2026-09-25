import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';

import { CLOUDFLARE_AGENTS_ADAPTER_ID } from '../constants/index.js';
import type {
  ICloudflareAgentsAdapterDiagnosticCode,
  ICloudflareAgentsDiagnosticInput,
} from '../contracts/index.js';

// stable Cloudflare Agents adapter diagnostic code and message catalog
export const CLOUDFLARE_AGENTS_ADAPTER_DIAGNOSTICS = Object.freeze({
  CLOUDFLARE_AGENTS_AGENT_OUTPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared agent output schema is not wired to the detected AIChatAgent structured output.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared agent output-schema symbol was not found.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_HANDOFF_ROUTING_DESCRIPTION_MISSING: {
    message: 'The detected Cloudflare agent-tool routing description is missing.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_HANDOFF_ROUTING_DESCRIPTION_NOT_WIRED: {
    message:
      "The detected Cloudflare agent-tool routing description is not wired to the target agent's effective routing description.",
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_HANDOFF_TARGET_AMBIGUOUS: {
    message: 'The detected Cloudflare agent-tool target maps to more than one registered agent.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_INSTRUCTION_LOADER_NOT_WIRED: {
    message:
      'The declared instruction loader is not wired to a supported configured Cloudflare agent instruction source.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND: {
    message: 'The declared instruction-loader symbol was not found.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_PACKAGE_MANIFEST_INVALID: {
    message: 'The owning package manifest is invalid for Cloudflare Agents dependency detection.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_RUNTIME_AGENT_SYMBOL_NOT_FOUND: {
    message: 'The declared runtime-agent symbol was not found.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_RUNTIME_VERSION_UNSUPPORTED: {
    message:
      'The observed Cloudflare Agents dependency range is disjoint from the supported target.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_SOURCE_SYNTAX_INVALID: {
    message: 'The referenced Cloudflare Agents source file contains invalid TypeScript syntax.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_SOURCE_TEXT_INVALID: {
    message: 'The referenced Cloudflare Agents source file is not valid normalized text.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_TOOL_IMPLEMENTATION_NOT_WIRED: {
    message:
      'The declared tool implementation is not wired to the detected Cloudflare agent function tool.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND: {
    message: 'The declared tool-implementation symbol was not found.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_TOOL_INPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared tool input schema is not wired to the detected Cloudflare agent function tool.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared tool input-schema symbol was not found.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_TOOL_NAME_MISMATCH: {
    message: 'The declared tool name does not match the detected Cloudflare agent tools-map key.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_TOOL_OUTPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared tool output schema is not wired to the detected Cloudflare agent function tool.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared tool output-schema symbol was not found.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_TOOL_REGISTRATION_NOT_WIRED: {
    message:
      'The declared tool registration is not wired to the detected Cloudflare agent tools map.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_TOOL_REGISTRATION_SYMBOL_NOT_FOUND: {
    message: 'The declared tool-registration symbol was not found.',
    severity: 'error',
  },
  CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED: {
    message: 'The declared runtime relationship could not be verified.',
    severity: 'warning',
  },
} as const satisfies Readonly<
  Record<
    ICloudflareAgentsAdapterDiagnosticCode,
    { readonly message: string; readonly severity: 'error' | 'warning' }
  >
>);

/** Creates one frozen, safely namespaced Cloudflare Agents adapter diagnostic. */
export const createCloudflareAgentsDiagnostic = (
  input: ICloudflareAgentsDiagnosticInput,
): IAdapterDiagnostic => {
  if (input.code === 'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED') {
    const definition = CLOUDFLARE_AGENTS_ADAPTER_DIAGNOSTICS[input.code];
    const details = Object.freeze({ ...input.details });
    const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

    return Object.freeze({
      ...input,
      details,
      entity,
      message: definition.message,
      severity: definition.severity,
      source: CLOUDFLARE_AGENTS_ADAPTER_ID,
    });
  }

  const definition = CLOUDFLARE_AGENTS_ADAPTER_DIAGNOSTICS[input.code];
  const details = Object.freeze({ ...input.details });
  const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

  return Object.freeze({
    ...input,
    details,
    entity,
    message: definition.message,
    severity: definition.severity,
    source: CLOUDFLARE_AGENTS_ADAPTER_ID,
  });
};
