import type { IDiagnostic } from '@moldea.ai/core';

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
  result: { valid: boolean; errorCount: number; warningCount: number; diagnostics: IDiagnostic[] };
}
