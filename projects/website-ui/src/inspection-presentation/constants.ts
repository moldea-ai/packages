import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bot,
  CircleAlert,
  FileBraces,
  Files,
  Handshake,
  LifeBuoy,
  Link2,
  PlugZap,
  ScanSearch,
  ScrollText,
  SquareDashed,
  Target,
  TriangleAlert,
  Variable,
  Wrench,
} from '@lucide/astro';

import type {
  IDiagnosticGroup,
  IFindingCategory,
  IInspectionPresentation,
  IInspectionSeverity,
} from './types.js';

// subject icons identify what was checked; severity independently determines status
export const DIAGNOSTIC_GROUP_PRESENTATIONS = {
  discovery: { label: 'Discovery', icon: ScanSearch },
  manifest: { label: 'Manifest', icon: FileBraces },
  references: { label: 'References', icon: Link2 },
  agents: { label: 'Agents', icon: Bot },
  mirrors: { label: 'Mirrors', icon: Files },
  integration: { label: 'Integration', icon: PlugZap },
} satisfies Record<IDiagnosticGroup, IInspectionPresentation>;
export const FINDING_CATEGORY_PRESENTATIONS = {
  responsibility: { label: 'Responsibility', icon: Target },
  scope: { label: 'Scope', icon: SquareDashed },
  inputs: { label: 'Inputs', icon: ArrowDownToLine },
  outputs: { label: 'Outputs', icon: ArrowUpFromLine },
  capabilities: { label: 'Capabilities', icon: Wrench },
  handoffs: { label: 'Handoffs', icon: Handshake },
  variables: { label: 'Variables', icon: Variable },
  failureBehavior: { label: 'Failure behavior', icon: LifeBuoy },
  context: { label: 'Project context', icon: ScrollText },
  connection: { label: 'Connection', icon: Link2 },
  unclassified: { label: 'Unclassified', icon: ScanSearch },
} satisfies Record<IFindingCategory, IInspectionPresentation>;
export const INSPECTION_SEVERITY_PRESENTATIONS = {
  error: { label: 'Error', icon: CircleAlert, tone: 'danger' },
  warning: { label: 'Warning', icon: TriangleAlert, tone: 'warning' },
} satisfies Record<IInspectionSeverity, IInspectionPresentation & { tone: 'danger' | 'warning' }>;
