import type { IRuntimeAdapter } from '@moldea.ai/core/adapter';
import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

// one synthetic source variation inspected with exactly its public adapter singleton
export interface IRuntimeExampleDefinition {
  id: string;
  adapter: IRuntimeAdapter;
  title: string;
  description: string;
  files: IMemoryRepositoryEntry[];
}
