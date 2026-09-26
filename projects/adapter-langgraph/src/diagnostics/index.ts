import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';

import { LANGGRAPH_ADAPTER_ID } from '../constants/index.js';
import type {
  ILangGraphAdapterDiagnosticCode,
  ILangGraphDiagnosticInput,
} from '../contracts/index.js';

// stable LangGraph adapter diagnostic messages
export const LANGGRAPH_ADAPTER_DIAGNOSTICS = Object.freeze({
  LANGGRAPH_AGENT_INPUT_SCHEMA_NOT_WIRED: {
    message: 'The declared agent input schema is not wired to the detected LangGraph input schema.',
    severity: 'error',
  },
  LANGGRAPH_AGENT_INPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared agent input-schema symbol was not found.',
    severity: 'error',
  },
  LANGGRAPH_AGENT_OUTPUT_SCHEMA_NOT_WIRED: {
    message:
      'The declared agent output schema is not wired to the detected LangGraph output schema.',
    severity: 'error',
  },
  LANGGRAPH_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND: {
    message: 'The declared agent output-schema symbol was not found.',
    severity: 'error',
  },
  LANGGRAPH_PACKAGE_MANIFEST_INVALID: {
    message: 'The owning package manifest is invalid for LangGraph dependency detection.',
    severity: 'error',
  },
  LANGGRAPH_RUNTIME_AGENT_SYMBOL_NOT_FOUND: {
    message: 'The declared runtime-agent symbol was not found.',
    severity: 'error',
  },
  LANGGRAPH_SOURCE_SYNTAX_INVALID: {
    message: 'The referenced LangGraph source file contains invalid TypeScript syntax.',
    severity: 'error',
  },
  LANGGRAPH_SOURCE_TEXT_INVALID: {
    message: 'The referenced LangGraph source file is not valid normalized text.',
    severity: 'error',
  },
  LANGGRAPH_VERSION_UNSUPPORTED: {
    message: 'The observed LangGraph target package ranges are disjoint from the supported target.',
    severity: 'error',
  },
  LANGGRAPH_RUNTIME_RELATIONSHIP_UNVERIFIED: {
    message: 'The declared runtime relationship could not be verified.',
    severity: 'warning',
  },
} as const satisfies Readonly<
  Record<
    ILangGraphAdapterDiagnosticCode,
    { readonly message: string; readonly severity: 'error' | 'warning' }
  >
>);

/** Creates one deeply immutable LangGraph diagnostic. */
export const createLangGraphDiagnostic = (input: ILangGraphDiagnosticInput): IAdapterDiagnostic => {
  if (input.code === 'LANGGRAPH_RUNTIME_RELATIONSHIP_UNVERIFIED') {
    const definition = LANGGRAPH_ADAPTER_DIAGNOSTICS[input.code];
    const details = Object.freeze({ ...input.details });
    const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

    return Object.freeze({
      ...input,
      details,
      entity,
      message: definition.message,
      severity: definition.severity,
      source: LANGGRAPH_ADAPTER_ID,
    });
  }

  const definition = LANGGRAPH_ADAPTER_DIAGNOSTICS[input.code];
  const details = Object.freeze({ ...input.details });
  const entity = input.entity === null ? null : Object.freeze({ ...input.entity });

  return Object.freeze({
    ...input,
    details,
    entity,
    message: definition.message,
    severity: definition.severity,
    source: LANGGRAPH_ADAPTER_ID,
  });
};
