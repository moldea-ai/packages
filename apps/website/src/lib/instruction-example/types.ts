import type { IProjectValidationResult } from '@moldea.ai/core';

import type { ICapabilityFile } from '../capabilities/index.ts';

// a fixed instruction, its tool implementation reference, and any supporting source files
export interface IInstructionSnapshot {
  instruction: string;
  implementationPath: string;
  sourceFiles: { path: string; content: string }[];
}

// the hero's real Core validation and the source needed to explain its diagnostic
export interface IInstructionExample {
  instructionPath: string;
  instruction: string;
  implementationPath: string;
  result: IProjectValidationResult;
  files: ICapabilityFile[];
}
