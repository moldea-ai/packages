import type {
  IRuntimeAdapterEntry,
  IRuntimeTarget,
} from '../../../../../scripts/runtime-compatibility/types.ts';

import type { IRuntimeTargetMaturity } from '../runtime-target-maturity/index.ts';

// one published target combining the complete technical record with website-owned maturity
export interface IRuntimeCompatibilityPublicationTarget extends IRuntimeTarget {
  maturity: IRuntimeTargetMaturity;
}

// one published adapter preserving the technical entry and enriching only its targets
export interface IRuntimeCompatibilityPublicationAdapter extends Omit<
  IRuntimeAdapterEntry,
  'targets'
> {
  targets?: IRuntimeCompatibilityPublicationTarget[];
}

// closed version 1 machine-readable runtime compatibility publication
export interface IRuntimeCompatibilityPublicationV1 {
  adapters: Record<string, IRuntimeCompatibilityPublicationAdapter>;
  matrixVersion: 2;
  schemaVersion: 1;
}
