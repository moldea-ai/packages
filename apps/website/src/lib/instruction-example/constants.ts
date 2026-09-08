import type { IInstructionSnapshot } from './types.ts';

// the instruction remains, but its registered tool's implementation file is absent
export const INSTRUCTION_SNAPSHOT: IInstructionSnapshot = {
  instruction:
    'You are the `support` agent.\n\nUse `get_delivery_status` to answer delivery questions.\n',
  implementationPath: '/src/orders/tracking.ts',
  sourceFiles: [],
};
