import type {
  IDiagnosticGroup,
  IInspectionMetadataIcon,
} from '@moldea.ai/website-ui/inspection-presentation';

// anchors are owned by projects/core/docs/diagnostics.md
export const DIAGNOSTIC_GROUP_FRAGMENTS = {
  discovery: 'discovery-and-text',
  manifest: 'yaml-and-manifest-values',
  references: 'references-context-and-decisions',
  agents: 'agents-and-capabilities',
  mirrors: 'mirrors',
  integration: 'coding-agent-integration',
} satisfies Record<IDiagnosticGroup, string>;
export const MISSING_TARGET_CODES = new Set([
  'MOLDEA_REFERENCE_MISSING',
  'MOLDEA_DECISION_REFERENCE_MISSING',
  'MOLDEA_RUNTIME_GUIDANCE_MISSING',
  'MOLDEA_TOOL_IMPLEMENTATION_MISSING',
  'MOLDEA_SKILL_IMPLEMENTATION_MISSING',
  'MOLDEA_INTEGRATION_SKILL_MISSING',
]);

// platform fact labels and semantic icon roles; repair text stays in Core's documentation
export const ENTITY_FACTS: Record<string, { label: string; icon: IInspectionMetadataIcon }> = {
  agentId: { label: 'Agent', icon: 'agent' },
  capabilityKind: { label: 'Capability kind', icon: 'capability' },
  capabilityId: { label: 'Capability', icon: 'capability' },
  decisionId: { label: 'Decision', icon: 'decision' },
  variableId: { label: 'Variable', icon: 'variable' },
  contextPath: { label: 'Context document', icon: 'context' },
  integrationPath: { label: 'Instruction file', icon: 'integration' },
};
export const DETAIL_FACTS: Record<string, { label: string; icon: IInspectionMetadataIcon }> = {
  referencedPath: { label: 'Referenced file', icon: 'file' },
  symbol: { label: 'Export', icon: 'export' },
  relationship: { label: 'Relationship', icon: 'relationship' },
  reason: { label: 'Reason', icon: 'reason' },
  actualType: { label: 'Actual type', icon: 'type' },
  expectedType: { label: 'Expected type', icon: 'type' },
  entryType: { label: 'Entry type', icon: 'entryType' },
  entryKind: { label: 'Entry kind', icon: 'entryType' },
  impactPath: { label: 'Impact path', icon: 'scope' },
  pattern: { label: 'Pattern', icon: 'scope' },
  owner: { label: 'Owner', icon: 'owner' },
  code: { label: 'Warning code', icon: 'code' },
  subject: { label: 'Subject', icon: 'owner' },
  qualifier: { label: 'Qualifier', icon: 'qualifier' },
  entry: { label: 'Entry', icon: 'owner' },
  field: { label: 'Field', icon: 'export' },
  occurrences: { label: 'Occurrences', icon: 'count' },
  referencedDecisionId: { label: 'Referenced decision', icon: 'decision' },
  cycleRepresentativeDecisionId: { label: 'Decision in cycle', icon: 'cycle' },
  cycleSize: { label: 'Cycle size', icon: 'count' },
  sourceStatus: { label: 'Source status', icon: 'status' },
  targetStatus: { label: 'Target status', icon: 'status' },
  mirrorPath: { label: 'Mirror file', icon: 'mirror' },
  missingFile: { label: 'Missing file', icon: 'missingFile' },
};
export const VALUE_LABELS: Record<string, string> = {
  'runtime-agent': 'Agent implementation',
  'instruction-loader': 'Instruction loader',
  'agent-input-schema': 'Agent input schema',
  'agent-output-schema': 'Agent output schema',
  'tool-implementation': 'Tool implementation',
  'tool-input-schema': 'Tool input schema',
  'tool-output-schema': 'Tool output schema',
  'skill-implementation': 'Skill implementation',
  'context-binding': 'Context binding',
  'decision-binding': 'Decision binding',
  'block-missing': 'Integration block missing',
  'block-invalid': 'Integration block invalid',
  'skill-path-missing': 'Skill path missing',
  'skill-path-invalid': 'Skill path invalid',
  'invalid-utf8': 'Invalid UTF-8',
  'invalid-utf8-asset': 'Invalid UTF-8 asset',
  file: 'File',
  directory: 'Directory',
  symlink: 'Symbolic link',
  submodule: 'Git submodule',
  missing: 'Missing',
  outside: 'Outside the repository',
  cycle: 'Link cycle',
  string: 'Text',
  number: 'Number',
  boolean: 'Boolean',
  object: 'Mapping',
  array: 'List',
  null: 'Null',
  proposed: 'Proposed',
  accepted: 'Accepted',
  rejected: 'Rejected',
  superseded: 'Superseded',
  tool: 'Tool',
  skill: 'Skill',
};
export const LABELLED_VALUE_FIELDS = new Set([
  'capabilityKind',
  'relationship',
  'reason',
  'actualType',
  'expectedType',
  'entryType',
  'entryKind',
  'sourceStatus',
  'targetStatus',
]);
export const NOT_CHECKED_MESSAGES: Record<string, string> = {
  'no-symbol': 'No export was declared for this binding.',
  'unsupported-file-type': 'Export checks are not supported for this file type.',
  'unresolved-exports': 'The declared export could not be resolved.',
  'unparseable-source': 'The source could not be parsed to check its exports.',
  'resource-limit': 'The export check reached an inspection resource limit.',
};

// native relationship roles become semantic metadata; no Astro factories enter Node verification
export const RELATIONSHIP_ICON_ROLES = new Map<string, IInspectionMetadataIcon>(
  (
    [
      'runtime-agent',
      'instruction-loader',
      'agent-input-schema',
      'agent-output-schema',
      'tool-implementation',
      'tool-input-schema',
      'tool-output-schema',
      'skill-implementation',
      'context-binding',
      'decision-binding',
      'variable-provider',
    ] satisfies IInspectionMetadataIcon[]
  ).map((role) => [role, role]),
);
