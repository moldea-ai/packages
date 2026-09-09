import type { ICoreDiagnosticCode, ITextDocumentContent } from '@moldea.ai/core';
import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

import type { ICapabilityGroupId } from '../index.ts';

// authored input and independently specified diagnostic expectations for one Core check
export interface ICoreExampleDefinition {
  id: string;
  groupId: ICapabilityGroupId;
  title: string;
  description: string;
  operation: 'validateProject' | 'parseManifest' | 'parseDecision' | 'normalizeText';
  entries: IMemoryRepositoryEntry[];
  text?: { path: string; content: ITextDocumentContent };
  expectedCodes: ICoreDiagnosticCode[];
}
