import type { ICapabilityFact } from '../index.ts';

// an exact field redaction identifies its response and JSON pointer
export interface IOutputRedaction {
  responseIndex: number;
  pointer: string;
  reason: string;
}

// captured native responses remain distinct from application-authored execution facts
export interface IRecordedOutput {
  kind: 'response' | 'execution-facts';
  responses: ICapabilityFact[];
  redactions: IOutputRedaction[];
}
