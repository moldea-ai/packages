// a managed region and its detected marker-line ending, retained only during comparison
export interface IManagedIntegrationRegion {
  start: number;
  end: number;
  lineEnding: '\n' | '\r\n';
}

// the public parser reports only an installation path or a safe failure reason
export type IIntegrationBlockResult =
  | { kind: 'found'; skillPath: string }
  | {
      kind: 'missing';
      reason: 'block-missing' | 'block-invalid' | 'skill-path-missing' | 'skill-path-invalid';
    };
